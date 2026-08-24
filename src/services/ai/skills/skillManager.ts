import { getSetting, setSetting } from "@/services/db/settings";
import { fetch } from "@tauri-apps/plugin-http";
import type { Skill } from "./types";

export const SKILLS_KEY = "skills";
export const CATALOG_URL_KEY = "skill_catalog_url";

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: "mail-triage",
    name: "Inbox Triage",
    version: "1.0.0",
    description:
      "Help decide what needs attention: rank emails by urgency, summarize status, and propose next actions.",
    author: "CloudMail",
    instructions:
      "When the user asks to triage or organize their inbox, rank referenced emails by urgency, group them by theme, and propose clear next actions. Never execute email actions without an explicit confirmation card.",
    tools: ["search", "email_actions"],
    risk: "read",
    builtin: true,
    enabled: true,
  },
  {
    id: "meeting-prep",
    name: "Meeting Prep",
    version: "1.0.0",
    description:
      "Prepare for meetings: agendas, attendee context, and pre-meeting briefings from related emails.",
    author: "CloudMail",
    instructions:
      "For meeting preparation requests, build an agenda with goals, background, suggested topics, and open questions. Base everything on referenced emails and calendar context only.",
    tools: ["calendar", "search"],
    risk: "read",
    builtin: true,
    enabled: true,
  },
  {
    id: "inbox-zero",
    name: "Inbox Zero",
    version: "1.0.0",
    description:
      "Process a batch of emails quickly: archive, reply, defer, or delete with a confirmation plan.",
    author: "CloudMail",
    instructions:
      "When the user wants to clear or process their inbox, propose a batch plan: which emails to archive/star/mark read/snooze, with a query that identifies them. Always output a VELO_PLAN block for confirmation.",
    tools: ["search", "email_actions"],
    risk: "write",
    builtin: true,
    enabled: true,
  },
  {
    id: "writing-polish",
    name: "Writing Polish",
    version: "1.0.0",
    description:
      "Improve tone, clarity, and conciseness of drafts and replies.",
    author: "CloudMail",
    instructions:
      "When polishing text, keep the original meaning, fix awkward phrasing, and match the tone the user asks for. Show the improved version and briefly note the main changes.",
    tools: [],
    risk: "read",
    builtin: true,
    enabled: true,
  },
  {
    id: "task-extractor",
    name: "Task Extractor",
    version: "1.0.0",
    description:
      "Turn action items from emails into structured tasks with priorities and due dates.",
    author: "CloudMail",
    instructions:
      "When extracting tasks, identify the single most important action item, propose a due date and priority, and present it as a [[VELO_TASK]] block with title, description, dueDate, and priority.",
    tools: ["tasks", "search"],
    risk: "read",
    builtin: true,
    enabled: true,
  },
];

export async function getInstalledSkills(): Promise<Skill[]> {
  const raw = await getSetting(SKILLS_KEY);
  if (!raw) {
    // First run: seed the built-in skill library
    await setSetting(SKILLS_KEY, JSON.stringify(BUILTIN_SKILLS));
    return BUILTIN_SKILLS.map((s) => ({ ...s }));
  }
  try {
    const parsed = JSON.parse(raw) as Skill[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore malformed
  }
  return [];
}

export async function saveInstalledSkills(skills: Skill[]): Promise<void> {
  await setSetting(SKILLS_KEY, JSON.stringify(skills));
}

export async function getEnabledSkills(): Promise<Skill[]> {
  const skills = await getInstalledSkills();
  return skills.filter((s) => s.enabled);
}

export async function getSkillById(id: string): Promise<Skill | null> {
  const skills = await getInstalledSkills();
  return skills.find((s) => s.id === id) ?? null;
}

export async function setSkillEnabled(
  id: string,
  enabled: boolean,
): Promise<Skill[]> {
  const skills = await getInstalledSkills();
  const next = skills.map((s) => (s.id === id ? { ...s, enabled } : s));
  await saveInstalledSkills(next);
  return next;
}

export async function installSkill(
  skill: Omit<Skill, "installedAt" | "builtin" | "enabled"> & {
    builtin?: boolean;
    enabled?: boolean;
  },
): Promise<Skill[]> {
  const skills = await getInstalledSkills();
  const existing = skills.find((s) => s.id === skill.id);
  if (existing) {
    const next = skills.map((s) =>
      s.id === skill.id
        ? {
            ...s,
            ...skill,
            enabled: true,
            installedAt: s.installedAt ?? Date.now(),
          }
        : s,
    );
    await saveInstalledSkills(next);
    return next;
  }
  const full: Skill = {
    ...skill,
    builtin: skill.builtin ?? false,
    enabled: skill.enabled ?? true,
    installedAt: Date.now(),
  };
  const next = [...skills, full];
  await saveInstalledSkills(next);
  return next;
}

export async function uninstallSkill(id: string): Promise<Skill[]> {
  const skills = await getInstalledSkills();
  const next = skills.filter((s) => s.id !== id);
  await saveInstalledSkills(next);
  return next;
}

export async function getCatalogUrl(): Promise<string> {
  return (await getSetting(CATALOG_URL_KEY)) ?? "";
}

export async function setCatalogUrl(url: string): Promise<void> {
  await setSetting(CATALOG_URL_KEY, url.trim());
}

function isSkillShape(v: unknown): v is Skill {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.description === "string" &&
    typeof s.instructions === "string" &&
    Array.isArray(s.tools)
  );
}

/**
 * Fetch a remote skill catalog (JSON array of Skill-like entries).
 * Throws a readable error when the URL is unreachable or malformed.
 */
export async function fetchRemoteCatalog(url: string): Promise<Skill[]> {
  if (!url.trim()) return [];
  const res = await fetch(url.trim());
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  const payload = (await res.json()) as unknown;
  const list = Array.isArray(payload)
    ? payload
    : (payload as { skills?: unknown[] }).skills;
  if (!Array.isArray(list)) {
    throw new Error("Catalog is not a JSON array");
  }
  const skills = list.filter(isSkillShape);
  if (skills.length === 0) {
    throw new Error("Catalog contains no valid skills");
  }
  return skills.map((s) => ({
    ...s,
    version: s.version || "0.0.0",
    author: s.author || "Unknown",
    risk: s.risk ?? "read",
    builtin: false,
    enabled: false,
  }));
}
