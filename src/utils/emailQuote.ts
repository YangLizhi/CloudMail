import { escapeHtml, sanitizeHtml } from "./sanitize";
import type { DbMessage } from "@/services/db/messages";

/** Quoted original for Reply / Reply All (Outlook-style). */
export function buildReplyQuote(msg: DbMessage): string {
  const date = new Date(msg.date).toLocaleString();
  const from = msg.from_name
    ? `${escapeHtml(msg.from_name)} &lt;${escapeHtml(msg.from_address ?? "")}&gt;`
    : escapeHtml(msg.from_address ?? "Unknown");
  const body = msg.body_html
    ? sanitizeHtml(msg.body_html)
    : escapeHtml(msg.body_text ?? "");
  return `<br><br><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#666">On ${date}, ${from} wrote:<br>${body}</div>`;
}

/** Quoted original for Forward. */
export function buildForwardQuote(msg: DbMessage): string {
  const date = new Date(msg.date).toLocaleString();
  const body = msg.body_html
    ? sanitizeHtml(msg.body_html)
    : escapeHtml(msg.body_text ?? "");
  return `<br><br>---------- Forwarded message ---------<br>From: ${escapeHtml(
    msg.from_name ?? "",
  )} &lt;${escapeHtml(msg.from_address ?? "")}&gt;<br>Date: ${date}<br>Subject: ${escapeHtml(
    msg.subject ?? "",
  )}<br>To: ${escapeHtml(msg.to_addresses ?? "")}<br><br>${body}`;
}
