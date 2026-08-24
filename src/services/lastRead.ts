import { getSetting, setSetting } from "@/services/db/settings";

const KEY = "last_read_threads";

/**
 * Persisted map: navigation key ("label" or "label:category" for split
 * inbox) -> thread id of the last opened email in that category.
 */
export async function getLastReadThreads(): Promise<Record<string, string>> {
  const raw = await getSetting(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore malformed
  }
  return {};
}

export async function setLastReadThread(
  key: string,
  threadId: string,
): Promise<void> {
  const map = await getLastReadThreads();
  map[key] = threadId;
  await setSetting(KEY, JSON.stringify(map));
}
