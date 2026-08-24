import { getSetting, setSetting } from "@/services/db/settings";
import { getDb } from "@/services/db/connection";
import { getAccount } from "@/services/db/accounts";
import { getEmailProvider } from "@/services/email/providerFactory";
import { buildRawEmail } from "@/utils/emailBuilder";
import { createBackgroundChecker } from "@/services/backgroundCheckers";

export interface AutoReplyRule {
  id: string;
  accountId: string;
  name: string;
  startAt: number;
  endAt: number;
  subject: string | null;
  bodyHtml: string;
  active: boolean;
  createdAt: number;
}

const MAX_SENT_PER_RULE = 500;

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getAutoReplyRules(): Promise<AutoReplyRule[]> {
  const raw = await getSetting("auto_reply_rules");
  return parseJson<AutoReplyRule[]>(raw, []);
}

export async function saveAutoReplyRules(rules: AutoReplyRule[]): Promise<void> {
  await setSetting("auto_reply_rules", JSON.stringify(rules));
}

export async function upsertAutoReplyRule(rule: AutoReplyRule): Promise<AutoReplyRule[]> {
  const rules = await getAutoReplyRules();
  const idx = rules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) {
    rules[idx] = rule;
  } else {
    rules.push(rule);
  }
  await saveAutoReplyRules(rules);
  return rules;
}

export async function deleteAutoReplyRule(id: string): Promise<void> {
  const rules = await getAutoReplyRules();
  await saveAutoReplyRules(rules.filter((r) => r.id !== id));
}

export async function getAutoReplySent(): Promise<Record<string, Record<string, number>>> {
  const raw = await getSetting("auto_reply_sent");
  return parseJson<Record<string, Record<string, number>>>(raw, {});
}

async function saveAutoReplySent(sent: Record<string, Record<string, number>>): Promise<void> {
  // Trim per-rule history to avoid unbounded growth
  for (const ruleId of Object.keys(sent)) {
    const entries = Object.entries(sent[ruleId] ?? {});
    if (entries.length > MAX_SENT_PER_RULE) {
      entries.sort((a, b) => a[1] - b[1]);
      const trimmed = Object.fromEntries(entries.slice(-MAX_SENT_PER_RULE));
      sent[ruleId] = trimmed;
    }
  }
  await setSetting("auto_reply_sent", JSON.stringify(sent));
}

export async function getAutoReplyCount(ruleId: string): Promise<number> {
  const sent = await getAutoReplySent();
  return Object.keys(sent[ruleId] ?? {}).length;
}

interface ReplyCandidate {
  messageId: string;
  threadId: string;
  fromAddress: string;
  subject: string | null;
  messageIdHeader: string | null;
  referencesHeader: string | null;
  date: number;
}

async function findCandidates(rule: AutoReplyRule): Promise<ReplyCandidate[]> {
  const account = await getAccount(rule.accountId);
  if (!account) return [];
  const db = await getDb();
  const rows = await db.select<ReplyCandidate[]>(
    `SELECT m.id as messageId, m.thread_id as threadId, m.from_address as fromAddress,
            m.subject, m.message_id_header as messageIdHeader,
            m.references_header as referencesHeader, m.date
     FROM messages m
     LEFT JOIN thread_labels tl ON tl.account_id = m.account_id AND tl.thread_id = m.thread_id AND tl.label_id = 'INBOX'
     WHERE m.account_id = $1
       AND m.from_address IS NOT NULL
       AND LOWER(m.from_address) != LOWER($2)
       AND m.date >= $3
       AND m.date <= $4
       AND (m.imap_folder = 'INBOX' OR tl.label_id IS NOT NULL OR EXISTS (
         SELECT 1 FROM thread_labels t2 WHERE t2.account_id = m.account_id AND t2.thread_id = m.thread_id AND t2.label_id = 'INBOX'
       ))
     ORDER BY m.date DESC
     LIMIT 50`,
    [rule.accountId, account.email, rule.startAt, Date.now()],
  );
  return rows;
}

async function sendAutoReply(
  rule: AutoReplyRule,
  candidate: ReplyCandidate,
): Promise<void> {
  const account = await getAccount(rule.accountId);
  if (!account) throw new Error("Account not found");

  const subject = rule.subject?.trim()
    ? rule.subject
    : `Re: ${candidate.subject ?? ""}`.trim();

  const raw = buildRawEmail({
    from: account.email,
    to: [candidate.fromAddress],
    subject,
    htmlBody: rule.bodyHtml,
    inReplyTo: candidate.messageIdHeader ?? undefined,
    references: candidate.referencesHeader ?? undefined,
  });

  const provider = await getEmailProvider(rule.accountId);
  await provider.sendMessage(raw, candidate.threadId);
}

/**
 * One sweep: for every active rule whose window contains "now", find new
 * incoming inbox messages and reply once per sender per rule.
 */
async function checkAutoReplies(): Promise<void> {
  const rules = await getAutoReplyRules();
  const now = Date.now();
  const active = rules.filter((r) => r.active && now >= r.startAt && now <= r.endAt);
  if (active.length === 0) return;

  const sent = await getAutoReplySent();
  let changed = false;

  for (const rule of active) {
    const replied = sent[rule.id] ?? {};
    let candidates: ReplyCandidate[] = [];
    try {
      candidates = await findCandidates(rule);
    } catch (err) {
      console.error("[AutoReply] Failed to find candidates:", err);
      continue;
    }

    for (const candidate of candidates) {
      const key = candidate.fromAddress.toLowerCase();
      if (replied[key] !== undefined) continue;
      try {
        await sendAutoReply(rule, candidate);
        replied[key] = Date.now();
        changed = true;
      } catch (err) {
        console.error("[AutoReply] Failed to send reply:", err);
      }
    }
    sent[rule.id] = replied;
  }

  if (changed) {
    await saveAutoReplySent(sent);
  }
}

const autoReplyChecker = createBackgroundChecker("AutoReply", checkAutoReplies, 60_000);
export const startAutoReplyChecker = autoReplyChecker.start;
export const stopAutoReplyChecker = autoReplyChecker.stop;
