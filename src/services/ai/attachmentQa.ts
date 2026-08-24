import { extractTextFromAttachmentRef } from "./chat/attachmentContextLoader";
import { runOneShot } from "./chat/chatService";
import type { AttachmentRef } from "./chat/types";
import { attachmentExtractFailedMessage } from "./chat/chatI18n";

export { extractTextFromAttachmentRef };

export async function summarizeAttachment(
  ref: AttachmentRef,
): Promise<string> {
  const text = await extractTextFromAttachmentRef(ref);
  if (!text) {
    return attachmentExtractFailedMessage();
  }
  const systemPrompt =
    "You are a document assistant. Summarize the attachment concisely: main points, key data, and anything the user should act on. Answer in the language the user writes in.";
  const userContent = `Attachment: ${ref.filename ?? "attachment"}\n\n${text.slice(0, 8000)}`;
  return runOneShot(systemPrompt, userContent);
}

export async function askAboutAttachment(
  ref: AttachmentRef,
  question: string,
): Promise<string> {
  const text = await extractTextFromAttachmentRef(ref);
  if (!text) {
    return attachmentExtractFailedMessage();
  }
  const systemPrompt =
    "You are a document assistant. Answer the user's question using ONLY the attachment content. If the answer is not in the document, say so. Answer in the language the user writes in.";
  const userContent = `Attachment: ${ref.filename ?? "attachment"}\n\n${text.slice(0, 8000)}\n\nQuestion: ${question}`;
  return runOneShot(systemPrompt, userContent);
}
