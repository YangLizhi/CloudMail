import { navigateToLabel } from "@/router/navigate";
import { getDb } from "@/services/db/connection";
import {
  getThreadsForAccount,
  getThreadsForCategory,
} from "@/services/db/threads";
import { getSmartFolderSearchQuery } from "@/services/search/smartFolderQuery";
import { getLastReadThreads, setLastReadThread } from "./lastRead";

const LABEL_MAP: Record<string, string> = {
  inbox: "INBOX",
  starred: "STARRED",
  sent: "SENT",
  drafts: "DRAFT",
  trash: "TRASH",
  spam: "SPAM",
  snoozed: "SNOOZED",
  all: "",
};

async function threadExists(accountId: string, threadId: string): Promise<boolean> {
  try {
    const db = await getDb();
    const rows = await db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM threads WHERE account_id = $1 AND id = $2",
      [accountId, threadId],
    );
    return (rows[0]?.c ?? 0) > 0;
  } catch {
    return false;
  }
}

async function firstThreadForLabel(
  label: string,
  accountId: string,
  category?: string,
): Promise<string | null> {
  try {
    if (label.startsWith("smart-folder:")) {
      const db = await getDb();
      const folderId = label.replace("smart-folder:", "");
      const rows = await db.select<{ query: string }[]>(
        "SELECT query FROM smart_folders WHERE id = $1",
        [folderId],
      );
      if (!rows[0]) return null;
      const { sql, params } = getSmartFolderSearchQuery(rows[0].query, accountId, 1);
      const res = await db.select<{ thread_id: string }[]>(sql, params);
      return res[0]?.thread_id ?? null;
    }
    if (label === "inbox" && category && category !== "All") {
      const rows = await getThreadsForCategory(accountId, category, 1, 0);
      return rows[0]?.id ?? null;
    }
    const gmailLabelId = LABEL_MAP[label] ?? label;
    const rows = await getThreadsForAccount(accountId, gmailLabelId || undefined, 1, 0);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Navigate to a mail category and auto-open the last read email in it,
 * falling back to the first email of that category.
 */
export async function navigateToLabelAutoOpen(
  label: string,
  accountId: string,
  opts?: { category?: string; threadId?: string },
): Promise<void> {
  if (opts?.threadId) {
    navigateToLabel(label, opts);
    return;
  }
  if (!accountId) {
    navigateToLabel(label, opts);
    return;
  }

  const key = opts?.category ? `${label}:${opts.category}` : label;
  const last = await getLastReadThreads();
  const cached = last[key];
  if (cached && (await threadExists(accountId, cached))) {
    navigateToLabel(label, { threadId: cached, category: opts?.category });
    return;
  }

  const firstId = await firstThreadForLabel(label, accountId, opts?.category);
  if (firstId) {
    navigateToLabel(label, { threadId: firstId, category: opts?.category });
    await setLastReadThread(key, firstId);
  } else {
    navigateToLabel(label, opts);
  }
}
