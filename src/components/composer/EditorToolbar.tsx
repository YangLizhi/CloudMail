import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
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

  if (!editor) return null;

  const setColor = (color: string) =>
    editor.chain().focus().setMark("textStyle", { color }).run();
  const unsetColor = () =>
    editor.chain().focus().unsetMark("textStyle").run();
  const setHighlight = (color: string) =>
    editor.chain().focus().setMark("highlight", { color }).run();

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

  const sep = <div className="w-px h-4 bg-border-primary mx-1 shrink-0" />;
  const currentAttrs = editor.getAttributes("textStyle");

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border-secondary bg-bg-secondary flex-wrap">
      <select
        title="Font family"
        value={(currentAttrs.fontFamily as string) ?? ""}
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

      <select
        title="Font size"
        value={(currentAttrs.fontSize as string)?.replace("px", "") ?? ""}
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

      <input
        type="color"
        defaultValue="#000000"
        onChange={(e) => setColor(e.target.value)}
        className="h-7 w-7 border border-border-primary rounded cursor-pointer"
        title="Text color"
      />
      {btn(
        !!currentAttrs.color,
        unsetColor,
        "Reset text color",
        <span className="text-[10px] leading-none">A</span>,
      )}
      <input
        type="color"
        defaultValue="#fde047"
        onChange={(e) => setHighlight(e.target.value)}
        className="h-7 w-7 border border-border-primary rounded cursor-pointer"
        title="Highlight color"
      />

      {sep}

      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold", <Bold size={14} />)}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic", <Italic size={14} />)}
      {btn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline", <Underline size={14} />)}
      {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strikethrough", <Strikethrough size={14} />)}

      {sep}

      {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "Heading 1", <span className="text-[10px] font-bold">H1</span>)}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading 2", <span className="text-[10px] font-bold">H2</span>)}
      {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Heading 3", <span className="text-[10px] font-bold">H3</span>)}

      {sep}

      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bulleted list", <List size={14} />)}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Numbered list", <ListOrdered size={14} />)}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote", <Quote size={14} />)}
      {btn(editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "Code", <Code size={14} />)}

      {sep}

      {btn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), "Align left", <AlignLeft size={14} />)}
      {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), "Align center", <AlignCenter size={14} />)}
      {btn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), "Align right", <AlignRight size={14} />)}
      {btn(editor.isActive({ textAlign: "justify" }), () => editor.chain().focus().setTextAlign("justify").run(), "Justify", <AlignJustify size={14} />)}
      {btn(false, () => editor.chain().focus().indent().run(), "Increase indent", <IndentIncrease size={14} />)}
      {btn(false, () => editor.chain().focus().outdent().run(), "Decrease indent", <IndentDecrease size={14} />)}

      {sep}

      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "Horizontal rule", <Minus size={14} />)}
      {btn(editor.isActive("link"), () => {
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
          </form>
        </div>
      )}
    </div>
  );
}
