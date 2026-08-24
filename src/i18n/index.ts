import { getSetting, setSetting } from "@/services/db/settings";
import { ZH_DICT } from "./zhCN";
import { ZH_DICT_EXTRA } from "./zhCNExtra";

export type UiLanguage = "en" | "zh-CN";

const ZH_FULL: Record<string, string> = { ...ZH_DICT, ...ZH_DICT_EXTRA };

const originals = new WeakMap<Text, string>();
const placeholderOriginals = new WeakMap<HTMLElement, string>();
let observer: MutationObserver | null = null;
let currentLang: UiLanguage = "zh-CN";

function translateTextNode(node: Text): void {
  const text = node.textContent?.replace(/\s+/g, " ").trim();
  if (!text || originals.has(node)) return;
  let translated = ZH_FULL[text];
  if (!translated) {
    const selected = text.match(/^(\d+)\s+selected$/);
    if (selected) translated = `${selected[1]} 已选中`;
  }
  if (!translated) return;
  originals.set(node, node.textContent ?? "");
  node.textContent = translated;
}

function restoreTextNode(node: Text): void {
  const original = originals.get(node);
  if (original !== undefined) {
    node.textContent = original;
    originals.delete(node);
  }
}

function translateElement(el: HTMLElement): void {
  if (el.hasAttribute("placeholder")) {
    const placeholder = el.getAttribute("placeholder") ?? "";
    const trimmed = placeholder.replace(/\s+/g, " ").trim();
    const translated = ZH_FULL[trimmed];
    if (translated && !placeholderOriginals.has(el)) {
      placeholderOriginals.set(el, placeholder);
      el.setAttribute("placeholder", translated);
    }
  }
  if (el.hasAttribute("title")) {
    const title = el.getAttribute("title") ?? "";
    const trimmed = title.replace(/\s+/g, " ").trim();
    const translated = ZH_FULL[trimmed];
    if (translated && !placeholderOriginals.has(el)) {
      placeholderOriginals.set(el, title);
      el.setAttribute("title", translated);
    }
  }
}

function restoreElement(el: HTMLElement): void {
  const original = placeholderOriginals.get(el);
  if (original !== undefined) {
    if (el.hasAttribute("placeholder")) el.setAttribute("placeholder", original);
    if (el.hasAttribute("title")) el.setAttribute("title", original);
    placeholderOriginals.delete(el);
  }
}

function scan(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (currentLang === "zh-CN") translateTextNode(n as Text);
      else restoreTextNode(n as Text);
    }
  }
  if (currentLang === "zh-CN") {
    root.querySelectorAll?.("[placeholder],[title]").forEach((el) => {
      translateElement(el as HTMLElement);
    });
  } else {
    root.querySelectorAll?.("[placeholder],[title]").forEach((el) => {
      restoreElement(el as HTMLElement);
    });
  }
}

function startObserver(): void {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (currentLang === "zh-CN") translateTextNode(node as Text);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          scan(node as ParentNode);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export async function initUiLanguage(): Promise<void> {
  const lang = ((await getSetting("language")) ?? "zh-CN") as UiLanguage;
  currentLang = lang;
  if (typeof document !== "undefined") {
    scan(document.body);
    startObserver();
  }
}

export async function setUiLanguage(lang: UiLanguage): Promise<void> {
  currentLang = lang;
  await setSetting("language", lang);
  if (typeof document !== "undefined") {
    scan(document.body);
    startObserver();
  }
}

export function getUiLanguage(): UiLanguage {
  return currentLang;
}
