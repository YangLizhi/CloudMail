import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

async function openExternal(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

interface Props {
  content: string;
}

/**
 * Render AI assistant output as formatted Markdown.
 * Raw HTML inside the markdown is escaped by react-markdown (no rehype-raw),
 * and links/images open externally instead of navigating the app window.
 */
export function MarkdownContent({ content }: Props) {
  return (
    <div className="markdown-body text-xs text-text-primary leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href) void openExternal(href);
              }}
              className="text-accent hover:text-accent-hover underline underline-offset-2"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <a
              href={src}
              onClick={(e) => {
                e.preventDefault();
                if (src) void openExternal(src);
              }}
              className="text-accent hover:text-accent-hover underline underline-offset-2 break-all"
            >
              {alt || src || "image"}
            </a>
          ),
          table: ({ children }) => (
            <table className="border-collapse w-full my-1.5 text-xs">
              {children}
            </table>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownContent);
