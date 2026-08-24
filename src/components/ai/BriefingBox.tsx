import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";

export function BriefingBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div className="rounded-lg border border-accent/40 bg-bg-secondary p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-accent">Meeting briefing</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[0.65rem] text-text-tertiary hover:text-text-primary"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <MarkdownContent content={text} />
      </div>
    </div>
  );
}
