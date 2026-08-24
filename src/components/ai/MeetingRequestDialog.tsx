import { useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarPlus } from "lucide-react";
import { useAiChatStore } from "@/services/ai/chat/chatStore";

interface Props {
  accountId: string;
  defaultTitle: string;
  onClose: () => void;
}

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingRequestDialog({ accountId, defaultTitle, onClose }: Props) {
  const requestMeeting = useAiChatStore((s) => s.requestMeeting);
  const busy = useAiChatStore((s) => s.busy);
  const [title, setTitle] = useState(defaultTitle);
  const [duration, setDuration] = useState(30);
  const [start, setStart] = useState(toLocalInput(Date.now() + 3600_000));
  const [end, setEnd] = useState(toLocalInput(Date.now() + 7 * 24 * 3600_000));
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Meeting title is required");
      return;
    }
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      setError("Meeting window is invalid (end must be after start)");
      return;
    }
    setError(null);
    await requestMeeting({
      accountId,
      title: title.trim(),
      durationMinutes: duration,
      startWindowISO: new Date(startMs).toISOString(),
      endWindowISO: new Date(endMs).toISOString(),
      attendees: attendees
        .split(/[,;，；\s]+/)
        .map((a) => a.trim())
        .filter((a) => a.includes("@")),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const inputCls =
    "w-full rounded-md border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent";
  const labelCls = "text-[0.7rem] text-text-tertiary mb-1 block";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-primary rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-primary">
          <CalendarPlus size={15} className="text-accent" />
          <span className="text-sm font-medium text-text-primary flex-1">Schedule a meeting with AI</span>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Project sync" />
          </div>
          <div>
            <label className={labelCls}>Duration</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Search window start</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Search window end</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Attendees (comma separated emails)</label>
            <input value={attendees} onChange={(e) => setAttendees(e.target.value)} className={inputCls} placeholder="a@example.com, b@example.com" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Agenda, context, location..." />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Working..." : "Find available times"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
