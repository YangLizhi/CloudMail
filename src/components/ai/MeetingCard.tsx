import { useState } from "react";
import { CalendarPlus, CheckCircle2, Loader2 } from "lucide-react";
import type { MeetingSlot, MeetingSuggestionResult } from "@/services/ai/chat/types";
import { createMeetingFromSuggestion } from "@/services/ai/meetingService";

interface Props {
  meeting: MeetingSuggestionResult;
  accountId: string;
}

export function MeetingCard({ meeting, accountId }: Props) {
  const [selected, setSelected] = useState<MeetingSlot | null>(meeting.slots[0] ?? null);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selected || creating) return;
    setCreating(true);
    setDone(null);
    try {
      const res = await createMeetingFromSuggestion(accountId, meeting, selected);
      if (res.success) {
        setDone(`Meeting created: ${new Date(selected.startISO).toLocaleString()} - ${new Date(selected.endISO).toLocaleString()}`);
      } else {
        setDone(`Failed to create meeting: ${res.message}`);
      }
    } catch (err) {
      setDone(`Failed to create meeting: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  if (meeting.slots.length === 0) {
    return (
      <div className="rounded-lg border border-border-secondary bg-bg-secondary p-3 text-xs text-text-secondary">
        No available time slots were found for "{meeting.title}".
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-bg-secondary p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
        <CalendarPlus size={13} />
        Meeting: {meeting.title}
      </div>
      <div className="space-y-1.5">
        {meeting.slots.map((slot) => {
          const active = selected?.startISO === slot.startISO;
          return (
            <button
              key={slot.startISO}
              onClick={() => setSelected(slot)}
              className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
                active
                  ? "border-accent bg-accent/10"
                  : "border-border-secondary bg-bg-primary hover:bg-bg-hover"
              }`}
            >
              <div className="text-xs font-medium text-text-primary">
                {new Date(slot.startISO).toLocaleString()} - {new Date(slot.endISO).toLocaleTimeString()}
              </div>
              <div className="text-[0.7rem] text-text-secondary mt-0.5">{slot.reason}</div>
              <div className="text-[0.65rem] text-text-tertiary mt-0.5">
                Confidence: {Math.round((slot.confidence ?? 0) * 100)}%
              </div>
            </button>
          );
        })}
      </div>
      {done && (
        <div className="flex items-start gap-1.5 text-[0.7rem] text-text-secondary">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success" />
          {done}
        </div>
      )}
      <button
        onClick={handleCreate}
        disabled={creating || !!done}
        className="flex items-center gap-1 px-2.5 py-1 text-[0.7rem] rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? <Loader2 size={11} className="animate-spin" /> : <CalendarPlus size={11} />}
        {creating ? "Creating..." : done ? "Created" : "Create meeting"}
      </button>
    </div>
  );
}
