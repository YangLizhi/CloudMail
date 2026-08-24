import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Plus,
  Trash2,
  Mail,
  Paperclip,
  Eraser,
  Send,
  FileText,
  ListChecks,
  MessageSquare,
  CalendarPlus,
  Loader2,
  Pin,
  PinOff,
} from "lucide-react";
import { useAiChatStore } from "@/services/ai/chat/chatStore";
import { useUIStore } from "@/stores/uiStore";
import type { DbMessage } from "@/services/db/messages";
import type { EmailRef, ContextRef } from "@/services/ai/chat/types";
import { ContextRefChips } from "./ContextRefChips";
import { EmailRefPicker } from "./EmailRefPicker";
import { AttachmentRefPicker } from "./AttachmentRefPicker";
import { PlanActionCard } from "./PlanActionCard";
import { MeetingCard } from "./MeetingCard";
import { BriefingBox } from "./BriefingBox";
import { MeetingRequestDialog } from "./MeetingRequestDialog";
import { MarkdownContent } from "./MarkdownContent";
import { TaskConfirmCard } from "./TaskConfirmCard";
import { getActiveProviderName } from "@/services/ai/providerManager";
import { getModelsForProvider } from "@/services/ai/modelCatalog";
import { getInstalledSkills } from "@/services/ai/skills/skillManager";
import type { ModelInfo } from "@/services/ai/types";
import type { Skill } from "@/services/ai/skills/types";
import { getSetting, setSetting } from "@/services/db/settings";
import {
  quickActionPrompt,
  type QuickActionKind,
} from "@/services/ai/chat/chatI18n";

interface Props {
  threadId: string;
  accountId: string;
  messages: DbMessage[];
  subject: string | null;
}

export function AiChatSidebar({ threadId, accountId, messages, subject }: Props) {
  const init = useAiChatStore((s) => s.init);
  const sessions = useAiChatStore((s) => s.sessions);
  const activeSessionId = useAiChatStore((s) => s.activeSessionId);
  const selectSession = useAiChatStore((s) => s.selectSession);
  const newSession = useAiChatStore((s) => s.newSession);
  const deleteSession = useAiChatStore((s) => s.deleteSession);
  const followEmail = useAiChatStore((s) => s.followEmail);
  const setFollowEmail = useAiChatStore((s) => s.setFollowEmail);
  const autoRefs = useAiChatStore((s) => s.autoRefs);
  const manualRefs = useAiChatStore((s) => s.manualRefs);
  const setAutoRefs = useAiChatStore((s) => s.setAutoRefs);
  const removeRef = useAiChatStore((s) => s.removeRef);
  const clearManualRefs = useAiChatStore((s) => s.clearManualRefs);
  const busy = useAiChatStore((s) => s.busy);
  const sendMessage = useAiChatStore((s) => s.sendMessage);
  const sendQuickAction = useAiChatStore((s) => s.sendQuickAction);
  const setSessionModel = useAiChatStore((s) => s.setSessionModel);
  const toggleSessionSkill = useAiChatStore((s) => s.toggleSessionSkill);
  const setAiChatVisible = useUIStore((s) => s.setAiChatVisible);

  const [input, setInput] = useState("");
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [inputHeight, setInputHeight] = useState(84);
  const [popoverIndex, setPopoverIndex] = useState(0);
  const [panelWidth, setPanelWidth] = useState(340);
  const inputHeightRef = useRef<number>(84);
  const panelWidthRef = useRef<number>(340);
  const dragState = useRef<{ startY: number; startH: number } | null>(null);
  const widthDragState = useRef<{ startX: number; startW: number } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  // Restore saved input height
  useEffect(() => {
    getSetting("ai_chat_input_height").then((v) => {
      if (v) {
        const n = parseInt(v, 10);
        if (n >= 64 && n <= 360) {
          setInputHeight(n);
          inputHeightRef.current = n;
        }
      }
    });
  }, []);

  // Restore saved panel width
  useEffect(() => {
    getSetting("ai_chat_width").then((v) => {
      if (v) {
        const n = parseInt(v, 10);
        if (n >= 300 && n <= 640) {
          setPanelWidth(n);
          panelWidthRef.current = n;
        }
      }
    });
  }, []);

  // Load provider + model list for the chat model selector
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const name = await getActiveProviderName();
        if (cancelled) return;
        setProviderName(name);
        const { models: list } = await getModelsForProvider(name);
        if (!cancelled) setModels(list);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load installed (enabled) skills
  useEffect(() => {
    let cancelled = false;
    getInstalledSkills().then((skills) => {
      if (!cancelled) setAvailableSkills(skills.filter((s) => s.enabled));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for scheduling intent routed from the chat store
  useEffect(() => {
    const handler = () => setShowMeetingDialog(true);
    window.addEventListener("velo-open-meeting-dialog", handler);
    return () => window.removeEventListener("velo-open-meeting-dialog", handler);
  }, []);

  // Follow the currently open email: rebuild auto ref when thread/messages change
  useEffect(() => {
    if (!threadId || !accountId) return;
    const last = messages[messages.length - 1];
    const ref: EmailRef = {
      kind: "email",
      messageId: last?.id ?? threadId,
      threadId,
      accountId,
      subject: last?.subject ?? subject,
      fromAddress: last?.from_address ?? null,
      fromName: last?.from_name ?? null,
      date: last?.date ?? Date.now(),
      snippet: last?.snippet ?? null,
    };
    setAutoRefs([ref]);
  }, [threadId, accountId, messages, subject, setAutoRefs]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0] ?? null,
    [sessions, activeSessionId],
  );

  const effectiveRefs: ContextRef[] = useMemo(() => {
    const seen = new Set<string>();
    const out: ContextRef[] = [];
    const push = (r: ContextRef) => {
      const key = r.kind === "email" ? `e:${r.threadId}` : `a:${r.attachmentId}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(r);
    };
    if (followEmail) for (const r of autoRefs) push(r);
    for (const r of manualRefs) push(r);
    return out;
  }, [followEmail, autoRefs, manualRefs]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [activeSession?.messages.length, busy]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage(text);
  };

  const startInputDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startY: e.clientY, startH: inputHeight };
    const move = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const h = Math.min(
        360,
        Math.max(64, dragState.current.startH - (ev.clientY - dragState.current.startY)),
      );
      setInputHeight(h);
      inputHeightRef.current = h;
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSetting("ai_chat_input_height", String(inputHeightRef.current)).catch(() => {});
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  const startPanelWidthDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    widthDragState.current = { startX: e.clientX, startW: panelWidth };
    const move = (ev: MouseEvent) => {
      if (!widthDragState.current) return;
      const w = Math.min(
        640,
        Math.max(300, widthDragState.current.startW - (ev.clientX - widthDragState.current.startX)),
      );
      setPanelWidth(w);
      panelWidthRef.current = w;
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSetting("ai_chat_width", String(panelWidthRef.current)).catch(() => {});
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const quickActions: { kind: QuickActionKind; label: string; icon: React.ReactNode }[] = [
    { kind: "summarize", label: "Summarize", icon: <FileText size={12} /> },
    { kind: "task", label: "Task", icon: <ListChecks size={12} /> },
    { kind: "replies", label: "Replies", icon: <MessageSquare size={12} /> },
  ];

  // Slash-command style items shown when the user types / # or @
  const triggerMatch = useMemo(() => {
    const m = input.match(/(?:^|\s)([\/#@])([A-Za-z0-9_-]*)$/);
    return m ? { trigger: m[1]!, query: m[2]!.toLowerCase() } : null;
  }, [input]);

  type PopoverItem = {
    id: string;
    label: string;
    description?: string;
    kind: "skill" | "command";
    risk?: Skill["risk"];
    active?: boolean;
  };

  const popoverItems = useMemo<PopoverItem[]>(() => {
    if (!triggerMatch) return [];
    const q = triggerMatch.query;
    const sessionSkills = new Set(activeSession?.skills ?? []);
    const skillItems: PopoverItem[] = availableSkills
      .filter(
        (s) =>
          !q ||
          s.id.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      )
      .map((s) => ({
        id: s.id,
        label: s.name,
        description: s.description,
        kind: "skill" as const,
        risk: s.risk,
        active: sessionSkills.has(s.id),
      }));
    if (triggerMatch.trigger !== "/") return skillItems;
    const commands: PopoverItem[] = [
      { id: "cmd:summarize", label: "Summarize", kind: "command" },
      { id: "cmd:task", label: "Extract task", kind: "command" },
      { id: "cmd:replies", label: "Reply suggestions", kind: "command" },
      { id: "cmd:meeting", label: "Schedule meeting", kind: "command" },
      { id: "cmd:new", label: "New chat", kind: "command" },
      { id: "cmd:clear", label: "Clear refs", kind: "command" },
    ];
    const visibleCommands = commands.filter(
      (c) =>
        !q ||
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
    return [...visibleCommands, ...skillItems];
  }, [triggerMatch, availableSkills, activeSession]);

  const clearTrigger = () => {
    setInput((prev) => prev.replace(/(?:^|\s)[\/#@][\w-]*$/, ""));
    setPopoverIndex(0);
  };

  const selectPopoverItem = (item: PopoverItem) => {
    if (item.kind === "skill") {
      clearTrigger();
      toggleSessionSkill(item.id);
      return;
    }
    const cmd = item.id.split(":")[1];
    clearTrigger();
    switch (cmd) {
      case "summarize":
        void sendQuickAction(quickActionPrompt("summarize"));
        break;
      case "task":
        void sendQuickAction(quickActionPrompt("task"));
        break;
      case "replies":
        void sendQuickAction(quickActionPrompt("replies"));
        break;
      case "meeting":
        setShowMeetingDialog(true);
        break;
      case "new":
        newSession();
        break;
      case "clear":
        clearManualRefs();
        break;
    }
  };

  return (
    <div
      className="relative shrink-0 flex flex-col border-l border-border-secondary bg-bg-primary/70 backdrop-blur"
      style={{ width: panelWidth }}
    >
      {/* Left edge drag handle to resize the panel width */}
      <div
        onMouseDown={startPanelWidthDrag}
        className="absolute -left-1 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/40 active:bg-accent/60"
        title="Drag to resize panel"
      />
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-primary">
        <Sparkles size={15} className="text-accent" />
        <span className="text-sm font-semibold text-text-primary flex-1">AI Assistant</span>
        <button
          onClick={() => setAiChatVisible(false)}
          className="text-text-tertiary hover:text-text-primary"
          title="Close AI panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Session bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-secondary">
        <select
          value={activeSession?.id ?? ""}
          onChange={(e) => selectSession(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-xs text-text-primary outline-none border border-border-secondary rounded-md px-2 py-1"
          title="Conversations"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button
          onClick={newSession}
          className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-bg-hover"
          title="New conversation"
        >
          <Plus size={14} />
        </button>
        {activeSession && (
          <button
            onClick={() => deleteSession(activeSession.id)}
            className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover"
            title="Delete conversation"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Model selector (session-scoped override) */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-secondary">
        <span className="text-[0.65rem] text-text-tertiary shrink-0">Model</span>
        <select
          value={activeSession?.modelOverride ?? "__default__"}
          onChange={(e) => {
            const v = e.target.value;
            setSessionModel(v === "__default__" ? null : v);
          }}
          className="flex-1 min-w-0 bg-transparent text-xs text-text-primary outline-none border border-border-secondary rounded-md px-2 py-1"
          title="Session model (overrides the default in Settings > AI)"
        >
          <option value="__default__">Default (Settings)</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.id}
            </option>
          ))}
          {providerName === "ollama" && models.length === 0 && (
            <option value="__default__">(probe in Settings to list models)</option>
          )}
        </select>
      </div>

      {/* Active skills (non-interactive indicators; toggle via / # @ in the input) */}
      {(() => {
        const activeIds = new Set(activeSession?.skills ?? []);
        const activeNames = availableSkills
          .filter((s) => activeIds.has(s.id))
          .map((s) => s.name);
        if (activeNames.length === 0) return null;
        return (
          <div className="px-3 py-1.5 border-b border-border-secondary flex flex-wrap items-center gap-1">
            <span className="text-[0.6rem] text-text-tertiary">Skills:</span>
            {activeNames.map((name) => (
              <span
                key={name}
                className="text-[0.62rem] px-1.5 py-0.5 rounded-full border border-accent/40 bg-accent/10 text-accent"
              >
                {name}
              </span>
            ))}
          </div>
        );
      })()}

      {/* Context controls */}
      <div className="px-3 py-2 border-b border-border-secondary space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFollowEmail(!followEmail)}
            className={`flex items-center gap-1.5 text-[0.7rem] rounded-md px-2 py-1 border transition-colors ${
              followEmail
                ? "border-accent/50 text-accent bg-accent/10"
                : "border-border-secondary text-text-secondary hover:bg-bg-hover"
            }`}
            title="When on, the AI context follows the currently opened email"
          >
            {followEmail ? <Pin size={11} /> : <PinOff size={11} />}
            Follow current email
          </button>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setShowEmailPicker(true)}
              className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-bg-hover"
              title="Reference other emails"
            >
              <Mail size={14} />
            </button>
            <button
              onClick={() => setShowAttachmentPicker(true)}
              className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-bg-hover"
              title="Reference attachments"
            >
              <Paperclip size={14} />
            </button>
            {manualRefs.length > 0 && (
              <button
                onClick={clearManualRefs}
                className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-bg-hover"
                title="Clear manual references"
              >
                <Eraser size={14} />
              </button>
            )}
          </div>
        </div>
        <ContextRefChips
          refs={effectiveRefs}
          removable
          onRemove={(id) => removeRef(id)}
        />
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 border-b border-border-secondary flex flex-wrap gap-1">
        {quickActions.map((qa) => (
          <button
            key={qa.kind}
            onClick={() => void sendQuickAction(quickActionPrompt(qa.kind))}
            disabled={busy}
            className="flex items-center gap-1 text-[0.68rem] px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:text-accent hover:border-accent/50 hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {qa.icon}
            {qa.label}
          </button>
        ))}
        <button
          onClick={() => setShowMeetingDialog(true)}
          disabled={busy}
          className="flex items-center gap-1 text-[0.68rem] px-2 py-1 rounded-md border border-border-secondary text-text-secondary hover:text-accent hover:border-accent/50 hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CalendarPlus size={12} />
          Meeting
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {activeSession?.messages.length === 0 && (
          <div className="text-center text-xs text-text-tertiary pt-8 px-4 space-y-2">
            <Sparkles size={18} className="mx-auto text-accent/60" />
            <p>Chat with your email. Ask questions about the opened email, add more emails or attachments as references, or tell the AI to organize your inbox.</p>
          </div>
        )}
        {activeSession?.messages.map((m) => (
          <div key={m.id} className="space-y-1.5">
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent text-white px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : m.kind === "plan" && m.plan ? (
              <div className="max-w-[92%]">
                {m.content && (
                  <div className="mb-1.5">
                    <MarkdownContent content={m.content} />
                  </div>
                )}
                <PlanActionCard plan={m.plan} accountId={accountId} />
              </div>
            ) : m.kind === "meeting" && m.meeting ? (
              <div className="max-w-[92%]">
                {m.content && (
                  <div className="mb-1.5">
                    <MarkdownContent content={m.content} />
                  </div>
                )}
                <MeetingCard meeting={m.meeting} accountId={accountId} />
              </div>
            ) : m.kind === "briefing" ? (
              <div className="max-w-[92%]">
                <BriefingBox text={m.content} />
              </div>
            ) : m.kind === "task" && m.task ? (
              <div className="max-w-[92%]">
                {m.content && (
                  <div className="mb-1.5">
                    <MarkdownContent content={m.content} />
                  </div>
                )}
                <TaskConfirmCard
                  task={m.task}
                  accountId={accountId}
                  threadId={threadId}
                />
              </div>
            ) : m.kind === "error" ? (
              <div className="max-w-[92%] rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger leading-relaxed whitespace-pre-wrap">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] rounded-lg rounded-bl-sm bg-bg-secondary border border-border-secondary px-3 py-2">
                <MarkdownContent content={m.content} />
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 size={13} className="animate-spin text-accent" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 pb-2.5 pt-1 border-t border-border-primary">
        <div className="relative">
          {/* Drag handle to resize the input area */}
          <div
            onMouseDown={startInputDrag}
            className="h-2 mb-0.5 cursor-ns-resize rounded hover:bg-accent/30 active:bg-accent/50 flex items-center justify-center"
            title="Drag to resize input"
          >
            <div className="w-8 h-0.5 rounded bg-border-secondary" />
          </div>

          {/* / # @ suggestion popover */}
          {popoverItems.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border-primary bg-bg-primary shadow-xl z-20 py-1">
              {popoverItems.map((item, i) => (
                <button
                  key={item.id}
                  onMouseEnter={() => setPopoverIndex(i)}
                  onClick={() => selectPopoverItem(item)}
                  className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${
                    i === popoverIndex ? "bg-bg-hover" : ""
                  }`}
                >
                  {item.kind === "skill" ? (
                    <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
                  ) : (
                    <FileText size={13} className="mt-0.5 shrink-0 text-text-tertiary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-text-primary truncate">
                      {item.label}
                      {item.active && (
                        <span className="text-accent ml-1.5">· active</span>
                      )}
                    </span>
                    {item.description && (
                      <span className="block text-[0.65rem] text-text-tertiary truncate">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {item.risk && (
                    <span
                      className={`text-[0.55rem] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                        item.risk === "write"
                          ? "bg-warning/15 text-warning"
                          : item.risk === "network"
                            ? "bg-danger/15 text-danger"
                            : "bg-bg-tertiary text-text-tertiary"
                      }`}
                    >
                      {item.risk}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setPopoverIndex(0);
            }}
            onKeyDown={(e) => {
              if (popoverItems.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setPopoverIndex((i) => (i + 1) % popoverItems.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setPopoverIndex(
                    (i) => (i - 1 + popoverItems.length) % popoverItems.length,
                  );
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectPopoverItem(popoverItems[popoverIndex]!);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  clearTrigger();
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ height: inputHeight }}
            placeholder="Ask about the referenced email...  / # @ for skills"
            className="w-full resize-none bg-transparent text-xs text-text-primary outline-none placeholder:text-text-tertiary leading-relaxed"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[0.65rem] text-text-tertiary">
              Enter to send · Shift+Enter for newline · / # @ for skills
            </span>
            <button
              onClick={handleSend}
              disabled={!input.trim() || busy}
              className="p-1.5 rounded-md text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {showEmailPicker && (
        <EmailRefPicker accountId={accountId} onClose={() => setShowEmailPicker(false)} />
      )}
      {showAttachmentPicker && (
        <AttachmentRefPicker
          accountId={accountId}
          threadId={threadId}
          onClose={() => setShowAttachmentPicker(false)}
        />
      )}
      {showMeetingDialog && (
        <MeetingRequestDialog
          accountId={accountId}
          defaultTitle={subject ?? ""}
          onClose={() => setShowMeetingDialog(false)}
        />
      )}
    </div>
  );
}
