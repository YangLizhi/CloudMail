import type { ChatSession } from "./types";

const FILE_NAME = "cloudmail-chat.json";
const MAX_SESSIONS = 20;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureFile(): Promise<void> {
  const { exists, mkdir, writeTextFile, BaseDirectory } =
    await import("@tauri-apps/plugin-fs");
  const opts = { baseDir: BaseDirectory.AppData };
  try {
    await mkdir("", { ...opts, recursive: true });
  } catch {
    // already exists
  }
  if (!(await exists(FILE_NAME, opts))) {
    await writeTextFile(FILE_NAME, "[]", opts);
  }
}

export async function loadChatSessions(): Promise<ChatSession[]> {
  try {
    await ensureFile();
    const { readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const raw = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (Array.isArray(parsed)) {
      return parsed as ChatSession[];
    }
  } catch (err) {
    console.warn("Failed to load chat sessions:", err);
  }
  return [];
}

export function persistChatSessions(sessions: ChatSession[]): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flushChatSessions(sessions);
  }, 800);
}

async function flushChatSessions(sessions: ChatSession[]): Promise<void> {
  try {
    await ensureFile();
    const { writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    await writeTextFile(FILE_NAME, JSON.stringify(trimmed, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (err) {
    console.warn("Failed to persist chat sessions:", err);
  }
}
