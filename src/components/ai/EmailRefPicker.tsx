import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search } from "lucide-react";
import { searchMessages } from "@/services/db/search";
import { useAiChatStore } from "@/services/ai/chat/chatStore";
import type { EmailRef } from "@/services/ai/chat/types";

interface Props {
  accountId: string;
  onClose: () => void;
}

export function EmailRefPicker({ accountId, onClose }: Props) {
  const addRefs = useAiChatStore((s) => s.addRefs);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { message_id: string; thread_id: string; subject: string | null; from_name: string | null; from_address: string | null; date: number; snippet: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || q.trim().length < 3) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const hits = await searchMessages(q.trim(), accountId, 20);
        setResults(hits);
      } catch (err) {
        console.error("Email ref search failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );

  const handleAdd = () => {
    const refs: EmailRef[] = results
      .filter((r) => selected.has(r.message_id))
      .map((r) => ({
        kind: "email",
        messageId: r.message_id,
        threadId: r.thread_id,
        accountId,
        subject: r.subject,
        fromAddress: r.from_address,
        fromName: r.from_name,
        date: r.date,
        snippet: r.snippet,
      }));
    if (refs.length > 0) {
      addRefs(refs);
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-bg-primary border border-border-primary rounded-lg shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-primary">
          <Search size={15} className="text-accent" />
          <span className="text-sm font-medium text-text-primary flex-1">
            Reference emails
          </span>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border-secondary">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              void runSearch(e.target.value);
            }}
            placeholder="Search emails (at least 3 characters)..."
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="text-xs text-text-tertiary text-center py-6">Searching...</div>
          )}
          {!loading && query.trim().length < 3 && (
            <div className="text-xs text-text-tertiary text-center py-6">
              Type at least 3 characters to search your inbox
            </div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 3 && (
            <div className="text-xs text-text-tertiary text-center py-6">
              No matching emails
            </div>
          )}
          {results.map((r) => (
            <label
              key={r.message_id}
              className="flex items-start gap-2 px-3 py-2 rounded-md hover:bg-bg-hover cursor-pointer"
            >
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-accent)]"
                checked={selected.has(r.message_id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(r.message_id);
                  else next.delete(r.message_id);
                  setSelected(next);
                }}
              />
              <div className="min-w-0">
                <div className="text-xs font-medium text-text-primary truncate">
                  {r.from_name ?? r.from_address ?? "Unknown"}
                  <span className="text-text-tertiary font-normal ml-1.5">
                    {new Date(r.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-text-secondary truncate">{r.subject ?? "(no subject)"}</div>
                {r.snippet && (
                  <div className="text-[0.7rem] text-text-tertiary line-clamp-1">{r.snippet}</div>
                )}
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
