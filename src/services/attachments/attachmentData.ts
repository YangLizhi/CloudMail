import type { DbAttachment } from "@/services/db/attachments";
import { getEmailProvider } from "@/services/email/providerFactory";

/**
 * Fetch raw attachment bytes for a message attachment.
 * Supports both Gmail (base64url) and IMAP (standard base64) providers.
 */
export async function fetchAttachmentBytes(
  accountId: string,
  messageId: string,
  attachment: DbAttachment,
): Promise<Uint8Array> {
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
