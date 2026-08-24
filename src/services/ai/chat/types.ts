export interface EmailRef {
  kind: "email";
  messageId: string;
  threadId: string;
  accountId: string;
  subject: string | null;
  fromAddress: string | null;
  fromName: string | null;
  date: number;
  snippet: string | null;
}

export interface AttachmentRef {
  kind: "attachment";
  attachmentId: string;
  accountId: string;
  messageId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
}

export type ContextRef = EmailRef | AttachmentRef;

export type ChatMessageKind =
  | "text"
  | "plan"
  | "meeting"
  | "briefing"
  | "task"
  | "error";

export interface TaskPayload {
  title: string;
  description?: string | null;
  dueDate?: number | null; // Unix timestamp in seconds
  priority?: "none" | "low" | "medium" | "high" | "urgent";
}

export interface AgenticActionItem {
  type:
    | "archive"
    | "trash"
    | "markRead"
    | "markUnread"
    | "star"
    | "unstar"
    | "applyLabel"
    | "removeLabel"
    | "moveToCategory"
    | "spam"
    | "snooze";
  params?: {
    labelId?: string;
    category?: string;
    snoozeDuration?: number;
  };
}

export interface AgenticPlan {
  query: string;
  description: string;
  actions: AgenticActionItem[];
}

export interface MeetingSlot {
  startISO: string;
  endISO: string;
  reason: string;
  confidence: number;
}

export interface MeetingSuggestionResult {
  title: string;
  durationMinutes: number;
  slots: MeetingSlot[];
  attendees: string[];
  notes: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind: ChatMessageKind;
  contextRefs: ContextRef[];
  createdAt: number;
  plan?: AgenticPlan;
  meeting?: MeetingSuggestionResult;
  briefing?: string;
  task?: TaskPayload;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  modelOverride?: string | null;
  skills?: string[];
}
