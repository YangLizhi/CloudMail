import { useState } from "react";
import { CheckCircle2, ListTodo, Loader2 } from "lucide-react";
import { insertTask, getIncompleteTaskCount } from "@/services/db/tasks";
import { useTaskStore } from "@/stores/taskStore";
import type { TaskPayload } from "@/services/ai/chat/types";

interface Props {
  task: TaskPayload;
  accountId: string;
  threadId?: string | null;
}

const PRIORITY_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function TaskConfirmCard({ task, accountId, threadId }: Props) {
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (adding || done) return;
    setAdding(true);
    setError(null);
    try {
      await insertTask({
        accountId,
        title: task.title,
        description: task.description ?? null,
        priority: task.priority ?? "medium",
        dueDate: task.dueDate ?? null,
        threadId: threadId ?? null,
        threadAccountId: accountId,
      });
      const count = await getIncompleteTaskCount(accountId);
      useTaskStore.getState().setIncompleteCount(count);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="rounded-lg border border-accent/40 bg-bg-secondary p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
        <ListTodo size={13} />
        Task
      </div>
      <div className="text-xs font-medium text-text-primary">{task.title}</div>
      {task.description && (
        <div className="text-[0.7rem] text-text-secondary leading-relaxed">
          {task.description}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 text-[0.65rem]">
        <span className="px-1.5 py-0.5 rounded bg-bg-primary border border-border-secondary text-text-secondary">
          {task.priority ? PRIORITY_LABELS[task.priority] ?? task.priority : "None"}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-bg-primary border border-border-secondary text-text-secondary">
          {task.dueDate
            ? new Date(task.dueDate * 1000).toLocaleDateString()
            : "No due date"}
        </span>
      </div>
      {error && <div className="text-[0.7rem] text-danger">{error}</div>}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleAdd}
          disabled={adding || done}
          className="flex items-center gap-1 px-2.5 py-1 text-[0.7rem] rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? <Loader2 size={11} className="animate-spin" /> : done ? <CheckCircle2 size={11} /> : <ListTodo size={11} />}
          {adding ? "Adding..." : done ? "Added to tasks" : "Add to tasks"}
        </button>
      </div>
    </div>
  );
}
