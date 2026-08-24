import { useEffect, useState } from "react";
import { Zap, Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import type { AgenticPlan } from "@/services/ai/chat/types";
import {
  resolveTargetThreads,
  executeAgenticPlan,
  validatePlan,
  type TargetThread,
  type AgenticExecutionResult,
} from "@/services/ai/agenticActions";

interface Props {
  plan: AgenticPlan;
  accountId: string;
}

const ACTION_LABELS: Record<string, string> = {
  archive: "Archive",
  trash: "Trash",
  markRead: "Mark read",
  markUnread: "Mark unread",
  star: "Star",
  unstar: "Unstar",
  applyLabel: "Apply label",
  removeLabel: "Remove label",
  moveToCategory: "Move to category",
  spam: "Report spam",
  snooze: "Snooze",
};

export function PlanActionCard({ plan, accountId }: Props) {
  const [targets, setTargets] = useState<TargetThread[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AgenticExecutionResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const validation = validatePlan(plan);
    if (validation) {
      setError(validation);
      return;
    }
    resolveTargetThreads(plan.query, accountId)
      .then((t) => {
        if (!cancelled) setTargets(t);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [plan, accountId]);

  if (dismissed) return null;

  const handleExecute = async () => {
    if (!targets || targets.length === 0 || executing) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await executeAgenticPlan(plan, targets);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-bg-secondary p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
        <Zap size={13} />
        AI action plan
      </div>
      <p className="text-xs text-text-primary leading-relaxed">{plan.description}</p>
      <div className="flex flex-wrap gap-1">
        {plan.actions.map((a, i) => (
          <span key={i} className="text-[0.65rem] px-1.5 py-0.5 rounded bg-bg-primary border border-border-secondary text-text-secondary">
            {ACTION_LABELS[a.type] ?? a.type}
            {a.params?.labelId ? `: ${a.params.labelId}` : ""}
            {a.params?.category ? `: ${a.params.category}` : ""}
          </span>
        ))}
      </div>

      {error && (
        <div className="text-[0.7rem] text-danger flex items-start gap-1">
          <XCircle size={12} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!error && targets && (
        <div className="text-[0.7rem] text-text-tertiary">
          {targets.length === 0
            ? "No emails matched the plan query."
            : `Will affect ${targets.length} thread(s). Preview:`}
          {targets.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {targets.slice(0, 5).map((t) => (
                <div key={t.threadId} className="flex items-center gap-1 truncate">
                  <ChevronRight size={10} className="shrink-0" />
                  <span className="truncate">{t.subject ?? "(no subject)"}</span>
                </div>
              ))}
              {targets.length > 5 && <div>...and {targets.length - 5} more</div>}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="text-[0.7rem] rounded-md border border-border-secondary p-2 space-y-1">
          <div className="flex items-center gap-1.5 text-success">
            <CheckCircle2 size={12} />
            {result.succeeded} succeeded, {result.failed} failed
          </div>
          {result.errors.slice(0, 5).map((e, i) => (
            <div key={i} className="text-danger truncate">{e}</div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleExecute}
          disabled={executing || !targets || targets.length === 0 || !!result}
          className="flex items-center gap-1 px-2.5 py-1 text-[0.7rem] rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {executing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
          {executing ? "Executing..." : result ? "Done" : "Confirm & execute"}
        </button>
        {!result && (
          <button
            onClick={() => setDismissed(true)}
            className="px-2.5 py-1 text-[0.7rem] rounded-md border border-border-secondary text-text-secondary hover:bg-bg-hover"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
