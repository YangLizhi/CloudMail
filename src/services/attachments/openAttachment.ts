import { openPath } from "@tauri-apps/plugin-opener";
import { join, appDataDir } from "@tauri-apps/api/path";
import { fetchAttachmentBytes } from "./attachmentData";
import { getFileExtension } from "@/utils/fileTypeHelpers";
import type { DbAttachment } from "@/services/db/attachments";

const OPEN_DIR = "cloudmail-open";

/** Strip characters that are not allowed on typical file systems. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

/**
 * Download an attachment to the app data folder and open it with the
 * OS default application (based on the file extension).
 *
 * Returns the absolute path that was opened (useful for messages/logging).
 */
export async function openAttachmentWithDefaultApp(
  accountId: string,
  messageId: string,
  attachment: DbAttachment,
): Promise<string> {
  const bytes = await fetchAttachmentBytes(accountId, messageId, attachment);

  const ext = getFileExtension(attachment.filename, attachment.mime_type);
  const base = sanitizeFileName(attachment.filename ?? "attachment");
  const safeName = `${Date.now()}-${base || "attachment"}${ext ? `.${ext}` : ""}`;

  const { mkdir, writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  try {
    await mkdir(OPEN_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // Directory may already exist.
  }

  const relPath = await join(OPEN_DIR, safeName);
  await writeFile(relPath, bytes, { baseDir: BaseDirectory.AppData });

  const appData = await appDataDir();
  const absPath = await join(appData, relPath);
  await openPath(absPath);
  return absPath;
}
