import { Mail, Paperclip, X } from "lucide-react";
import type { ContextRef } from "@/services/ai/chat/types";

interface Props {
  refs: ContextRef[];
  removable?: boolean;
  onRemove?: (refId: string) => void;
}

export function ContextRefChips({ refs, removable, onRemove }: Props) {
  if (refs.length === 0) {
    return (
      <div className="text-[0.7rem] text-text-tertiary px-1 py-0.5">
        No email or attachment referenced
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {refs.map((ref) => {
        const isEmail = ref.kind === "email";
        const id = isEmail ? ref.threadId : ref.attachmentId;
        const label = isEmail
          ? (ref.subject ?? "(no subject)")
          : (ref.filename ?? "attachment");
        const sub = isEmail
          ? (ref.fromName ?? ref.fromAddress ?? "")
          : (ref.mimeType ?? "");
        return (
          <span
            key={`${ref.kind}:${id}`}
            className="inline-flex items-center gap-1.5 max-w-full bg-bg-secondary border border-border-secondary rounded-md px-2 py-1 text-[0.7rem] text-text-secondary"
          >
            {isEmail ? (
              <Mail size={11} className="text-accent shrink-0" />
            ) : (
              <Paperclip size={11} className="text-accent shrink-0" />
            )}
            <span className="truncate max-w-[160px]">{label}</span>
            {sub && <span className="text-text-tertiary truncate max-w-[80px]">· {sub}</span>}
            {removable && onRemove && (
              <button
                onClick={() => onRemove(id)}
                className="text-text-tertiary hover:text-text-primary shrink-0"
                aria-label="Remove reference"
              >
                <X size={11} />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
