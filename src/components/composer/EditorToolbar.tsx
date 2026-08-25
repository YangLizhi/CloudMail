import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  Minus,
  Link,
  Image,
  Table,
  Paperclip,
  Undo2,
  Redo2,
  Sparkles,
} from "lucide-react";

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"];
const FONT_FAMILIES = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
  "宋体",
  "黑体",
  "微软雅黑",
];
const TEXT_COLORS = [
  "#000000",
  "#7f1d1d",
  "#9a3412",
  "#166534",
  "#1d4ed8",
  "#6d28d9",
  "#be185d",
  "#475569",
];
const HIGHLIGHT_COLORS = [
  "#fef08a",
  "#fecaca",
  "#bbf7d0",
  "#bfdbfe",
  "#ddd6fe",
  "#fbcfe8",
  "#ffffff",
];

interface EditorToolbarProps {
  editor: Editor | null;
  onToggleAiAssist?: () => void;
  aiAssistOpen?: boolean;
  onInsertAttachment?: (file: File) => void;
}

export function EditorToolbar({
  editor,
  onToggleAiAssist,
  aiAssistOpen,
  onInsertAttachment,
}: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Re-render on editor state changes so dropdowns/buttons reflect the cursor.
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const ed = ctx.editor!;
      return {
        fontFamily: (ed.getAttributes("textStyle").fontFamily as string) ?? "",
        fontSize: ((ed.getAttributes("textStyle").fontSize as string) ?? "").replace("px", ""),
        color: (ed.getAttributes("textStyle").color as string) ?? "",
        isBold: ed.isActive("bold"),
        isItalic: ed.isActive("italic"),
        isUnderline: ed.isActive("underline"),
        isStrike: ed.isActive("strike"),
        isH1: ed.isActive("heading", { level: 1 }),
        isH2: ed.isActive("heading", { level: 2 }),
        isH3: ed.isActive("heading", { level: 3 }),
        isBullet: ed.isActive("bulletList"),
        isOrdered: ed.isActive("orderedList"),
        isBlockquote: ed.isActive("blockquote"),
        isCodeBlock: ed.isActive("codeBlock"),
        isAlignLeft: ed.isActive({ textAlign: "left" }),
        isAlignCenter: ed.isActive({ textAlign: "center" }),
        isAlignRight: ed.isActive({ textAlign: "right" }),
        isAlignJustify: ed.isActive({ textAlign: "justify" }),
        isLink: ed.isActive("link"),
      };
    },
  });

  if (!editor || !state) return null;

  const setColor = (color: string) =>
    editor.chain().focus().setMark("textStyle", { color }).run();
  const unsetColor = () =>
    editor.chain().focus().unsetMark("textStyle").run();
  const setHighlight = (color: string) =>
    editor.chain().focus().setMark("highlight", { color }).run();
  const clearHighlight = () =>
    editor.chain().focus().unsetMark("highlight").run();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.chain().focus().setImage({ src: dataUrl }).run();
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onInsertAttachment) onInsertAttachment(file);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const insertTable = () =>
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();

  const btn = (
    isActive: boolean,
    onClick: () => void,
    title: string,
    children: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 text-xs rounded hover:bg-bg-hover transition-colors ${
        isActive ? "bg-accent/10 text-accent font-semibold" : "text-text-secondary"
      }`}
    >
      {children}
    </button>
  );

  const swatch = (
    color: string,
    title: string,
    onClick: () => void,
    isCurrent: boolean,
  ) => (
    <button
      key={color}
      type="button"
      title={title}
      onClick={onClick}
      className={`w-4 h-4 rounded-sm border ${
        isCurrent ? "ring-2 ring-accent" : "border-border-primary"
      } hover:scale-110 transition-transform shrink-0`}
      style={{ backgroundColor: color }}
    />
  );

  const sep = <div className="w-px h-4 bg-border-primary mx-1 shrink-0" />;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border-secondary bg-bg-secondary flex-wrap">
      {/* Font family */}
      <select
        title="Font family"
        value={state.fontFamily}
        onChange={(e) =>
          editor
            .chain()
            .focus()
            .setMark("textStyle", { fontFamily: e.target.value || null })
            .run()
        }
        className="h-7 text-xs bg-transparent text-text-secondary rounded px-1 max-w-[110px]"
      >
        <option value="">字体</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      {/* Font size */}
      <select
        title="Font size"
        value={state.fontSize}
        onChange={(e) =>
          editor
            .chain()
            .focus()
            .setMark("textStyle", {
              fontSize: e.target.value ? `${e.target.value}px` : null,
            })
            .run()
        }
        className="h-7 text-xs bg-transparent text-text-secondary rounded px-1 max-w-[64px]"
      >
        <option value="">字号</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Text color swatches (single click) */}
      {TEXT_COLORS.map((c) =>
        swatch(c, `Text ${c}`, () => setColor(c), state.color === c),
      )}
      {btn(!!state.color, unsetColor, "Reset text color", <span className="text-[10px] leading-none">A</span>)}

      {/* Highlight swatches (single click) */}
      {HIGHLIGHT_COLORS.map((c) =>
        swatch(c, `Highlight ${c}`, () => setHighlight(c), editor.isActive("highlight", { color: c })),
      )}
      {btn(false, clearHighlight, "Clear highlight", <span className="text-[10px] leading-none">H</span>)}

      {sep}

      {btn(state.isBold, () => editor.chain().focus().toggleBold().run(), "Bold", <Bold size={14} />)}
      {btn(state.isItalic, () => editor.chain().focus().toggleItalic().run(), "Italic", <Italic size={14} />)}
      {btn(state.isUnderline, () => editor.chain().focus().toggleUnderline().run(), "Underline", <Underline size={14} />)}
      {btn(state.isStrike, () => editor.chain().focus().toggleStrike().run(), "Strikethrough", <Strikethrough size={14} />)}

      {sep}

      {btn(state.isH1, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "Heading 1", <span className="text-[10px] font-bold">H1</span>)}
      {btn(state.isH2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading 2", <span className="text-[10px] font-bold">H2</span>)}
      {btn(state.isH3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Heading 3", <span className="text-[10px] font-bold">H3</span>)}

      {sep}

      {btn(state.isBullet, () => editor.chain().focus().toggleBulletList().run(), "Bulleted list", <List size={14} />)}
      {btn(state.isOrdered, () => editor.chain().focus().toggleOrderedList().run(), "Numbered list", <ListOrdered size={14} />)}
      {btn(state.isBlockquote, () => editor.chain().focus().toggleBlockquote().run(), "Quote", <Quote size={14} />)}
      {btn(state.isCodeBlock, () => editor.chain().focus().toggleCodeBlock().run(), "Code", <Code size={14} />)}

      {sep}

      {btn(state.isAlignLeft, () => editor.chain().focus().setTextAlign("left").run(), "Align left", <AlignLeft size={14} />)}
      {btn(state.isAlignCenter, () => editor.chain().focus().setTextAlign("center").run(), "Align center", <AlignCenter size={14} />)}
      {btn(state.isAlignRight, () => editor.chain().focus().setTextAlign("right").run(), "Align right", <AlignRight size={14} />)}
      {btn(state.isAlignJustify, () => editor.chain().focus().setTextAlign("justify").run(), "Justify", <AlignJustify size={14} />)}
      {btn(false, () => editor.chain().focus().indent().run(), "Increase indent", <IndentIncrease size={14} />)}
      {btn(false, () => editor.chain().focus().outdent().run(), "Decrease indent", <IndentDecrease size={14} />)}

      {sep}

      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "Horizontal rule", <Minus size={14} />)}
      {btn(state.isLink, () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          setShowLinkDialog(true);
        }
      }, "Link", <Link size={14} />)}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      {btn(false, () => imageInputRef.current?.click(), "Insert image", <Image size={14} />)}
      {btn(false, insertTable, "Insert table", <Table size={14} />)}

      {onInsertAttachment && (
        <>
          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentSelect}
          />
          {btn(false, () => attachmentInputRef.current?.click(), "Insert attachment", <Paperclip size={14} />)}
        </>
      )}

      <div className="flex-1" />

      {onToggleAiAssist && (
        <button
          type="button"
          onClick={onToggleAiAssist}
          title="AI Assist"
          className={`px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors flex items-center gap-1 ${
            aiAssistOpen ? "bg-accent/10 text-accent font-semibold" : "text-text-secondary"
          }`}
        >
          <Sparkles size={12} />
          AI
        </button>
      )}

      {btn(false, () => editor.chain().focus().undo().run(), "Undo", <Undo2 size={14} />)}
      {btn(false, () => editor.chain().focus().redo().run(), "Redo", <Redo2 size={14} />)}

      {showLinkDialog && (
        <div className="absolute z-30 mt-1 bg-bg-primary border border-border-primary rounded-md shadow-lg px-3 py-2 right-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const url = (
                e.currentTarget.elements.namedItem("url") as HTMLInputElement
              )?.value;
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
              setShowLinkDialog(false);
            }}
            className="flex items-center gap-2"
          >
            <input
              name="url"
              type="text"
              placeholder="https://..."
              autoFocus
              className="px-2 py-1 text-xs text-text-primary bg-transparent border border-border-primary rounded outline-none w-64"
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setShowLinkDialog(false)}
              className="px-2 py-1 text-xs text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
