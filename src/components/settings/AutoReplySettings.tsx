import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Reply, Loader2 } from "lucide-react";
import { useAccountStore } from "@/stores/accountStore";
import {
  getAutoReplyRules,
  saveAutoReplyRules,
  upsertAutoReplyRule,
  deleteAutoReplyRule,
  getAutoReplyCount,
  type AutoReplyRule,
} from "@/services/autoreply/autoReplyManager";

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AutoReplySettings() {
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [editing, setEditing] = useState<AutoReplyRule | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await getAutoReplyRules();
      setRules(list);
      const next: Record<string, number> = {};
      for (const r of list) {
        next[r.id] = await getAutoReplyCount(r.id);
      }
      setCounts(next);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newRule = (): AutoReplyRule => ({
    id: crypto.randomUUID(),
    accountId: activeAccountId ?? accounts[0]?.id ?? "",
    name: "",
    startAt: Date.now(),
    endAt: Date.now() + 7 * 24 * 3600_000,
    subject: "",
    bodyHtml: "",
    active: true,
    createdAt: Date.now(),
  });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.accountId || !editing.name.trim() || !editing.bodyHtml.trim()) return;
    const next = {
      ...editing,
      name: editing.name.trim(),
      subject: editing.subject?.trim() || null,
    };
    await upsertAutoReplyRule(next);
    setEditing(null);
    await refresh();
  };

  const handleToggleActive = async (rule: AutoReplyRule) => {
    await upsertAutoReplyRule({ ...rule, active: !rule.active });
    await refresh();
  };

  const handleDeactivateAll = async () => {
    const next = rules.map((r) => ({ ...r, active: false }));
    await saveAutoReplyRules(next);
    await refresh();
  };

  const inputCls =
    "w-full rounded-md border border-border-secondary bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent";
  const labelCls = "text-[0.7rem] text-text-tertiary mb-1 block";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          Automatically reply to new inbox emails while a rule is active. Each sender receives at most one reply per rule.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          {rules.some((r) => r.active) && (
            <button
              onClick={() => void handleDeactivateAll()}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-danger/40 text-danger hover:bg-danger/10"
            >
              <Reply size={12} />
              Deactivate all
            </button>
          )}
          <button
            onClick={() => setEditing(newRule())}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover"
          >
            <Plus size={12} />
            New rule
          </button>
        </div>
      </div>

      {loading && rules.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary py-6 justify-center">
          <Loader2 size={13} className="animate-spin" />
          Loading...
        </div>
      )}

      {editing && (
        <div className="border border-accent/40 rounded-lg p-4 space-y-3 bg-bg-secondary">
          <div className="flex items-center gap-2">
            <Reply size={14} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">
              {rules.some((r) => r.id === editing.id) ? "Edit rule" : "New rule"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className={inputCls}
                placeholder="e.g. Summer vacation"
              />
            </div>
            <div>
              <label className={labelCls}>Account</label>
              <select
                value={editing.accountId}
                onChange={(e) => setEditing({ ...editing, accountId: e.target.value })}
                className={inputCls}
              >
                {accounts
                  .filter((a) => a.provider !== "caldav")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start</label>
              <input
                type="datetime-local"
                value={toLocalInput(editing.startAt)}
                onChange={(e) => setEditing({ ...editing, startAt: new Date(e.target.value).getTime() })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End</label>
              <input
                type="datetime-local"
                value={toLocalInput(editing.endAt)}
                onChange={(e) => setEditing({ ...editing, endAt: new Date(e.target.value).getTime() })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Subject (empty = Re: original subject)</label>
            <input
              value={editing.subject ?? ""}
              onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
              className={inputCls}
              placeholder="e.g. Out of office"
            />
          </div>
          <div>
            <label className={labelCls}>Reply body (HTML supported)</label>
            <textarea
              value={editing.bodyHtml}
              onChange={(e) => setEditing({ ...editing, bodyHtml: e.target.value })}
              rows={4}
              className={inputCls}
              placeholder="Thanks for your email. I am out of the office until ..."
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="accent-accent"
              />
              Active
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!editing.name.trim() || !editing.bodyHtml.trim() || !editing.accountId}
                className="px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save rule
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && rules.length === 0 && !editing && (
        <div className="text-xs text-text-tertiary text-center py-8 border border-dashed border-border-secondary rounded-lg">
          No auto-reply rules yet. Create one to automatically respond while you are away.
        </div>
      )}

      {rules.map((rule) => {
        const now = Date.now();
        const inWindow = now >= rule.startAt && now <= rule.endAt;
        return (
          <div key={rule.id} className="py-3 px-4 bg-bg-secondary rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Reply size={14} className={rule.active ? "text-accent" : "text-text-tertiary"} />
              <span className="text-sm font-medium text-text-primary flex-1">{rule.name}</span>
              <span
                className={`text-[0.65rem] px-2 py-0.5 rounded-full ${
                  rule.active && inWindow
                    ? "bg-success/15 text-success"
                    : "bg-bg-tertiary text-text-tertiary"
                }`}
              >
                {rule.active && inWindow ? "Active now" : rule.active ? "Scheduled" : "Inactive"}
              </span>
              <button
                onClick={() => void handleToggleActive(rule)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                  rule.active ? "bg-accent" : "bg-bg-tertiary"
                }`}
                title={rule.active ? "Deactivate" : "Activate"}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    rule.active ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            <div className="text-[0.7rem] text-text-tertiary space-y-0.5">
              <div>
                {new Date(rule.startAt).toLocaleString()} → {new Date(rule.endAt).toLocaleString()}
              </div>
              <div>Subject: {rule.subject || "(Re: original)"}</div>
              <div>Replies sent: {counts[rule.id] ?? 0}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing({ ...rule })}
                className="text-xs px-2.5 py-1 rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  await deleteAutoReplyRule(rule.id);
                  await refresh();
                }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border-secondary text-text-secondary hover:text-danger hover:bg-bg-hover"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
