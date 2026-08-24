import { searchMessages } from "@/services/db/search";
import { getDb } from "@/services/db/connection";
import {
  archiveThread,
  trashThread,
  markThreadRead,
  starThread,
  spamThread,
  addThreadLabel,
  removeThreadLabel,
} from "@/services/emailActions";
import { snoozeThread } from "@/services/snooze/snoozeManager";
import { setThreadCategory } from "@/services/db/threadCategories";
import { useThreadStore } from "@/stores/threadStore";
import type { AgenticActionItem, AgenticPlan } from "./chat/types";

export const AGENTIC_ACTION_TYPES = new Set([
  "archive",
  "trash",
  "markRead",
  "markUnread",
  "star",
  "unstar",
  "applyLabel",
  "removeLabel",
  "moveToCategory",
  "spam",
  "snooze",
]);

export interface TargetThread {
  threadId: string;
  accountId: string;
  subject: string | null;
  fromAddress: string | null;
  date: number;
}

export interface AgenticExecutionResult {
  success: boolean;
  totalThreads: number;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export function validatePlan(plan: AgenticPlan): string | null {
  if (!plan.query?.trim()) return "Plan query is empty";
  if (!Array.isArray(plan.actions) || plan.actions.length === 0) {
    return "Plan has no actions";
  }
  for (const action of plan.actions) {
    if (!AGENTIC_ACTION_TYPES.has(action.type)) {
      return `Unsupported action type: ${action.type}`;
    }
    if (
      (action.type === "applyLabel" || action.type === "removeLabel") &&
      !action.params?.labelId
    ) {
      return `Action ${action.type} requires a labelId`;
    }
    if (action.type === "moveToCategory" && !action.params?.category) {
      return "moveToCategory requires a category";
    }
    if (action.type === "snooze" && !action.params?.snoozeDuration) {
      return "snooze requires snoozeDuration";
    }
  }
  return null;
}

/**
 * Resolve a search query to target threads (deduped by thread, newest first).
 */
export async function resolveTargetThreads(
  query: string,
  accountId: string,
  limit = 100,
): Promise<TargetThread[]> {
  const results = await searchMessages(query, accountId, 300);
  const db = await getDb();
  const byThread = new Map<
    string,
    { threadId: string; date: number; messageId: string }
  >();
  for (const r of results) {
    if (!byThread.has(r.thread_id)) {
      byThread.set(r.thread_id, {
        threadId: r.thread_id,
        date: r.date,
        messageId: r.message_id,
      });
    }
  }
  const threadIds = [...byThread.values()]
    .sort((a, b) => b.date - a.date)
    .slice(0, limit)
    .map((t) => t.threadId);
  if (threadIds.length === 0) return [];

  const placeholders = threadIds.map((_, i) => `$${i + 2}`).join(", ");
  const rows = await db.select<
    { id: string; subject: string | null; from_address: string | null; last_message_at: number }[]
  >(
    `SELECT id, subject, from_address, last_message_at FROM threads
     WHERE account_id = $1 AND id IN (${placeholders})`,
    [accountId, ...threadIds],
  );
  const rowMap = new Map(rows.map((r) => [r.id, r]));
  return threadIds
    .map((id) => {
      const row = rowMap.get(id);
      return row
        ? {
            threadId: id,
            accountId,
            subject: row.subject,
            fromAddress: row.from_address,
            date: row.last_message_at ?? byThread.get(id)?.date ?? 0,
          }
        : null;
    })
    .filter((t): t is TargetThread => t !== null);
}

async function executeOneAction(
  action: AgenticActionItem,
  threadId: string,
  accountId: string,
): Promise<void> {
  switch (action.type) {
    case "archive":
      await archiveThread(accountId, threadId, []);
      break;
    case "trash":
      await trashThread(accountId, threadId, []);
      break;
    case "markRead":
      await markThreadRead(accountId, threadId, [], true);
      break;
    case "markUnread":
      await markThreadRead(accountId, threadId, [], false);
      break;
    case "star":
      await starThread(accountId, threadId, [], true);
      break;
    case "unstar":
      await starThread(accountId, threadId, [], false);
      break;
    case "applyLabel":
      if (action.params?.labelId) {
        await addThreadLabel(accountId, threadId, action.params.labelId);
        const thread = useThreadStore.getState().threadMap.get(threadId);
        if (thread && !thread.labelIds.includes(action.params.labelId)) {
          useThreadStore.getState().updateThread(threadId, {
            labelIds: [...thread.labelIds, action.params.labelId],
          });
        }
      }
      break;
    case "removeLabel":
      if (action.params?.labelId) {
        await removeThreadLabel(accountId, threadId, action.params.labelId);
        const thread = useThreadStore.getState().threadMap.get(threadId);
        if (thread) {
          useThreadStore.getState().updateThread(threadId, {
            labelIds: thread.labelIds.filter((l) => l !== action.params!.labelId),
          });
        }
      }
      break;
    case "moveToCategory":
      if (action.params?.category) {
        await setThreadCategory(accountId, threadId, action.params.category, true);
      }
      break;
    case "spam":
      await spamThread(accountId, threadId, [], true);
      break;
    case "snooze":
      if (action.params?.snoozeDuration) {
        await snoozeThread(accountId, threadId, Date.now() + action.params.snoozeDuration);
      }
      break;
  }
}

/**
 * Execute a confirmed agentic plan over the resolved target threads.
 * Actions are executed per thread sequentially; errors are collected and
 * do not stop the remaining work.
 */
export async function executeAgenticPlan(
  plan: AgenticPlan,
  targets: TargetThread[],
): Promise<AgenticExecutionResult> {
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  const accountId = targets[0]?.accountId;

  for (const action of plan.actions) {
    for (const target of targets) {
      attempted++;
      try {
        await executeOneAction(action, target.threadId, target.accountId);
        succeeded++;
      } catch (err) {
        failed++;
        errors.push(
          `${action.type} on ${target.subject ?? target.threadId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  if (accountId) {
    window.dispatchEvent(new Event("velo-sync-done"));
  }

  return {
    success: failed === 0,
    totalThreads: targets.length,
    attempted,
    succeeded,
    failed,
    errors,
  };
}
