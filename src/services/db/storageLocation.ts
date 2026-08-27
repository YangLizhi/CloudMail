import { invoke } from "@tauri-apps/api/core";
import { exists, readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { getDb, closeDb, setCustomDbDir, beginDbMigration, endDbMigration } from "./connection";

const DB_DIR_FILE = "cloudmail-db-dir.txt";
const FS_OPTIONS = { baseDir: BaseDirectory.AppData };

/** Current storage location label. "default" means the system AppData dir. */
export async function getDbLocation(): Promise<string> {
  try {
    if (await exists(DB_DIR_FILE, FS_OPTIONS)) {
      const content = (await readTextFile(DB_DIR_FILE, FS_OPTIONS)).trim();
      return content || "default";
    }
  } catch {
    // fall through
  }
  return "default";
}

/**
 * Move the mail database to `dir` using the Rust-side junction migration, then
 * reopen the DB. The old files are moved (deleted from the old location) so the
 * original drive space is freed.
 */
export async function setDbLocation(dir: string): Promise<void> {
  beginDbMigration();
  try {
    await closeDb();
    // Small grace period so any pooled handle is released before moving files.
    await new Promise((r) => setTimeout(r, 250));
    await invoke("set_db_location", { targetDir: dir });
    await writeTextFile(DB_DIR_FILE, dir, FS_OPTIONS);
    setCustomDbDir(dir);
  } finally {
    endDbMigration();
  }
  // Reopen the DB at the new location.
  await getDb();
}
