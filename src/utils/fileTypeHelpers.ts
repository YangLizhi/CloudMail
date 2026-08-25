export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(mimeType: string | null): boolean {
  return mimeType?.startsWith("image/") ?? false;
}

export function isPdf(mimeType: string | null, filename?: string | null): boolean {
  if (mimeType === "application/pdf") return true;
  // Gmail sometimes returns application/octet-stream for PDFs
  return filename?.toLowerCase().endsWith(".pdf") ?? false;
}

export function isText(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml";
}

export function canPreview(mimeType: string | null, filename: string | null): boolean {
  return isImage(mimeType) || isPdf(mimeType, filename) || isText(mimeType);
}

export function isDocument(mimeType: string | null, filename?: string | null): boolean {
  if (mimeType) {
    if (mimeType.includes("msword") || mimeType.includes("wordprocessingml") || mimeType.includes("opendocument.text") || mimeType === "application/rtf") return true;
  }
  const ext = filename?.toLowerCase();
  return ext?.endsWith(".doc") || ext?.endsWith(".docx") || ext?.endsWith(".odt") || ext?.endsWith(".rtf") || false;
}

export function isSpreadsheet(mimeType: string | null, filename?: string | null): boolean {
  if (mimeType) {
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return true;
  }
  const ext = filename?.toLowerCase();
  return ext?.endsWith(".xls") || ext?.endsWith(".xlsx") || ext?.endsWith(".ods") || ext?.endsWith(".csv") || false;
}

export function isArchive(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive") || mimeType.includes("tar") || mimeType === "application/gzip" || mimeType === "application/x-gzip";
}

export function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return "\u{1F4CE}";
  if (mimeType.startsWith("image/")) return "\u{1F5BC}";
  if (mimeType.startsWith("video/")) return "\u{1F3AC}";
  if (mimeType.startsWith("audio/")) return "\u{1F3B5}";
  if (mimeType === "application/pdf") return "\u{1F4C4}";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "\u{1F4CA}";
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) return "\u{1F4E6}";
  return "\u{1F4CE}";
}

/**
 * Best-effort file extension for a filename/MIME type, used when saving or
 * opening an attachment so the OS picks the right default application.
 * Returns an extension WITHOUT a leading dot (e.g. "docx"); "" if unknown.
 */
export function getFileExtension(
  filename: string | null | undefined,
  mimeType: string | null | undefined,
): string {
  if (filename) {
    const idx = filename.lastIndexOf(".");
    if (idx > 0 && idx < filename.length - 1) {
      const ext = filename.slice(idx + 1).toLowerCase();
      if (/^[a-z0-9]{1,8}$/.test(ext)) return ext;
    }
  }

  const mime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": "dotx",
    "application/rtf": "rtf",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/html": "html",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/gzip": "gz",
    "application/vnd.rar": "rar",
    "application/x-7z-compressed": "7z",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/vnd.oasis.opendocument.presentation": "odp",
  };
  if (mimeType && mime[mimeType]) return mime[mimeType];
  return "";
}
