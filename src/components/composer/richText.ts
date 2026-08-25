import { Extension, type AnyExtension, type CommandProps } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Increase the indent of the selected block(s). */
      indent: () => ReturnType;
      /** Decrease the indent of the selected block(s). */
      outdent: () => ReturnType;
    };
  }
}

/** Paragraph indent levels, rendered as a left padding in em. */
const Indent = Extension.create({
  name: "indent",
  addOptions() {
    return { types: ["paragraph", "heading", "blockquote"] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Number(el.getAttribute("data-indent")) || 0,
            renderHTML: (attrs) => ({
              "data-indent": attrs.indent,
              style: attrs.indent
                ? `padding-left: ${Number(attrs.indent) * 1.5}em`
                : "",
            }),
          },
        },
      },
    ];
  },
  addCommands() {
    const indentCommand = (delta: number) => {
      return ({ tr, state, dispatch }: CommandProps) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!this.options.types.includes(node.type.name)) return;
          const cur = node.attrs.indent || 0;
          const next = Math.min(4, Math.max(0, cur + delta));
          if (next === cur) return;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    };
    return {
      indent: () => indentCommand(1),
      outdent: () => indentCommand(-1),
    };
  },
});

/**
 * Rich-text extensions shared by the composer and inline reply editors so both
 * expose the same formatting toolbar (font, size, color, highlight, alignment,
 * indent, tables, lists, etc.).
 */
export function buildRichTextExtensions(
  placeholder: string,
): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false },
    }),
    Placeholder.configure({ placeholder }),
    Image.configure({ inline: true, allowBase64: true }),
    TextStyleKit,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
    TableKit.configure({ table: { resizable: false } }),
    Indent,
  ];
}
