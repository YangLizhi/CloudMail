import { useCallback, useEffect, useState } from "react";
import {
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import { useUIStore } from "@/stores/uiStore";
import { getDb } from "@/services/db/connection";
import { getUiLanguage } from "@/i18n";

interface LatestInboxRow {
  fromName: string | null;
  fromAddress: string | null;
  date: number | null;
  subject: string | null;
}

function formatRelativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const zh = getUiLanguage() === "zh-CN";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return zh ? "刚刚" : "just now";
  if (min < 60) return zh ? `${min} 分钟前` : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return zh ? `${h} 小时前` : `${h} hr ago`;
  return new Date(ts).toLocaleDateString();
}

function formatLastSync(ts: number): string {
  const zh = getUiLanguage() === "zh-CN";
  return `${zh ? "上次同步" : "Last sync"} ${new Date(ts).toLocaleTimeString()}`;
}

export function SyncStatusBar() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const isOnline = useUIStore((s) => s.isOnline);
  const syncStatus = useUIStore((s) => s.syncStatus);
  const [latest, setLatest] = useState<LatestInboxRow | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const refreshLatest = useCallback(async () => {
    if (!activeAccountId) {
      setLatest(null);
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select<LatestInboxRow[]>(
        `SELECT m.from_name as fromName, m.from_address as fromAddress, m.date, m.subject
         FROM messages m
         WHERE m.account_id = $1
           AND (m.imap_folder = 'INBOX' OR EXISTS (
             SELECT 1 FROM thread_labels tl
             WHERE tl.account_id = m.account_id
               AND tl.thread_id = m.thread_id
               AND tl.label_id = 'INBOX'
           ))
         ORDER BY m.date DESC
         LIMIT 1`,
        [activeAccountId],
      );
      setLatest(rows[0] ?? null);
    } catch {
      // ignore transient DB errors
    }
  }, [activeAccountId]);

  useEffect(() => {
    void refreshLatest();
    const onSyncDone = () => {
      setLastSyncAt(Date.now());
      void refreshLatest();
    };
    window.addEventListener("velo-sync-done", onSyncDone);
    const timer = setInterval(() => {
      setNow(Date.now());
      void refreshLatest();
    }, 30_000);
    return () => {
      window.removeEventListener("velo-sync-done", onSyncDone);
      clearInterval(timer);
    };
  }, [refreshLatest]);

  // Derive sync state from the text App provides
  let kind: "idle" | "syncing" | "done" | "error" = "idle";
  let progress = "";
  let errorText = "";
  if (syncStatus) {
    if (syncStatus.startsWith("Syncing")) {
      kind = "syncing";
      const m = syncStatus.match(/(\d+\/\d+)/);
      progress = m ? ` ${m[1]}` : "";
    } else if (syncStatus.startsWith("Sync failed")) {
      kind = "error";
      errorText = syncStatus.replace(/^Sync failed:?\s*/, "").slice(0, 90);
    } else {
      kind = "done";
    }
  }

  const zh = getUiLanguage() === "zh-CN";
  const statusLabel =
    kind === "syncing"
      ? `${zh ? "正在同步" : "Syncing"}${progress}…`
      : kind === "done"
        ? zh
          ? "同步完成"
          : "Sync complete"
        : kind === "error"
          ? `${zh ? "同步失败" : "Sync failed"}${errorText ? `: ${errorText}` : ""}`
          : zh
            ? "就绪"
            : "Ready";

  const sender = latest?.fromName || latest?.fromAddress;

  return (
    <div className="h-8 shrink-0 flex items-center gap-4 px-3 border-t border-border-primary bg-bg-primary/80 backdrop-blur text-[0.7rem] text-text-secondary overflow-hidden">
      {/* Sync status */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {kind === "syncing" ? (
          <Loader2 size={12} className="animate-spin text-accent shrink-0" />
        ) : kind === "done" ? (
          <CheckCircle2 size={12} className="text-success shrink-0" />
        ) : kind === "error" ? (
          <AlertTriangle size={12} className="text-danger shrink-0" />
        ) : (
          <CheckCircle2 size={12} className="text-text-tertiary shrink-0" />
        )}
        <span
          className={`truncate ${
            kind === "error" ? "text-danger" : kind === "done" ? "text-success" : ""
          }`}
          title={syncStatus ?? undefined}
        >
          {statusLabel}
        </span>
      </div>

      {/* Mailbox status */}
      <div className="flex items-center gap-1.5 shrink-0 max-w-[40%] min-w-0">
        {isOnline ? (
          <Wifi size={12} className="text-success shrink-0" />
        ) : (
          <WifiOff size={12} className="text-warning shrink-0" />
        )}
        <span className="truncate" title={activeAccount?.email}>
          {activeAccount?.email ?? (zh ? "未选择账号" : "No account")}
          {isOnline ? ` · ${zh ? "在线" : "online"}` : ` · ${zh ? "离线" : "offline"}`}
        </span>
        {lastSyncAt && (
          <span className="text-text-tertiary hidden md:inline">
            · {formatLastSync(lastSyncAt)}
          </span>
        )}
      </div>

      {/* Latest inbox message */}
      <div className="flex items-center gap-1.5 shrink-0 max-w-[38%] min-w-0">
        <Mail size={12} className="text-accent shrink-0" />
        {latest ? (
          <span className="truncate" title={latest.subject ?? undefined}>
            <span className="font-medium text-text-primary">{sender ?? "?"}</span>
            <span className="text-text-tertiary ml-1.5">
              {latest.date ? formatRelativeTime(latest.date, now) : ""}
            </span>
          </span>
        ) : (
          <span className="text-text-tertiary">
            {zh ? "暂无邮件" : "No emails yet"}
          </span>
        )}
      </div>
    </div>
  );
}
