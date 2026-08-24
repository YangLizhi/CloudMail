import { getUiLanguage } from "@/i18n";

const MAIL_NAMES: Record<string, { en: string; zh: string }> = {
  inbox: { en: "Inbox", zh: "收件箱" },
  starred: { en: "Starred", zh: "已加星标" },
  snoozed: { en: "Snoozed", zh: "稍后提醒" },
  sent: { en: "Sent", zh: "已发送" },
  drafts: { en: "Drafts", zh: "草稿" },
  trash: { en: "Trash", zh: "已删除" },
  spam: { en: "Spam", zh: "垃圾邮件" },
  all: { en: "All Mail", zh: "全部邮件" },
};

const CATEGORY_NAMES: Record<string, { en: string; zh: string }> = {
  Primary: { en: "Primary", zh: "主要" },
  Updates: { en: "Updates", zh: "更新" },
  Promotions: { en: "Promotions", zh: "促销" },
  Social: { en: "Social", zh: "社交" },
  Newsletters: { en: "Newsletters", zh: "订阅邮件" },
};

const SMART_FOLDER_NAMES: Record<string, { en: string; zh: string }> = {
  Unread: { en: "Unread", zh: "未读" },
  "Has Attachments": { en: "Has Attachments", zh: "有附件" },
  "Starred This Week": { en: "Starred This Week", zh: "本周已加星标" },
};

export function mailLabelDisplayName(label: string): string {
  const zh = getUiLanguage() === "zh-CN";
  const entry = MAIL_NAMES[label];
  return entry ? (zh ? entry.zh : entry.en) : label;
}

export function categoryDisplayName(cat: string): string {
  const zh = getUiLanguage() === "zh-CN";
  const entry = CATEGORY_NAMES[cat];
  return entry ? (zh ? entry.zh : entry.en) : cat;
}

export function smartFolderDisplayName(name: string): string {
  const zh = getUiLanguage() === "zh-CN";
  const entry = SMART_FOLDER_NAMES[name];
  return entry ? (zh ? entry.zh : entry.en) : name;
}
