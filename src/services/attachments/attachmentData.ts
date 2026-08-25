import type { DbAttachment } from "@/services/db/attachments";
import { getEmailProvider } from "@/services/email/providerFactory";
import {
  loadCachedAttachmentById,
  cacheAttachment,
} from "./cacheManager";

/**
 * Fetch raw attachment bytes for a message attachment.
 * Supports both Gmail (base64url) and IMAP (standard base64) providers.
 */
export async function fetchAttachmentBytes(
  accountId: string,
  messageId: string,
  attachment: DbAttachment,
): Promise<Uint8Array> {
  // Prefer the locally cached copy — this is fast, works offline, and avoids
  // full-message IMAP fetches that some enterprise servers mishandle.
  const cached = await loadCachedAttachmentById(attachment.id);
  if (cached) return cached;

  if (!attachment.gmail_attachment_id) {
    throw new Error("Attachment has no fetch identifier");
  }

  const provider = await getEmailProvider(accountId);
  const response = await provider.fetchAttachment(
    messageId,
    attachment.gmail_attachment_id,
  );

  // Normalize URL-safe base64 (Gmail API) to standard base64.
  // For IMAP the server already returns standard base64, so these
  // replacements are a no-op there.
  const base64 = response.data.replace(/-/g, "+").replace(/_/g, "/");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Best-effort persist for future access.
  try {
    await cacheAttachment(attachment.id, bytes);
  } catch {
    // Non-fatal — cache may be unavailable (e.g. read-only scope).
  }

  return bytes;
}

/**
 * Fetch attachment bytes and wrap them in a Blob with an effective MIME type.
 */
export async function fetchAttachmentBlob(
  accountId: string,
  messageId: string,
  attachment: DbAttachment,
  mimeType: string,
): Promise<Blob> {
  const bytes = await fetchAttachmentBytes(accountId, messageId, attachment);
  return new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
}

/**
 * Encode raw bytes to a base64 string (chunked for large buffers).
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
