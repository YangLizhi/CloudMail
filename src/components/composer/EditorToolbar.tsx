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
  PaintBucket,
  Eraser,
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
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const [palette, setPalette] = useState<"color" | "highlight" | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

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
  const clearColor = () =>
    editor.chain().focus().unsetMark("textStyle").run();
  const setHighlight = (color: string) =>
    editor.chain().focus().setMark("highlight", { color }).run();
  const clearHighlight = () =>
    editor.chain().focus().unsetMark("highlight").run();
  const clearFormatting = () => {
    editor.chain().focus().unsetMark("textStyle").unsetMark("highlight").run();
  };

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

  const pb = (
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
        isActive ? "bg-accent/10 text-accent" : "text-text-primary"
      }`}
    >
      {children}
    </button>
  );
  const sep = <div className="w-px h-4 bg-border-primary mx-1 shrink-0" />;
  const group = (children: React.ReactNode) => (
    <div className="flex items-center gap-0.5">{children}</div>
  );

  return (
    <div className="relative border-b border-border-secondary bg-bg-secondary">
      <div className="flex items-center gap-1 px-2 py-1 flex-wrap">
        {/* Font group */}
        {group(
          <>
            <select
              title="字体"
              value={state.fontFamily}
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .setMark("textStyle", { fontFamily: e.target.value || null })
                  .run()
              }
              className="h-7 text-xs bg-transparent text-text-primary rounded px-1 max-w-[104px] border border-border-primary"
            >
              <option value="">字体</option>
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              title="字号"
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
              className="h-7 text-xs bg-transparent text-text-primary rounded px-1 max-w-[62px] border border-border-primary"
            >
              <option value="">字号</option>
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {pb(false, clearFormatting, "清除格式", <Eraser size={14} />)}
          </>,
        )}

        {sep}

        {/* Character group */}
        {group(
          <>
            {pb(state.isBold, () => editor.chain().focus().toggleBold().run(), "加粗", <Bold size={14} />)}
            {pb(state.isItalic, () => editor.chain().focus().toggleItalic().run(), "斜体", <Italic size={14} />)}
            {pb(state.isUnderline, () => editor.chain().focus().toggleUnderline().run(), "下划线", <Underline size={14} />)}
            {pb(state.isStrike, () => editor.chain().focus().toggleStrike().run(), "删除线", <Strikethrough size={14} />)}
            {pb(
              !!state.color,
              () => setPalette(palette === "color" ? null : "color"),
              "字体颜色",
              <span className="relative inline-flex items-center">
                <span
                  className="text-sm font-bold leading-none"
                  style={{ color: state.color || "#1f2937" }}
                >
                  A
                </span>
                <span
                  className="absolute -bottom-1 left-0 right-0 h-0.5 rounded"
                  style={{ backgroundColor: state.color || "#1f2937" }}
                />
              </span>,
            )}
            {pb(
              false,
              () => setPalette(palette === "highlight" ? null : "highlight"),
              "高亮颜色",
              <PaintBucket size={14} />,
            )}
          </>,
        )}

        {sep}

        {/* Paragraph group */}
        {group(
          <>
            {pb(state.isH1, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), "标题 1", <span className="text-[10px] font-bold">H1</span>)}
            {pb(state.isH2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "标题 2", <span className="text-[10px] font-bold">H2</span>)}
            {pb(state.isH3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "标题 3", <span className="text-[10px] font-bold">H3</span>)}
            {pb(state.isBullet, () => editor.chain().focus().toggleBulletList().run(), "项目符号", <List size={14} />)}
            {pb(state.isOrdered, () => editor.chain().focus().toggleOrderedList().run(), "编号列表", <ListOrdered size={14} />)}
            {pb(state.isBlockquote, () => editor.chain().focus().toggleBlockquote().run(), "引用", <Quote size={14} />)}
            {pb(state.isCodeBlock, () => editor.chain().focus().toggleCodeBlock().run(), "代码", <Code size={14} />)}
          </>,
        )}

        {sep}

        {/* Alignment group */}
        {group(
          <>
            {pb(state.isAlignLeft, () => editor.chain().focus().setTextAlign("left").run(), "左对齐", <AlignLeft size={14} />)}
            {pb(state.isAlignCenter, () => editor.chain().focus().setTextAlign("center").run(), "居中", <AlignCenter size={14} />)}
            {pb(state.isAlignRight, () => editor.chain().focus().setTextAlign("right").run(), "右对齐", <AlignRight size={14} />)}
            {pb(state.isAlignJustify, () => editor.chain().focus().setTextAlign("justify").run(), "两端对齐", <AlignJustify size={14} />)}
            {pb(false, () => editor.chain().focus().indent().run(), "增加缩进", <IndentIncrease size={14} />)}
            {pb(false, () => editor.chain().focus().outdent().run(), "减少缩进", <IndentDecrease size={14} />)}
          </>,
        )}

        {sep}

        {/* Insert group */}
        {group(
          <>
            {pb(false, () => editor.chain().focus().setHorizontalRule().run(), "分隔线", <Minus size={14} />)}
            {pb(state.isLink, () => {
              if (editor.isActive("link")) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowLinkDialog(true);
              }
            }, "链接", <Link size={14} />)}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {pb(false, () => imageInputRef.current?.click(), "插入图片", <Image size={14} />)}
            {pb(false, insertTable, "插入表格", <Table size={14} />)}
            {onInsertAttachment && (
              <>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentSelect}
                />
                {pb(false, () => attachmentInputRef.current?.click(), "插入附件", <Paperclip size={14} />)}
              </>
            )}
          </>,
        )}

        <div className="flex-1" />

        {/* History group */}
        {group(
          <>
            {onToggleAiAssist && (
              <button
                type="button"
                onClick={onToggleAiAssist}
                title="AI 助手"
                className={`px-1.5 py-1 text-xs rounded hover:bg-bg-hover transition-colors flex items-center gap-1 ${
                  aiAssistOpen ? "bg-accent/10 text-accent" : "text-text-primary"
                }`}
              >
                <Sparkles size={12} />
                AI
              </button>
            )}
            {pb(false, () => editor.chain().focus().undo().run(), "撤销", <Undo2 size={14} />)}
            {pb(false, () => editor.chain().focus().redo().run(), "重做", <Redo2 size={14} />)}
          </>,
        )}
      </div>

      {/* Color / highlight palette popover */}
      {(palette === "color" || palette === "highlight") && (
        <div
          ref={paletteRef}
          className="absolute z-40 top-full left-2 mt-1 bg-bg-primary border border-border-primary rounded-md shadow-lg p-2"
        >
          <div className="flex items-center gap-1 flex-wrap">
            {(palette === "color" ? TEXT_COLORS : HIGHLIGHT_COLORS).map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  if (palette === "color") setColor(c);
                  else setHighlight(c);
                  setPalette(null);
                }}
                className={`w-5 h-5 rounded-sm border ${
                  (palette === "color" ? state.color : "") === c
                    ? "ring-2 ring-accent"
                    : "border-border-primary"
                } hover:scale-110 transition-transform`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (palette === "color") clearColor();
              else clearHighlight();
              setPalette(null);
            }}
            className="mt-2 w-full px-2 py-1 text-xs text-text-tertiary hover:text-text-primary rounded hover:bg-bg-hover"
          >
            清除{palette === "color" ? "字体颜色" : "高亮"}
          </button>
        </div>
      )}

      {/* Link dialog */}
      {showLinkDialog && (
        <div className="absolute z-40 top-full left-2 mt-1 bg-bg-primary border border-border-primary rounded-md shadow-lg px-3 py-2">
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
              插入
            </button>
            <button
              type="button"
              onClick={() => setShowLinkDialog(false)}
              className="px-2 py-1 text-xs text-text-tertiary hover:text-text-primary"
            >
              取消
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
