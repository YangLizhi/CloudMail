import { loadCachedAttachment } from "@/services/attachments/cacheManager";
import type { AttachmentRef } from "./types";

/**
 * Minimal ZIP central-directory parser used to read word/document.xml
 * from .docx files without adding a dependency.
 */
async function extractDocxText(data: Uint8Array): Promise<string | null> {
  try {
    const decoder = new TextDecoder();
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    // Locate End of Central Directory record
    let eocd = -1;
    for (let i = data.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) return null;
    const entryCount = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    let cursor = cdOffset;
    for (let i = 0; i < entryCount; i++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) break;
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const nameLen = view.getUint16(cursor + 28, true);
      const extraLen = view.getUint16(cursor + 30, true);
      const commentLen = view.getUint16(cursor + 32, true);
      const localHeaderOffset = view.getUint32(cursor + 42, true);
      const name = decoder.decode(data.subarray(cursor + 46, cursor + 46 + nameLen));
      if (name === "word/document.xml") {
        const lho = localHeaderOffset;
        const lhoNameLen = view.getUint16(lho + 26, true);
        const lhoExtraLen = view.getUint16(lho + 28, true);
        const entryMethod = method;
        const entryOffset = lho + 30 + lhoNameLen + lhoExtraLen;
        const entryData = data.subarray(entryOffset, entryOffset + compressedSize);
        const bytes =
          entryMethod === 0
            ? entryData
            : await inflateRaw(entryData);
        if (!bytes) return null;
        const xml = new TextDecoder().decode(bytes);
        const texts: string[] = [];
        const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml)) !== null) {
          texts.push(m[1]!);
        }
        if (texts.length === 0) return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return texts.join("\n");
      }
      cursor += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  } catch {
    return null;
  }
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Naive PDF text extraction: only works for PDFs with uncompressed text
 * streams (many simple/generated PDFs). Compressed streams are skipped.
 */
function extractPdfText(data: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(data);
    if (!text.includes("%PDF")) return null;
    const chunks: string[] = [];
    const re = /\(([^()\\]{1,200})\)\s*Tj|\[([^\]]{1,500})\]\s*TJ/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const piece = (m[1] ?? m[2] ?? "").replace(/\\([()\\])/g, "$1");
      if (piece.trim()) chunks.push(piece);
    }
    const result = chunks.join(" ").replace(/\s+/g, " ").trim();
    return result.length > 40 ? result : null;
  } catch {
    return null;
  }
}

export async function extractTextFromBytes(
  data: Uint8Array,
  filename: string | null,
  mimeType: string | null,
): Promise<string> {
  const name = (filename ?? "").toLowerCase();
  const mime = (mimeType ?? "").toLowerCase();

  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    name.endsWith(".xml") ||
    name.endsWith(".html") ||
    name.endsWith(".htm") ||
    mime === "application/json" ||
    mime === "application/xml"
  ) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(data);
    if (mime === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) {
      return text
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
    }
    return text.replace(/\r\n/g, "\n").trim();
  }

  if (
    name.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return (await extractDocxText(data)) ?? "";
  }

  if (name.endsWith(".pdf") || mime === "application/pdf") {
    return extractPdfText(data) ?? "";
  }

  return "";
}

/**
 * Load an attachment's cached bytes and extract readable text.
 * Returns "" when the attachment is missing, cached, or unsupported.
 */
export async function extractTextFromAttachmentRef(
  ref: AttachmentRef,
): Promise<string> {
  // Resolve local path through DB (cached attachments only)
  const { getDb } = await import("@/services/db/connection");
  const db = await getDb();
  const rows = await db.select<
    { local_path: string | null }[]
  >(
    "SELECT local_path FROM attachments WHERE id = $1 AND account_id = $2",
    [ref.attachmentId, ref.accountId],
  );
  const localPath = rows[0]?.local_path;
  if (!localPath) return "";
  const data = await loadCachedAttachment(localPath);
  if (!data) return "";
  return extractTextFromBytes(data, ref.filename, ref.mimeType);
}

export async function extractTextForAttachmentId(
  accountId: string,
  attachmentId: string,
): Promise<string> {
  const rows = await getAttachmentRow(accountId, attachmentId);
  if (!rows) return "";
  return extractTextFromAttachmentRef({
    kind: "attachment",
    attachmentId,
    accountId,
    messageId: rows.message_id,
    filename: rows.filename,
    mimeType: rows.mime_type,
    size: rows.size,
  });
}

async function getAttachmentRow(
  accountId: string,
  attachmentId: string,
): Promise<{ message_id: string; filename: string | null; mime_type: string | null; size: number | null } | null> {
  const { getDb } = await import("@/services/db/connection");
  const db = await getDb();
  const rows = await db.select<
    { message_id: string; filename: string | null; mime_type: string | null; size: number | null }[]
  >(
    "SELECT message_id, filename, mime_type, size FROM attachments WHERE id = $1 AND account_id = $2",
    [attachmentId, accountId],
  );
  return rows[0] ?? null;
}
