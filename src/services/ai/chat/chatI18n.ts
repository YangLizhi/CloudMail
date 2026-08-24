import { getUiLanguage } from "@/i18n";

export type QuickActionKind = "summarize" | "task" | "replies";

/**
 * Prompts sent to the AI when the user clicks a quick-action button or
 * uses a slash command. Follows the UI language setting.
 */
export function quickActionPrompt(kind: QuickActionKind): string {
  const zh = getUiLanguage() === "zh-CN";
  switch (kind) {
    case "summarize":
      return zh
        ? "请总结引用的邮件和附件：先给出 2-3 句核心概述，再用要点列出关键决定和待办事项，尽量完整，不要遗漏重要信息。"
        : "Summarize the referenced email(s) and attachment(s): start with a 2-3 sentence overview, then list key decisions and action items as bullet points. Be thorough and do not omit important details.";
    case "task":
      return zh
        ? "请从引用的邮件中提取最重要的一项待办任务，并以 [[VELO_TASK]] 块输出标题、描述、建议截止日期和优先级，供我确认后添加到任务列表。"
        : "Extract the most important actionable task from the referenced email(s) and output it as a [[VELO_TASK]] block with title, description, due date, and priority, so I can add it to my task list after confirmation.";
    case "replies":
      return zh
        ? "请根据引用的邮件给出 3 条语气不同的简短回复（专业、友好、简洁）。"
        : "Based on the referenced email(s), give 3 short reply options with different tones (professional, friendly, concise).";
  }
}

export interface MeetingRequestTextInput {
  title: string;
  durationMinutes: number;
  startWindowISO: string;
  endWindowISO: string;
  attendees?: string[];
  notes?: string;
}

export function meetingRequestUserText(req: MeetingRequestTextInput): string {
  const zh = getUiLanguage() === "zh-CN";
  const windowText = `${new Date(req.startWindowISO).toLocaleString()} - ${new Date(req.endWindowISO).toLocaleString()}`;
  if (zh) {
    const parts = [
      `安排一场会议“${req.title}”（${req.durationMinutes} 分钟）`,
      `时间范围：${windowText}`,
    ];
    if (req.attendees?.length) parts.push(`参会人：${req.attendees.join(", ")}`);
    if (req.notes) parts.push(`备注：${req.notes}`);
    return parts.join("。") + "。";
  }
  return `Schedule a meeting "${req.title}" (${req.durationMinutes} min) within ${windowText}${req.attendees?.length ? ` with ${req.attendees.join(", ")}` : ""}${req.notes ? `. Notes: ${req.notes}` : ""}`;
}

export function schedulingIntentReply(): string {
  return getUiLanguage() === "zh-CN"
    ? "我来帮你安排会议。请在弹窗中填写标题、时长和时间范围，我会为你找到最合适的空闲时段。"
    : "I'll help you schedule a meeting. Please fill in the title, duration, and time window in the dialog, then I'll find the best available slots.";
}

export function meetingFoundReply(title: string, count: number): string {
  return getUiLanguage() === "zh-CN"
    ? `我为“${title}”找到了 ${count} 个可选时段，选择其中一个即可创建会议。`
    : `I found ${count} possible time slot(s) for "${title}". Pick one below to create the meeting.`;
}

export function meetingNotFoundReply(title: string): string {
  return getUiLanguage() === "zh-CN"
    ? `在所选时间范围内没有为“${title}”找到合适的时段。`
    : `I could not find a suitable slot for "${title}" in the requested window.`;
}

export function meetingFailedReply(message: string): string {
  return getUiLanguage() === "zh-CN"
    ? `会议排程失败：${message}`
    : `Meeting scheduling failed: ${message}`;
}

export function invalidMeetingWindowMessage(): string {
  return getUiLanguage() === "zh-CN"
    ? "会议时间范围无效（结束时间必须晚于开始时间）"
    : "Invalid meeting window";
}

export function noCalendarMessage(): string {
  return getUiLanguage() === "zh-CN"
    ? "当前账号未配置日历，请先在账号设置中添加 Google 或 CalDAV 日历。"
    : "No calendar is configured for the active account. Add a Google or CalDAV calendar first.";
}

export function noUpcomingEventsMessage(): string {
  return getUiLanguage() === "zh-CN"
    ? "未来 14 天内没有找到即将到来的日程。"
    : "I don't see any upcoming events in the next 14 days.";
}

export function attachmentExtractFailedMessage(): string {
  return getUiLanguage() === "zh-CN"
    ? "无法从该附件中提取文本。可能尚未缓存，或该文件类型不支持文本提取。"
    : "Could not extract text from this attachment. It may not be cached, or the file type is not supported for text extraction.";
}
