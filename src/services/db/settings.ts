import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { getDb } from "./connection";
import { encryptValue, decryptValue, isEncrypted } from "@/utils/crypto";

const SETTINGS_FILE = "cloudmail-settings.json";
const FS_OPTIONS = { baseDir: BaseDirectory.AppData };

type SettingsSection = Record<string, string>;
type SettingsTree = Record<string, SettingsSection>;

const SECTION_MAP: Record<string, string> = {
  theme: "appearance",
  font_size: "appearance",
  color_theme: "appearance",
  reduce_motion: "appearance",
  sidebar_collapsed: "appearance",
  contact_sidebar_visible: "appearance",
  reading_pane_position: "appearance",
  email_list_width: "appearance",
  email_density: "appearance",
  default_reply_mode: "appearance",
  mark_as_read_behavior: "appearance",
  send_and_archive: "appearance",
  inbox_view_mode: "appearance",
  task_sidebar_visible: "appearance",
  sidebar_nav_config: "appearance",
  language: "general",
  notifications_enabled: "notifications",
  undo_send_delay_seconds: "composer",
  block_remote_images: "security",
  phishing_detection_enabled: "security",
  phishing_sensitivity: "security",
  sync_period_days: "mail",
  attachment_cache_max_mb: "storage",
  smart_notifications: "notifications",
  notify_categories: "notifications",
  auto_archive_categories: "mail",
  auto_archive_after_unsubscribe: "mail",
  google_client_id: "accounts",
  google_client_secret: "accounts",
  active_account_id: "accounts",
  global_compose_shortcut: "shortcuts",
  ai_enabled: "ai",
  ai_provider: "ai",
  ai_auto_categorize: "ai",
  ai_auto_summarize: "ai",
  ai_auto_draft_enabled: "ai",
  ai_writing_style_enabled: "ai",
  claude_model: "ai",
  openai_model: "ai",
  gemini_model: "ai",
  ollama_model: "ai",
  ollama_server_url: "ai",
  copilot_model: "ai",
  custom_base_url: "ai",
  custom_model: "ai",
  claude_api_key: "ai",
  openai_api_key: "ai",
  gemini_api_key: "ai",
  copilot_api_key: "ai",
  custom_api_key: "ai",
  imap_attachment_repair_v1: "maintenance",
  ai_chat_visible: "ai",
  ai_chat_follow_email: "ai",
  ai_chat_input_height: "ai",
  ai_chat_width: "ai",
  auto_reply_rules: "autoReply",
  auto_reply_sent: "autoReply",
  claude_models_cache: "ai",
  openai_models_cache: "ai",
  gemini_models_cache: "ai",
  ollama_models_cache: "ai",
  copilot_models_cache: "ai",
  custom_models_cache: "ai",
  skills: "skills",
  skill_catalog_url: "skills",
  last_read_threads: "mail",
};

function sectionFor(key: string): string {
  return SECTION_MAP[key] ?? "general";
}

function normalizeFlat(flat: Record<string, string>): SettingsTree {
  const tree: SettingsTree = {};
  for (const [key, value] of Object.entries(flat)) {
    const section = sectionFor(key);
    if (!tree[section]) tree[section] = {};
    tree[section][key] = value;
  }
  return tree;
}

function flatFromTree(tree: SettingsTree): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const section of Object.values(tree)) {
    for (const [key, value] of Object.entries(section)) {
      flat[key] = value;
    }
  }
  return flat;
}

let cache: SettingsTree | null = null;
let flatCache: Record<string, string> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let migrationStarted = false;

async function ensureFile(): Promise<void> {
  try {
    await mkdir("", { ...FS_OPTIONS, recursive: true });
  } catch {
    // already exists
  }
  if (!(await exists(SETTINGS_FILE, FS_OPTIONS))) {
    await writeTextFile(SETTINGS_FILE, "{}", FS_OPTIONS);
  }
}

async function readTree(): Promise<SettingsTree> {
  if (cache) return cache;
  await ensureFile();
  try {
    const raw = await readTextFile(SETTINGS_FILE, FS_OPTIONS);
    const parsed = JSON.parse(raw || "{}") as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.values(parsed).some((v) => v && typeof v === "object" && !Array.isArray(v))
    ) {
      cache = parsed as SettingsTree;
    } else {
      cache = normalizeFlat(parsed as Record<string, string>);
    }
  } catch {
    cache = {};
  }
  return cache;
}

async function flush(): Promise<void> {
  await ensureFile();
  await writeTextFile(SETTINGS_FILE, JSON.stringify(cache ?? {}, null, 2), FS_OPTIONS);
}

async function migrateFromDbIfNeeded(): Promise<void> {
  if (migrationStarted) return;
  migrationStarted = true;

  const tree = await readTree();
  const flat = flatFromTree(tree);
  if (flat["__migrated_from_db__"] === "true") return;

  try {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings",
    );
    for (const row of rows) {
      if (!(row.key in flat)) {
        flat[row.key] = row.value;
      }
    }
  } catch (err) {
    console.warn("Failed to migrate DB settings to JSON:", err);
  }

  flat["__migrated_from_db__"] = "true";
  const next = normalizeFlat(flat);
  if (!next.general) next.general = {};
  next.general["__migrated_from_db__"] = "true";
  cache = next;
  flatCache = flat;
  await flush();
}

async function readFlat(): Promise<Record<string, string>> {
  if (flatCache) return flatCache;
  await migrateFromDbIfNeeded();
  const migrated = await readTree();
  flatCache = flatFromTree(migrated);
  return flatCache;
}

export async function getSetting(key: string): Promise<string | null> {
  const flat = await readFlat();
  return flat[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const prev = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    const tree = await readTree();
    const section = sectionFor(key);
    if (!tree[section]) tree[section] = {};
    tree[section][key] = value;
    cache = tree;
    if (flatCache) flatCache[key] = value;
    await flush();
  } finally {
    release();
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return { ...(await readFlat()) };
}

/**
 * Get a setting that is stored encrypted. Transparently decrypts the value.
 * Falls back to returning the raw value if decryption fails (e.g. not yet encrypted).
 */
export async function getSecureSetting(key: string): Promise<string | null> {
  const raw = await getSetting(key);
  if (!raw) return null;

  if (isEncrypted(raw)) {
    try {
      return await decryptValue(raw);
    } catch {
      // If decryption fails, the value may be plaintext (pre-encryption migration)
      return raw;
    }
  }
  return raw;
}

/**
 * Set a setting with encryption. The value is encrypted before storing.
 */
export async function setSecureSetting(key: string, value: string): Promise<void> {
  const encrypted = await encryptValue(value);
  await setSetting(key, encrypted);
}
