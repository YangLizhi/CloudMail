import { create } from "zustand";
import { getSetting, setSetting } from "@/services/db/settings";
import {
  loadChatSessions,
  persistChatSessions,
} from "./chatPersistence";
import { runChatTurn } from "./chatService";
import type {
  ChatMessage,
  ChatSession,
  ContextRef,
} from "./types";
import {
  suggestMeetingTimes,
  answerCalendarQuestion,
  type MeetingRequest,
} from "@/services/ai/meetingService";
import { useAccountStore } from "@/stores/accountStore";
import { getInstalledSkills } from "@/services/ai/skills/skillManager";
import {
  meetingRequestUserText,
  schedulingIntentReply,
  meetingFoundReply,
  meetingNotFoundReply,
  meetingFailedReply,
} from "./chatI18n";

const SCHEDULING_INTENT =
  /(安排|预约|约个|约一下|找个?时间|空闲时间|找时间|schedule|scheduling|free time|available times|book|arrange)/i;
const CALENDAR_QUESTION =
  /(日历|日程|会议|什么时候|下次|今天.*安排|本周.*安排|calendar|agenda|upcoming|when is my next|what (meetings|events)|next meeting)/i;

function isSchedulingIntent(text: string): boolean {
  return (
    /(安排|预约|约个|约一下|找个?时间|空闲|找时间|schedule|scheduling|find.*(time|slot)|free time|available|book.*meeting|arrange)/i.test(
      text,
    ) ||
    (SCHEDULING_INTENT.test(text) && text.length < 120)
  );
}

function isCalendarQuestion(text: string): boolean {
  if (isSchedulingIntent(text)) return false;
  return CALENDAR_QUESTION.test(text);
}

function uid(): string {
  return crypto.randomUUID();
}

interface AiChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  followEmail: boolean;
  autoRefs: ContextRef[];
  manualRefs: ContextRef[];
  busy: boolean;
  error: string | null;
  initialized: boolean;
  init: () => Promise<void>;
  newSession: () => void;
  deleteSession: (id: string) => void;
  selectSession: (id: string) => void;
  setFollowEmail: (v: boolean) => void;
  setAutoRefs: (refs: ContextRef[]) => void;
  addRefs: (refs: ContextRef[]) => void;
  removeRef: (refId: string) => void;
  clearManualRefs: () => void;
  sendMessage: (text: string) => Promise<void>;
  sendQuickAction: (prompt: string) => Promise<void>;
  requestMeeting: (req: MeetingRequest) => Promise<void>;
  setSessionModel: (modelId: string | null) => void;
  toggleSessionSkill: (skillId: string) => void;
  clearError: () => void;
}

function effectiveRefs(
  followEmail: boolean,
  autoRefs: ContextRef[],
  manualRefs: ContextRef[],
): ContextRef[] {
  const seen = new Set<string>();
  const out: ContextRef[] = [];
  const push = (ref: ContextRef) => {
    const key = ref.kind === "email" ? `e:${ref.threadId}` : `a:${ref.attachmentId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(ref);
  };
  if (followEmail) {
    for (const r of autoRefs) push(r);
  }
  for (const r of manualRefs) push(r);
  return out;
}

export const useAiChatStore = create<AiChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  followEmail: true,
  autoRefs: [],
  manualRefs: [],
  busy: false,
  error: null,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    const [sessions, followSetting] = await Promise.all([
      loadChatSessions(),
      getSetting("ai_chat_follow_email"),
    ]);
    const followEmail = followSetting !== "false";
    let active = sessions[0] ?? null;
    if (!active) {
      active = {
        id: uid(),
        title: "New chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
    }
    set({
      sessions,
      activeSessionId: active.id,
      followEmail,
      initialized: true,
    });
  },

  newSession: () => {
    const session: ChatSession = {
      id: uid(),
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      manualRefs: [],
      error: null,
    }));
    persistChatSessions(get().sessions);
  },

  deleteSession: (id) => {
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id);
      const activeSessionId =
        state.activeSessionId === id
          ? (sessions[0]?.id ?? null)
          : state.activeSessionId;
      return { sessions, activeSessionId };
    });
    persistChatSessions(get().sessions);
  },

  selectSession: (id) => {
    set({ activeSessionId: id, error: null });
  },

  setFollowEmail: (v) => {
    setSetting("ai_chat_follow_email", String(v)).catch(() => {});
    set({ followEmail: v });
  },

  setAutoRefs: (refs) => set({ autoRefs: refs }),

  addRefs: (refs) => {
    set((state) => ({
      manualRefs: [...state.manualRefs, ...refs],
      error: null,
    }));
  },

  removeRef: (refId) => {
    set((state) => ({
      manualRefs: state.manualRefs.filter((r) =>
        r.kind === "email" ? r.threadId !== refId : r.attachmentId !== refId,
      ),
    }));
  },

  clearManualRefs: () => set({ manualRefs: [] }),

  clearError: () => set({ error: null }),

  sendMessage: async (text) => {
    const state = get();
    if (!text.trim() || state.busy) return;
    await state.init();

    const sessionId = get().activeSessionId;
    const sessions = get().sessions;
    const session = sessions.find((s) => s.id === sessionId) ?? sessions[0];
    if (!session) {
      get().newSession();
      return get().sendMessage(text);
    }

    const refs = effectiveRefs(get().followEmail, get().autoRefs, get().manualRefs);
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      kind: "text",
      contextRefs: refs,
      createdAt: Date.now(),
    };

    const updated = {
      ...session,
      messages: [...session.messages, userMsg],
      updatedAt: Date.now(),
      title: session.title !== "New chat" ? session.title : text.slice(0, 60),
    };
    set({
      sessions: sessions.map((s) => (s.id === updated.id ? updated : s)),
      busy: true,
      error: null,
    });

    try {
      const history = updated.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));
      const accountId = useAccountStore.getState().activeAccountId;
      let assistant: ChatMessage;

      if (isSchedulingIntent(text)) {
        window.dispatchEvent(new CustomEvent("velo-open-meeting-dialog"));
        assistant = {
          id: uid(),
          role: "assistant",
          content: schedulingIntentReply(),
          kind: "text",
          contextRefs: refs,
          createdAt: Date.now(),
        };
      } else if (accountId && isCalendarQuestion(text)) {
        const answer = await answerCalendarQuestion(accountId, text);
        assistant = {
          id: uid(),
          role: "assistant",
          content: answer,
          kind: "text",
          contextRefs: refs,
          createdAt: Date.now(),
        };
      } else {
        const installed = await getInstalledSkills();
        const selectedSkillIds = new Set(updated.skills ?? []);
        const skills = installed.filter(
          (s) => s.enabled && selectedSkillIds.has(s.id),
        );
        assistant = await runChatTurn({
          history: history.slice(0, -1),
          userText: text,
          refs,
          modelOverride: updated.modelOverride ?? undefined,
          skills,
        });
      }
      const final = {
        ...updated,
        messages: [...updated.messages, assistant],
        updatedAt: Date.now(),
      };
      set((st) => ({
        sessions: st.sessions.map((s) => (s.id === final.id ? final : s)),
        busy: false,
      }));
      persistChatSessions(get().sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: message,
        kind: "error",
        contextRefs: refs,
        createdAt: Date.now(),
        error: message,
      };
      set((st) => ({
        sessions: st.sessions.map((s) =>
          s.id === updated.id
            ? { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() }
            : s,
        ),
        busy: false,
        error: message,
      }));
      persistChatSessions(get().sessions);
    }
  },

  sendQuickAction: async (prompt) => {
    await get().sendMessage(prompt);
  },

  requestMeeting: async (req) => {
    const state = get();
    if (state.busy) return;
    await state.init();

    const sessions = get().sessions;
    const session = sessions.find((s) => s.id === get().activeSessionId) ?? sessions[0];
    if (!session) {
      get().newSession();
      return get().requestMeeting(req);
    }

    const userText = meetingRequestUserText(req);
    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: userText,
      kind: "text",
      contextRefs: [],
      createdAt: Date.now(),
    };
    const updated = {
      ...session,
      messages: [...session.messages, userMsg],
      updatedAt: Date.now(),
      title: session.title !== "New chat" ? session.title : userText.slice(0, 60),
    };
    set({
      sessions: sessions.map((s) => (s.id === updated.id ? updated : s)),
      busy: true,
      error: null,
    });

    try {
      const result = await suggestMeetingTimes(req);
      const assistant: ChatMessage = {
        id: uid(),
        role: "assistant",
        content:
          result.slots.length > 0
            ? meetingFoundReply(result.title, result.slots.length)
            : meetingNotFoundReply(result.title),
        kind: "meeting",
        contextRefs: [],
        createdAt: Date.now(),
        meeting: result,
      };
      const final = {
        ...updated,
        messages: [...updated.messages, assistant],
        updatedAt: Date.now(),
      };
      set((st) => ({
        sessions: st.sessions.map((s) => (s.id === final.id ? final : s)),
        busy: false,
      }));
      persistChatSessions(get().sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: meetingFailedReply(message),
        kind: "error",
        contextRefs: [],
        createdAt: Date.now(),
        error: message,
      };
      set((st) => ({
        sessions: st.sessions.map((s) =>
          s.id === updated.id
            ? { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() }
            : s,
        ),
        busy: false,
        error: message,
      }));
    }
  },

  setSessionModel: (modelId) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, modelOverride: modelId, updatedAt: Date.now() } : s,
      ),
    }));
    persistChatSessions(get().sessions);
  },

  toggleSessionSkill: (skillId) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;
    set((state) => ({
      sessions: state.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const skills = new Set(s.skills ?? []);
        if (skills.has(skillId)) skills.delete(skillId);
        else skills.add(skillId);
        return { ...s, skills: [...skills], updatedAt: Date.now() };
      }),
    }));
    persistChatSessions(get().sessions);
  },
}));
