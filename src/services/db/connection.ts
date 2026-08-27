import Database from "@tauri-apps/plugin-sql";
import { exists, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

let db: Database | null = null;
let dbMigration: { promise: Promise<void>; resolve: () => void } | null = null;

/** Enter migration mode: block any getDb() until endDbMigration(). */
export function beginDbMigration(): Promise<void> {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  dbMigration = { promise, resolve };
  return promise;
}

/** Exit migration mode, releasing any waiting getDb() calls. */
export function endDbMigration(): void {
  const m = dbMigration;
  dbMigration = null;
  m?.resolve();
}

const DB_DIR_FILE = "cloudmail-db-dir.txt";
let customDbDir: string | null = null;
let customDbDirLoaded = false;

/** Remember the user-chosen DB directory for the running session. */
export function setCustomDbDir(dir: string | null): void {
  customDbDir = dir;
  customDbDirLoaded = true;
}

/** Decide which SQLite path to open: default root, or `data/` junction. */
async function resolveDbPath(): Promise<string> {
  if (!customDbDirLoaded) {
    customDbDirLoaded = true;
    try {
      if (await exists(DB_DIR_FILE, { baseDir: BaseDirectory.AppData })) {
        const content = (
          await readTextFile(DB_DIR_FILE, { baseDir: BaseDirectory.AppData })
        ).trim();
        customDbDir = content || null;
      }
    } catch {
      customDbDir = null;
    }
  }
  return customDbDir ? "sqlite:data/cloudmail.db" : "sqlite:cloudmail.db";
}

/** Close the current database connection (used before moving its file). */
export async function closeDb(): Promise<void> {
  if (!db) return;
  try {
    await db.close();
  } catch (err) {
    console.warn("Failed to close DB:", err);
  }
  db = null;
}

function isLockedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("database is locked") || msg.includes("database is busy");
}

export async function getDb(): Promise<Database> {
  if (dbMigration) {
    await dbMigration.promise;
  }
  if (!db) {
    const path = await resolveDbPath();
    const raw = await Database.load(path);
    try {
      await raw.execute("PRAGMA busy_timeout = 30000");
      await raw.execute("PRAGMA journal_mode = WAL");
    } catch (err) {
      console.warn("Failed to set SQLite pragmas:", err);
    }
    const wrapped = new Proxy(raw, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop === "execute" && typeof value === "function") {
          return async (...args: unknown[]) => {
            const maxRetries = 5;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
              try {
                return await value.apply(target, args);
              } catch (err) {
                if (isLockedError(err) && attempt < maxRetries - 1) {
                  await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
                  continue;
                }
                throw err;
              }
            }
          };
        }
        return value;
      },
    });
    db = wrapped as unknown as Database;
  }
  return db;
}

/**
 * Build a dynamic SQL UPDATE statement from a set of field updates.
 * Returns null if no fields to update.
 */
export function buildDynamicUpdate(
  table: string,
  idColumn: string,
  id: unknown,
  fields: [string, unknown][],
): { sql: string; params: unknown[] } | null {
  if (fields.length === 0) return null;

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [column, value] of fields) {
    sets.push(`${column} = $${idx++}`);
    params.push(value);
  }

  params.push(id);
  return {
    sql: `UPDATE ${table} SET ${sets.join(", ")} WHERE ${idColumn} = $${idx}`,
    params,
  };
}

/**
 * Serializes all DB write operations (transactions and single statements)
 * through one queue to avoid SQLite "database is locked" errors from
 * concurrent writers on different pool connections.
 */
let writeQueue: Promise<void> = Promise.resolve();

export async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function withTransaction(fn: (db: Database) => Promise<void>): Promise<void> {
  await runExclusive(async () => {
    const database = await getDb();
    await fn(database);
  });
}

/**
 * Execute a SELECT query and return the first result or null.
 */
export async function selectFirstBy<T>(
  query: string,
  params: unknown[] = [],
): Promise<T | null> {
  const db = await getDb();
  const rows = await db.select<T[]>(query, params);
  return rows[0] ?? null;
}

/**
 * Execute a COUNT(*) query and return whether any rows exist.
 */
export async function existsBy(
  query: string,
  params: unknown[] = [],
): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(query, params);
  return (rows[0]?.count ?? 0) > 0;
}

/**
 * Convert a boolean to SQLite integer (0 or 1).
 */
export function boolToInt(value: boolean | undefined | null): number {
  return value ? 1 : 0;
}
