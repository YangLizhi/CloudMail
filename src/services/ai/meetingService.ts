import { getCalendarEventsInRange } from "@/services/db/calendarEvents";
import { getCalendarsForAccount } from "@/services/db/calendars";
import { getCalendarProvider, hasCalendarSupport } from "@/services/calendar/providerFactory";
import { searchMessages } from "@/services/db/search";
import { runOneShot } from "./chat/chatService";
import type { MeetingSuggestionResult, MeetingSlot } from "./chat/types";
import {
  noCalendarMessage,
  noUpcomingEventsMessage,
  invalidMeetingWindowMessage,
} from "./chat/chatI18n";

interface BusyBlock {
  start: number;
  end: number;
  summary: string | null;
}

const SLOT_BUFFER_MS = 5 * 60 * 1000;

async function getBusyBlocks(
  accountId: string,
  startMs: number,
  endMs: number,
): Promise<BusyBlock[]> {
  const events = await getCalendarEventsInRange(
    accountId,
    Math.floor(startMs / 1000),
    Math.floor(endMs / 1000),
  );
  return events.map((e) => ({
    start: e.start_time * 1000,
    end: e.end_time * 1000,
    summary: e.summary,
  }));
}

function parseSlots(raw: string): MeetingSlot[] | null {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { slots?: MeetingSlot[] } | MeetingSlot[];
    const slots = Array.isArray(parsed) ? parsed : parsed.slots;
    if (!Array.isArray(slots)) return null;
    return slots
      .filter(
        (s) =>
          s &&
          typeof s.startISO === "string" &&
          typeof s.endISO === "string" &&
          !Number.isNaN(Date.parse(s.startISO)) &&
          !Number.isNaN(Date.parse(s.endISO)),
      )
      .slice(0, 5);
  } catch {
    return null;
  }
}

function overlapsBusy(slot: MeetingSlot, busy: BusyBlock[]): boolean {
  const start = Date.parse(slot.startISO);
  const end = Date.parse(slot.endISO);
  return busy.some(
    (b) => start < b.end + SLOT_BUFFER_MS && end > b.start - SLOT_BUFFER_MS,
  );
}

export interface MeetingRequest {
  accountId: string;
  title: string;
  durationMinutes: number;
  startWindowISO: string;
  endWindowISO: string;
  attendees?: string[];
  notes?: string;
}

/**
 * Propose meeting times within a window, avoiding existing calendar events.
 */
export async function suggestMeetingTimes(
  req: MeetingRequest,
): Promise<MeetingSuggestionResult> {
  const hasCal = await hasCalendarSupport(req.accountId);
  const windowStart = Date.parse(req.startWindowISO);
  const windowEnd = Date.parse(req.endWindowISO);
  if (Number.isNaN(windowStart) || Number.isNaN(windowEnd) || windowEnd <= windowStart) {
    throw new Error(invalidMeetingWindowMessage());
  }

  let busy: BusyBlock[] = [];
  if (hasCal) {
    busy = await getBusyBlocks(req.accountId, windowStart, windowEnd);
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const busyText =
    busy.length > 0
      ? busy
          .map(
            (b) =>
              `${new Date(b.start).toLocaleString()} - ${new Date(b.end).toLocaleString()} (${b.summary ?? "busy"})`,
          )
          .join("\n")
      : "(no existing events)";

  const systemPrompt = `You are a meeting scheduling assistant. The user's local timezone is ${tz}.
Return ONLY a JSON object in this exact shape:
{"slots":[{"startISO":"...","endISO":"...","reason":"short reason","confidence":0.9}]}
Propose 3-5 slots inside the requested window, each matching the requested duration.
Slots must NOT overlap any busy block. Prefer normal working hours unless the user asked otherwise.
startISO/endISO must be valid ISO 8601 timestamps in the user's local timezone.`;

  const userContent = `Meeting title: ${req.title}
Duration: ${req.durationMinutes} minutes
Window: ${new Date(windowStart).toLocaleString()} to ${new Date(windowEnd).toLocaleString()}
Attendees: ${(req.attendees ?? []).join(", ") || "(unknown)"}
Notes: ${req.notes ?? "(none)"}

Existing busy blocks (local time):
${busyText}`;

  const raw = await runOneShot(systemPrompt, userContent);
  const slots = parseSlots(raw) ?? [];
  const valid = slots
    .filter((s) => {
      const start = Date.parse(s.startISO);
      const end = Date.parse(s.endISO);
      return (
        start >= windowStart - 60_000 &&
        end <= windowEnd + 60_000 &&
        end - start >= req.durationMinutes * 60_000 * 0.9 &&
        !overlapsBusy(s, busy)
      );
    })
    .slice(0, 5);

  return {
    title: req.title,
    durationMinutes: req.durationMinutes,
    slots: valid,
    attendees: req.attendees ?? [],
    notes: req.notes ?? null,
  };
}

/**
 * Create a calendar event from a chosen slot.
 */
export async function createMeetingFromSuggestion(
  accountId: string,
  result: MeetingSuggestionResult,
  slot: MeetingSlot,
): Promise<{ success: boolean; message: string }> {
  try {
    const provider = await getCalendarProvider(accountId);
    const calendars = await getCalendarsForAccount(accountId);
    const primary = calendars.find((c) => c.is_primary === 1) ?? calendars[0];
    const calendarId = primary?.remote_id ?? "primary";
    await provider.createEvent(calendarId, {
      summary: result.title,
      description: result.notes ?? undefined,
      startTime: new Date(slot.startISO).toISOString(),
      endTime: new Date(slot.endISO).toISOString(),
      attendees: result.attendees.map((email) => ({ email })),
    });
    return { success: true, message: "Meeting created" };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Answer natural-language questions about the calendar (e.g. "when is my
 * next meeting?") based on local calendar events.
 */
export async function answerCalendarQuestion(
  accountId: string,
  question: string,
): Promise<string> {
  const hasCal = await hasCalendarSupport(accountId);
  if (!hasCal) {
    return noCalendarMessage();
  }
  const now = Date.now();
  const events = await getCalendarEventsInRange(
    accountId,
    Math.floor(now / 1000),
    Math.floor((now + 14 * 24 * 3600_000) / 1000),
  );
  if (events.length === 0) {
    return noUpcomingEventsMessage();
  }
  const eventText = events
    .map(
      (e) =>
        `${new Date(e.start_time * 1000).toLocaleString()} - ${new Date(e.end_time * 1000).toLocaleString()}: ${e.summary ?? "(no title)"}${e.location ? ` @ ${e.location}` : ""}`,
    )
    .join("\n");
  const systemPrompt = `You are a calendar assistant. Answer the user's question using ONLY the events listed below.
Be concise and specific, including dates/times. If the answer is not in the list, say so.`;
  return runOneShot(systemPrompt, `Upcoming events:\n${eventText}\n\nQuestion: ${question}`);
}

/**
 * Generate a pre-meeting briefing/agenda: event details + related emails.
 */
export async function generateMeetingBriefing(
  accountId: string,
  event: {
    id: string;
    summary: string | null;
    description: string | null;
    location: string | null;
    startTime: number;
    endTime: number;
    attendeesJson: string | null;
  },
): Promise<string> {
  const attendees: string[] = [];
  try {
    const parsed = JSON.parse(event.attendeesJson ?? "[]") as { email?: string }[];
    for (const a of parsed) {
      if (a.email) attendees.push(a.email);
    }
  } catch {
    // ignore
  }

  const startMs = event.startTime * 1000;
  const endMs = event.endTime * 1000;
  const windowStart = Math.floor((startMs - 7 * 24 * 3600_000) / 1000);
  const windowEnd = Math.floor((endMs + 24 * 3600_000) / 1000);

  const keyword = (event.summary ?? "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4);
  const related: string[] = [];

  for (const email of attendees.slice(0, 5)) {
    const hits = await searchMessages(`from:${email}`, accountId, 8);
    for (const h of hits) {
      if (h.date >= windowStart && h.date <= windowEnd) {
        related.push(
          `${new Date(h.date * 1000).toLocaleString()} | From: ${h.from_name ?? h.from_address} | ${h.subject ?? ""}\n${h.snippet ?? ""}`,
        );
      }
    }
  }
  if (related.length === 0 && keyword.length > 0) {
    const hits = await searchMessages(keyword.join(" "), accountId, 10);
    for (const h of hits) {
      if (h.date >= windowStart && h.date <= windowEnd) {
        related.push(
          `${new Date(h.date * 1000).toLocaleString()} | From: ${h.from_name ?? h.from_address} | ${h.subject ?? ""}\n${h.snippet ?? ""}`,
        );
      }
    }
  }

  const systemPrompt = `You are a meeting preparation assistant.
Generate a concise pre-meeting briefing in Markdown with sections:
## 会议目标 / Meeting goals, ## 背景 / Background, ## 议程建议 / Suggested agenda, ## 关注点 / Points to watch.
Base everything ONLY on the event details and related emails provided. If there is not enough context, say so instead of inventing.`;

  const userContent = `Meeting: ${event.summary ?? "(no title)"}
When: ${new Date(startMs).toLocaleString()} - ${new Date(endMs).toLocaleString()}
Location: ${event.location ?? "-"}
Description: ${event.description ?? "-"}
Attendees: ${attendees.join(", ") || "-"}

Related emails:
${related.slice(0, 20).join("\n---\n") || "(none found)"}`;

  return runOneShot(systemPrompt, userContent);
}
