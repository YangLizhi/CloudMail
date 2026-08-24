import { exists, readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

const LOG_FILE = "cloudmail-debug.log";
const FS_OPTIONS = { baseDir: BaseDirectory.AppData };
const MAX_BYTES = 500_000;

export async function appendDebugLog(
  level: "info" | "warn" | "error",
  message: string,
): Promise<void> {
  try {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
    let existing = "";
    if (await exists(LOG_FILE, FS_OPTIONS)) {
      existing = await readTextFile(LOG_FILE, FS_OPTIONS);
      if (existing.length > MAX_BYTES) {
        existing = existing.slice(-MAX_BYTES / 2);
      }
    }
    await writeTextFile(LOG_FILE, existing + line, FS_OPTIONS);
  } catch (err) {
    console.error("[debugLog] failed to write:", err);
  }
}
