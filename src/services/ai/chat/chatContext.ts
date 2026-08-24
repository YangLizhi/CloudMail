import { getMessagesForThread } from "@/services/db/messages";
import type { ContextRef, EmailRef } from "./types";

const MAX_EMAIL_CHARS = 6000;
const MAX_ATTACHMENT_CHARS = 8000;

function formatEmailMessage(
  msg: {
    from_name: string | null;
    from_address: string | null;
    date: number;
    subject: string | null;
    body_text: string | null;
    snippet: string | null;
  },
): string {
  const from = msg.from_name
    ? `${msg.from_name} <${msg.from_address ?? ""}>`
    : (msg.from_address ?? "Unknown");
  const date = new Date(msg.date).toLocaleString();
  const body = (msg.body_text ?? msg.snippet ?? "").trim();
  return `From: ${from}\nDate: ${date}\nSubject: ${msg.subject ?? ""}\n\n${body}`;
}

async function buildEmailContext(ref: EmailRef): Promise<string> {
  try {
    const messages = await getMessagesForThread(ref.accountId, ref.threadId);
    if (messages.length === 0) return "";
    // Use at most the first and last 2 messages to keep context bounded
    const picked: typeof messages = [];
    for (const m of messages.slice(0, 2)) picked.push(m);
    if (messages.length > 4) {
      for (const m of messages.slice(-2)) picked.push(m);
    } else if (messages.length > 2) {
      for (const m of messages.slice(2)) picked.push(m);
    }
    let body = picked.map(formatEmailMessage).join("\n---\n");
    if (body.length > MAX_EMAIL_CHARS) {
      body = body.slice(0, MAX_EMAIL_CHARS);
    }
    return `<email_thread>\nSubject: ${ref.subject ?? "(no subject)"}\n${body}\n</email_thread>`;
  } catch (err) {
    console.warn("Failed to load email context:", err);
    return "";
  }
}

async function buildAttachmentContext(
  ref: Extract<ContextRef, { kind: "attachment" }>,
): Promise<string> {
  try {
    const { extractTextFromAttachmentRef } = await import("./attachmentContextLoader");
    const text = await extractTextFromAttachmentRef(ref);
    if (!text) return "";
    return `<attachment name="${ref.filename ?? "attachment"}">\n${text.slice(0, MAX_ATTACHMENT_CHARS)}\n</attachment>`;
  } catch (err) {
    console.warn("Failed to build attachment context:", err);
    return "";
  }
}

/**
 * Build the text payload that represents all referenced emails/attachments
 * for the current conversation turn.
 */
export async function buildRefsContext(refs: ContextRef[]): Promise<string> {
  if (refs.length === 0) return "";
  const parts: string[] = [];
  for (const ref of refs) {
    if (ref.kind === "email") {
      const ctx = await buildEmailContext(ref);
      if (ctx) parts.push(ctx);
    } else {
      const ctx = await buildAttachmentContext(ref);
      if (ctx) parts.push(ctx);
    }
  }
  return parts.join("\n\n");
}
