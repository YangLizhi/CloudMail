import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Paperclip } from "lucide-react";
import {
  getAttachmentsForAccount,
  getAttachmentsForThread,
} from "@/services/db/attachments";
import { useAiChatStore } from "@/services/ai/chat/chatStore";
import type { AttachmentRef } from "@/services/ai/chat/types";

interface Props {
  accountId: string;
  threadId: string | null;
  onClose: () => void;
}

export function AttachmentRefPicker({ accountId, threadId, onClose }: Props) {
  const addRefs = useAiChatStore((s) => s.addRefs);
  const [tab, setTab] = useState<"thread" | "library">(threadId ? "thread" : "library");
  const [threadAtts, setThreadAtts] = useState<
    { id: string; filename: string | null; mime_type: string | null; size: number | null; message_id: string; date: number | null }[]
  >([]);
  const [library, setLibrary] = useState<
    { id: string; filename: string | null; mime_type: string | null; size: number | null; message_id: string; date: number | null }[]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "thread" && threadId) {
        const rows = await getAttachmentsForThread(accountId, threadId);
        setThreadAtts(rows);
      } else {
        const rows = await getAttachmentsForAccount(accountId, 50);
        setLibrary(rows);
      }
    } catch (err) {
      console.error("Failed to load attachments:", err);
    } finally {
      setLoading(false);
    }
  }, [accountId, threadId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = tab === "thread" ? threadAtts : library;

  const handleAdd = () => {
    const refs: AttachmentRef[] = rows
      .filter((r) => selected.has(r.id))
      .map((r) => ({
        kind: "attachment",
        attachmentId: r.id,
        accountId,
        messageId: r.message_id,
        filename: r.filename,
        mimeType: r.mime_type,
        size: r.size,
      }));
    if (refs.length > 0) addRefs(refs);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-primary rounded-lg shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-primary">
          <Paperclip size={15} className="text-accent" />
          <span className="text-sm font-medium text-text-primary flex-1">Reference attachments</span>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        {threadId && (
          <div className="flex gap-1 px-4 pt-2">
            <button
              onClick={() => setTab("thread")}
              className={`px-2.5 py-1 text-xs rounded-md ${tab === "thread" ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-hover"}`}
            >
              Current thread
            </button>
            <button
              onClick={() => setTab("library")}
              className={`px-2.5 py-1 text-xs rounded-md ${tab === "library" ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-hover"}`}
            >
              Library
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && <div className="text-xs text-text-tertiary text-center py-6">Loading...</div>}
          {!loading && rows.length === 0 && (
            <div className="text-xs text-text-tertiary text-center py-6">No attachments found</div>
          )}
          {rows.map((r) => (
            <label key={r.id} className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-bg-hover cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-accent)]"
                checked={selected.has(r.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(r.id);
                  else next.delete(r.id);
                  setSelected(next);
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-text-primary truncate">{r.filename ?? "(unnamed)"}</div>
                <div className="text-[0.7rem] text-text-tertiary">
                  {r.mime_type ?? "unknown type"}
                  {r.size ? ` · ${(r.size / 1024).toFixed(0)} KB` : ""}
                  {r.date ? ` · ${new Date(r.date).toLocaleDateString()}` : ""}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-primary">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selected.size === 0}
            className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add ({selected.size})
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
