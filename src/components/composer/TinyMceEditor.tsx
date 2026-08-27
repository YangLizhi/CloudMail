import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { Editor as TinyMCE } from "@tinymce/tinymce-react";

// TinyMCE 6 (MIT, Apache-2.0 compatible) — bundle everything locally so the
// editor never fetches from a CDN at runtime (important for a local Tauri app).
import "tinymce/tinymce";
import "tinymce/themes/silver/theme.js";
import "tinymce/models/dom/model.js";
import "tinymce/icons/default/icons.js";
import "tinymce/plugins/advlist/plugin.js";
import "tinymce/plugins/lists/plugin.js";
import "tinymce/plugins/table/plugin.js";
import "tinymce/plugins/link/plugin.js";
import "tinymce/plugins/image/plugin.js";
import "tinymce/plugins/code/plugin.js";
import "tinymce/plugins/wordcount/plugin.js";
import "tinymce/plugins/autolink/plugin.js";
import "tinymce/plugins/searchreplace/plugin.js";
import "tinymce/plugins/nonbreaking/plugin.js";
import "tinymce/plugins/fullscreen/plugin.js";
import "tinymce/plugins/charmap/plugin.js";
import "tinymce/skins/ui/oxide/skin.min.css";
// Simplified-Chinese language pack (TinyMCE 6). Loaded after the core so
// window.tinymce exists, then every toolbar/dialog label becomes中文.
import "../../vendor/tinymce-zh-Hans";

// Scale TinyMCE's editor chrome (toolbar) from the default 16px icon size down
// to ~14px using container-level zoom. Zooming the whole header keeps icons
// intact (no clipped glyphs), which forcing svg width/height does not.
const TINY_SKIN_OVERRIDES = `
  .tox .tox-editor-header { zoom: 0.875; }
  .tox .tox-tbtn { height: 30px; padding: 2px 5px; }
  .tox .tox-split-button { height: 30px; min-width: 64px; padding: 0 2px; overflow: visible; }
  .tox .tox-split-button__chevron { width: 14px; min-width: 16px; display: flex; align-items: center; overflow: visible; }
  .tox .tox-tbtn--select { min-width: 0; max-width: 64px; padding: 2px 4px; }
  .tox .tox-tbtn__select-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 30px; }
  .tox .tox-toolbar select.tox-selectfield, .tox .tox-selectfield select { min-width: 0; max-width: 46px; }
  .tox .tox-toolbar__group { padding: 0 3px; }
  .tox .tox-collection__item { font-size: 12px; }
  .tox .tox-statusbar { font-size: 11px; }
  .mail-editor.h-full .tox-tinymce { height: 100% !important; }
  .mail-editor.h-full .tox .tox-edit-area { height: 100% !important; }
  .mail-editor.h-full .tox .tox-edit-area__iframe { height: 100% !important; }
`;

let tinySkinInjected = false;
function injectTinySkinOverrides() {
  if (tinySkinInjected || typeof document === "undefined") return;
  tinySkinInjected = true;
  const style = document.createElement("style");
  style.id = "cloudmail-tinymce-skin-overrides";
  style.textContent = TINY_SKIN_OVERRIDES;
  document.head.appendChild(style);
}
injectTinySkinOverrides();

/**
 * Lightweight adapter the rest of the app already talks to. Replaces the old
 * TipTap editor surface without leaking TinyMCE internals into our components.
 */
export interface RichTextEditorApi {
  /** Current HTML (empty string when nothing typed). */
  getContent: () => string;
  /** Replace the whole editor body. */
  setContent: (html: string, emitUpdate?: boolean) => void;
  /** Insert HTML at the cursor. */
  insertContent: (html: string) => void;
  /** Focus the editing area. */
  focus: () => void;
  /** Undo the last change. */
  undo: () => void;
  /** Redo the last undone change. */
  redo: () => void;
  /** True when the editor body is empty. */
  isEmpty: () => boolean;
  /** The underlying TinyMCE editor instance (advanced use). */
  raw: () => any;
}

export interface TinyMceEditorProps {
  initialValue?: string;
  placeholder?: string;
  height?: number;
  /** Called whenever the content changes (typing, paste, undo etc.). */
  onEditorChange?: (html: string) => void;
  /** When provided, register an "insert attachment" toolbar button. */
  onInsertAttachment?: (file: File) => void;
  /** Called once the editor is ready, exposing the same API as the ref. */
  onReady?: (api: RichTextEditorApi) => void;
  /** Extra content CSS appended to the editor body. */
  contentStyle?: string;
  /** Extra toolbar items appended after the defaults. */
  toolbarSuffix?: string;
  /** Whether undo/redo appear in the toolbar (default true; inline reply moves them to its header). */
  showHistoryInToolbar?: boolean;
  /** Fill the parent container's height instead of a fixed height. */
  fillContainer?: boolean;
  className?: string;
}

const BASE_CONTENT_STYLE = `
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
      "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1f2937;
  }
  p { margin: 0 0 0.5em; }
  h1 { font-size: 26px; margin: 0.6em 0 0.4em; }
  h2 { font-size: 22px; margin: 0.6em 0 0.4em; }
  h3 { font-size: 18px; margin: 0.6em 0 0.4em; }
  ul, ol { padding-left: 24px; margin: 0.5em 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  img { max-width: 100%; height: auto; display: inline-block; }
  blockquote {
    border-left: 4px solid #e5e7eb;
    margin: 0.5em 0;
    padding-left: 16px;
    color: #6b7280;
  }
  a { color: #2563eb; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  pre { background: #f6f8fa; padding: 8px; border-radius: 6px; }
  code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; }
`;

// Ordered per product spec: font, size, color, bold, italic, underline, strike,
// chars; bullets, numbered; paragraph + align; table/quote/code/hr/images/link.
const DEFAULT_TOOLBAR =
  "myfont fontsize forecolor | bold italic underline strikethrough charmap | " +
  "bullist numlist | blocks alignleft aligncenter alignright alignjustify outdent indent | " +
  "table blockquote code hr insertimage image link";

const DEFAULT_PLUGINS =
  "advlist lists table link image code wordcount autolink searchreplace nonbreaking fullscreen charmap";

const FONT_SIZE_FORMATS = "12px 13px 14px 16px 18px 20px 24px 28px 32px 36px";

const FONT_FAMILIES = [
  { label: "微软雅黑", value: "'Microsoft YaHei', '微软雅黑', sans-serif" },
  { label: "宋体", value: "'SimSun', '宋体', serif" },
  { label: "黑体", value: "'SimHei', '黑体', sans-serif" },
  { label: "楷体", value: "'KaiTi', '楷体', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, 'Segoe UI', sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

export const TinyMceEditor = forwardRef<RichTextEditorApi, TinyMceEditorProps>(
  function TinyMceEditor(
    {
      initialValue = "",
      placeholder,
      height = 300,
      onEditorChange,
      onInsertAttachment,
      onReady,
      contentStyle,
      toolbarSuffix = "",
      showHistoryInToolbar = true,
      fillContainer = false,
      className,
    },
    ref,
  ) {
    const editorRef = useRef<any>(null);

    const buildApi = useCallback((): RichTextEditorApi => ({
      getContent: () => editorRef.current?.getContent?.() ?? initialValue,
      setContent: (html, emitUpdate = false) => {
        if (!editorRef.current) return;
        editorRef.current.setContent(html || "", emitUpdate ? {} : { no_events: true });
      },
      insertContent: (html) => {
        if (!editorRef.current) return;
        editorRef.current.insertContent(html);
      },
      focus: () => editorRef.current?.focus?.(),
      undo: () => editorRef.current?.undoManager?.undo?.(),
      redo: () => editorRef.current?.undoManager?.redo?.(),
      isEmpty: () => {
        if (!editorRef.current) return initialValue.trim().length === 0;
        const text = editorRef.current.getContent({ format: "text" }) ?? "";
        return text.trim().length === 0;
      },
      raw: () => editorRef.current,
    }), [initialValue]);

    useImperativeHandle(ref, buildApi);

    const combinedContentStyle = `${BASE_CONTENT_STYLE}\n${contentStyle ?? ""}`;
    // The "insert attachment" button is only registered when a handler exists.
    const history = showHistoryInToolbar ? "undo redo | " : "";
    const attach = onInsertAttachment ? " insertattachment" : "";
    const toolbar = `${history}${DEFAULT_TOOLBAR}${attach}${toolbarSuffix ? ` | ${toolbarSuffix}` : ""}`.trim();

    return (
      <div className={`mail-editor ${fillContainer ? "h-full" : ""} ${className ?? ""}`.trim()}>
        <TinyMCE
          initialValue={initialValue}
          licenseKey="gpl"
          onInit={(_evt, editor) => {
            editorRef.current = editor;
            onReady?.(buildApi());
          }}
          onEditorChange={(html) => onEditorChange?.(html)}
          init={{
            promotion: false,
            branding: false,
            height: fillContainer ? "100%" : height,
            menubar: false,
            plugins: DEFAULT_PLUGINS,
            toolbar,
            toolbar_mode: "wrap",
            language: "zh-Hans",
            font_size_formats: FONT_SIZE_FORMATS,
            placeholder: placeholder ?? "",
            content_style: combinedContentStyle,
            // We bundle skin + content CSS above; don't let TinyMCE fetch them.
            skin: false,
            content_css: false,
            paste_data_images: true,
            elementpath: true,
            resize: true,
            // A minimal, Outlook-like table that always shows its border.
            table_default_attributes: {
              border: "1",
              style: "border-collapse: collapse; width: 100%;",
            },
            table_default_styles: { width: "100%" },
            table_appearance_options: true,
            image_advtab: false,
            automatic_uploads: false,
            file_picker_callback: (
              callback: (url: string, meta?: Record<string, unknown>) => void,
              _value: string,
              meta: { filetype: string } | Record<string, unknown>,
            ) => {
              const filetype = (meta as { filetype?: string })?.filetype ?? "image";
              if (filetype !== "image") return;
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  callback(reader.result as string, {
                    alt: file.name,
                    title: file.name,
                  });
                };
                reader.readAsDataURL(file);
              };
              input.click();
            },
            setup: (editor: any) => {
              // Font family dropdown (custom, so it's always visible).
              editor.ui.registry.addMenuButton("myfont", {
                text: "字体",
                tooltip: "字体",
                fetch: (callback: (items: unknown[]) => void) => {
                  callback(
                    FONT_FAMILIES.map((f) => ({
                      type: "menuitem",
                      text: f.label,
                      onAction: () => {
                        editor.formatter.apply("fontname", { value: f.value });
                        editor.focus();
                      },
                    })),
                  );
                },
              });

              // Direct "insert image from disk" button (opens the same picker).
              editor.ui.registry.addButton("insertimage", {
                icon: "image",
                tooltip: "从本地插入图片",
                onAction: () => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      editor.insertContent(
                        `<img src="${reader.result as string}" alt="${file.name}" />`,
                      );
                    };
                    reader.readAsDataURL(file);
                  };
                  input.click();
                },
              });

              // Optional "insert attachment" button (only when provided).
              if (onInsertAttachment) {
                editor.ui.registry.addButton("insertattachment", {
                  icon: "attach",
                  tooltip: "插入附件",
                  onAction: () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (file) onInsertAttachment(file);
                    };
                    input.click();
                  },
                });
              }
            },
          }}
        />
      </div>
    );
  },
);
