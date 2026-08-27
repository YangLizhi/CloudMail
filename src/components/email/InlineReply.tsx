import { useState, useCallback, useEffect, useRef } from "react";
import { TinyMceEditor, type RichTextEditorApi } from "@/components/composer/TinyMceEditor";
import { Reply, ReplyAll, Forward, Send, Maximize2, RotateCcw, X, Loader2 } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import { useComposerStore } from "@/stores/composerStore";
import { useUIStore } from "@/stores/uiStore";
import { sendEmail, archiveThread } from "@/services/emailActions";
import { buildRawEmail } from "@/utils/emailBuilder";
import { upsertContact } from "@/services/db/contacts";
import { getSetting } from "@/services/db/settings";
import { getDefaultSignature } from "@/services/db/signatures";
import { buildReplyQuote, buildForwardQuote } from "@/utils/emailQuote";
import {
  isAutoDraftEnabled,
  generateAutoDraft,
  regenerateAutoDraft,
  type AutoDraftMode,
} from "@/services/ai/writingStyleService";
import type { DbMessage } from "@/services/db/messages";
import type { Thread } from "@/stores/threadStore";

export type ReplyMode = "reply" | "replyAll" | "forward";

interface InlineReplyProps {
  thread: Thread;
  messages: DbMessage[];
  accountId: string;
  noReply?: boolean;
  /** Called whenever the inline reply opens/closes. Lets the parent hide the message list. */
  onModeChange?: (mode: ReplyMode | null) => void;
  onSent: () => void;
}

export function InlineReply({ thread, messages, accountId, noReply, onModeChange, onSent }: InlineReplyProps) {
  const [mode, setMode] = useState<ReplyMode | null>(null);
  const [sending, setSending] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState("");
  const [autoDraftLoading, setAutoDraftLoading] = useState(false);
  const [hasAutoDraft, setHasAutoDraft] = useState(false);
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<
    { filename: string; mimeType: string; content: string }[]
  >([]);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.id === accountId);
  const openComposer = useComposerStore((s) => s.openComposer);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDraftAbortRef = useRef(false);
  const editorRef = useRef<RichTextEditorApi | null>(null);
  const pendingQuoteRef = useRef<string | null>(null);
  const pendingDraftModeRef = useRef<AutoDraftMode | null>(null);

  const lastMessage = messages[messages.length - 1];

  // Report open/closed state to the parent (so ThreadView can hide the message list).
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const loadAutoDraft = useCallback(async (draftMode: AutoDraftMode) => {
    const ed = editorRef.current;
    if (!ed) return;
    autoDraftAbortRef.current = false;
    setAutoDraftLoading(true);
    try {
      const enabled = await isAutoDraftEnabled();
      if (!enabled || autoDraftAbortRef.current) return;

      const draft = await generateAutoDraft(thread.id, accountId, messages, draftMode);
      if (autoDraftAbortRef.current || !draft) return;

      // Only set content if the editor is still empty (user hasn't typed)
      if (ed.isEmpty()) {
        ed.setContent(draft);
        setHasAutoDraft(true);
      }
    } catch (err) {
      console.warn("Auto-draft generation failed:", err);
    } finally {
      setAutoDraftLoading(false);
    }
  }, [thread.id, accountId, messages]);

  const activateMode = useCallback((newMode: ReplyMode) => {
    if (!lastMessage) return;
    setMode(newMode);
    setAttachments([]);
    setHasAutoDraft(false);
    autoDraftAbortRef.current = true; // Cancel any in-flight draft
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);

    // Outlook-style recipient + subject prefill.
    const replyTo = lastMessage.reply_to ?? lastMessage.from_address;
    if (newMode === "reply") {
      setTo(replyTo ? [replyTo] : []);
      setCc([]);
      setSubject(composeSubject("Re", lastMessage.subject ?? ""));
    } else if (newMode === "replyAll") {
      const allTo = new Set<string>();
      if (replyTo) allTo.add(replyTo);
      if (lastMessage.to_addresses) {
        lastMessage.to_addresses.split(",").forEach((a) => allTo.add(a.trim()));
      }
      if (activeAccount?.email) allTo.delete(activeAccount.email);
      const ccList: string[] = [];
      if (lastMessage.cc_addresses) {
        lastMessage.cc_addresses.split(",").forEach((a) => {
          const tr = a.trim();
          if (tr && tr !== activeAccount?.email) ccList.push(tr);
        });
      }
      setTo(Array.from(allTo));
      setCc(ccList);
      setSubject(composeSubject("Re", lastMessage.subject ?? ""));
    } else {
      setTo([]);
      setCc([]);
      setSubject(composeSubject("Fwd", lastMessage.subject ?? ""));
    }

    // Seed the quoted original so the recipient always sees it (Outlook-style).
    const quote = newMode === "forward"
      ? buildForwardQuote(lastMessage)
      : buildReplyQuote(lastMessage);
    // The editor is not mounted while collapsed, so defer quoting + auto-draft
    // until TinyMCE reports ready (see <TinyMceEditor onReady> below).
    pendingQuoteRef.current = quote;
    pendingDraftModeRef.current =
      newMode === "reply" || newMode === "replyAll" ? newMode : null;
  }, [lastMessage, activeAccount?.email]);

  // Load default signature
  useEffect(() => {
    getDefaultSignature(accountId).then((sig) => {
      if (sig) setSignatureHtml(sig.body_html);
    });
  }, [accountId]);

  // Listen for inline reply events from keyboard shortcuts
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mode: ReplyMode } | undefined;
      if (detail?.mode) {
        activateMode(detail.mode);
      }
    };
    window.addEventListener("velo-inline-reply", handler);
    return () => window.removeEventListener("velo-inline-reply", handler);
  }, [activateMode]);

  // Scroll into view when activated
  useEffect(() => {
    if (mode && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [mode]);

  const handleSend = useCallback(async () => {
    const ed = editorRef.current;
    if (!activeAccount || !ed || sending) return;
    if (to.length === 0) return;

    setSending(true);
    try {
      let html = ed.getContent();
      if (signatureHtml) {
        html += `<div style="margin-top:16px;border-top:1px solid #e5e5e5;padding-top:12px">${signatureHtml}</div>`;
      }

      const raw = buildRawEmail({
        from: activeAccount.email,
        to,
        cc: cc.length > 0 ? cc : undefined,
        subject,
        htmlBody: html,
        inReplyTo: lastMessage?.id,
        threadId: thread.id,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Get undo send delay
      const delaySetting = await getSetting("undo_send_delay_seconds");
      const delay = parseInt(delaySetting ?? "5", 10) * 1000;

      const { setUndoSendVisible, setUndoSendTimer } = useComposerStore.getState();
      setUndoSendVisible(true);

      const timer = setTimeout(async () => {
        try {
          await sendEmail(accountId, raw, thread.id);

          // Send & archive: remove from inbox if enabled
          if (useUIStore.getState().sendAndArchive) {
            try { await archiveThread(accountId, thread.id, []); } catch { /* ignore */ }
          }

          // Update contacts frequency
          for (const addr of [...to, ...cc]) {
            await upsertContact(addr, null);
          }
        } catch (err) {
          console.error("Failed to send inline reply:", err);
        } finally {
          setUndoSendVisible(false);
        }
      }, delay);

      setUndoSendTimer(timer);

      // Reset state
      ed.setContent("", false);
      setAttachments([]);
      setMode(null);
      onSent();
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  }, [activeAccount, sending, to, cc, subject, signatureHtml, lastMessage, thread.id, accountId, mode, onSent, attachments]);

  const handleExpandToComposer = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || !lastMessage) return;
    const bodyHtml = ed.getContent();

    openComposer({
      mode: mode === "forward" ? "forward" : mode === "replyAll" ? "replyAll" : "reply",
      to,
      cc,
      subject,
      bodyHtml,
      threadId: thread.id,
      inReplyToMessageId: lastMessage.id,
    });

    // Reset inline state
    ed.setContent("", false);
    setMode(null);
  }, [lastMessage, to, cc, subject, mode, thread.id, openComposer]);

  const handleRegenerateDraft = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed || !mode || mode === "forward") return;
    autoDraftAbortRef.current = false;
    setAutoDraftLoading(true);
    try {
      const draft = await regenerateAutoDraft(thread.id, accountId, messages, mode);
      if (autoDraftAbortRef.current || !draft) return;
      ed.setContent(draft);
      setHasAutoDraft(true);
    } catch (err) {
      console.warn("Auto-draft regeneration failed:", err);
    } finally {
      setAutoDraftLoading(false);
    }
  }, [mode, thread.id, accountId, messages]);

  const handleClearDraft = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.setContent("", false);
    setHasAutoDraft(false);
    ed.focus();
  }, []);

  const handleInsertAttachment = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] ?? "";
      setAttachments((prev) => [
        ...prev,
        {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          content: base64,
        },
      ]);
    };
    reader.readAsDataURL(file);
  }, []);

  // Cleanup focus timer on unmount
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      autoDraftAbortRef.current = true;
    };
  }, []);

  // Handle Ctrl+Enter to send, Escape to close
  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        editorRef.current?.setContent("", false);
        setAttachments([]);
        setMode(null);
        setHasAutoDraft(false);
        autoDraftAbortRef.current = true;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, handleSend]);

  if (!lastMessage) return null;

  // Collapsed state — show reply buttons
  if (!mode) {
    return (
      <div ref={containerRef} className="mx-4 my-3 flex items-center gap-2">
        <button
          onClick={() => activateMode("reply")}
          disabled={noReply}
          title={noReply ? "This sender does not accept replies" : undefined}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-primary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary"
        >
          <Reply size={14} />
          Reply
        </button>
        <button
          onClick={() => activateMode("replyAll")}
          disabled={noReply}
          title={noReply ? "This sender does not accept replies" : undefined}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-primary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary"
        >
          <ReplyAll size={14} />
          Reply All
        </button>
        <button
          onClick={() => activateMode("forward")}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-primary rounded-lg hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Forward size={14} />
          Forward
        </button>
      </div>
    );
  }

  // Expanded state — editor visible

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 bg-white flex flex-col overflow-hidden"
    >
      {/* Header row: send/cancel rail on the left, recipients+subject on the right */}
      <div className="relative flex shrink-0">
        <div className="w-16 absolute inset-y-0 left-0 border-r border-border-secondary bg-bg-secondary flex flex-col items-center gap-2 py-2 px-1">
          <button
            onClick={handleSend}
            disabled={sending || to.length === 0}
            className="w-full flex flex-col items-center justify-center gap-1 py-2 rounded-md text-xs font-medium text-white bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            <span>发送</span>
          </button>
          <button
            onClick={() => {
              setMode(null);
              setAttachments([]);
            }}
            className="w-full py-1 text-xs text-text-tertiary hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
          >
            取消
          </button>
        </div>

        <div className="flex-1 min-w-0 pl-16">
          {/* Recipients */}
          <div className="px-3 py-2 border-b border-border-secondary space-y-1.5 bg-bg-primary">
            <EmailField label="收件人" values={to} onChange={setTo} placeholder="recipient@example.com" />
            <EmailField label="抄送" values={cc} onChange={setCc} placeholder="cc@example.com" />
          </div>

          {/* Original subject, editable */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-secondary bg-bg-primary">
            <span className="text-xs text-text-tertiary w-12 shrink-0">主题</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none"
              placeholder="主题"
            />
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 min-h-[200px] overflow-hidden">
        <TinyMceEditor
          fillContainer
          placeholder="Write your reply..."
          onInsertAttachment={handleInsertAttachment}
          onReady={(api) => {
            editorRef.current = api;
            // Deferred first-mount fill: quote the original thread and focus.
            if (pendingQuoteRef.current !== null) {
              api.setContent(pendingQuoteRef.current, false);
              api.raw()?.selection?.setCursorLocation?.(api.raw()?.getBody?.(), 0);
              api.focus();
              pendingQuoteRef.current = null;
            }
            // Deferred auto-draft for reply/replyAll (not forward).
            const draftMode = pendingDraftModeRef.current;
            if (draftMode) {
              pendingDraftModeRef.current = null;
              loadAutoDraft(draftMode);
            }
          }}
        />
        {autoDraftLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              Generating draft...
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center px-3 py-2 border-t border-border-secondary bg-bg-secondary shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpandToComposer}
            title="Expand to full composer"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Maximize2 size={12} />
            Expand
          </button>
          {hasAutoDraft && mode !== "forward" && (
            <>
              <button
                onClick={handleRegenerateDraft}
                disabled={autoDraftLoading}
                title="Regenerate AI draft"
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-accent transition-colors disabled:opacity-50"
              >
                <RotateCcw size={11} />
                Regenerate
              </button>
              <button
                onClick={handleClearDraft}
                title="Clear AI draft"
                className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-danger transition-colors"
              >
                <X size={11} />
                Clear
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Prefix a subject with Re:/Fwd: unless it already has one. */
function composeSubject(prefix: "Re" | "Fwd", sub: string): string {
  return sub.startsWith(`${prefix}:`) ? sub : `${prefix}: ${sub}`;
}

/** Editable comma-separated email field (parsed on blur / Enter). */
function EmailField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(values.join(", "));

  // Keep the input in sync when the mode prefill changes (e.g. new reply).
  useEffect(() => {
    setText(values.join(", "));
  }, [values]);

  const commit = () => {
    const parsed = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(parsed);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-tertiary w-12 shrink-0">{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="flex-1 bg-transparent text-sm text-text-primary outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}
