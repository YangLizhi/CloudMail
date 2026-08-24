import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDroppable } from "@dnd-kit/core";
import {
  FolderSearch,
  Tag,
  ChevronDown,
  Columns2,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { InputDialog } from "@/components/ui/InputDialog";
import { ALL_NAV_ITEMS } from "./Sidebar";
import { useUIStore } from "@/stores/uiStore";
import { useLabelStore } from "@/stores/labelStore";
import { useSmartFolderStore } from "@/stores/smartFolderStore";
import { useAccountStore } from "@/stores/accountStore";
import { useTaskStore } from "@/stores/taskStore";
import { useActiveLabel } from "@/hooks/useRouteNavigation";
import { navigateToLabel } from "@/router/navigate";
import { navigateToLabelAutoOpen } from "@/services/mailNavigation";
import { getUiLanguage } from "@/i18n";
import { smartFolderDisplayName } from "@/utils/mailLabels";

const TOP_NAV_ORDER = [
  "inbox",
  "sent",
  "snoozed",
  "tasks",
  "calendar",
  "attachments",
  "drafts",
  "all",
  "trash",
  "spam",
] as const;

/** Top-bar items that are mail categories (auto-open last read email). */
const MAIL_AUTO_OPEN = new Set([
  "inbox",
  "sent",
  "snoozed",
  "drafts",
  "all",
  "trash",
  "spam",
]);

function TopNavButton({
  id,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${
        isOver
          ? "bg-accent/20 ring-1 ring-accent"
          : isActive
            ? "bg-accent/15 text-accent font-medium"
            : "text-sidebar-text hover:bg-sidebar-hover"
      }`}
    >
      <Icon size={14} className="shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function DroppableLabelRow({
  label,
  isActive,
  onClick,
}: {
  label: { id: string; name: string; colorBg?: string | null };
  isActive: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: label.id });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
        isOver
          ? "bg-accent/20 ring-1 ring-accent"
          : isActive
            ? "bg-accent/10 text-accent font-medium"
            : "text-text-primary hover:bg-bg-hover"
      }`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: label.colorBg ?? "var(--color-accent)" }}
      />
      <span className="flex-1 truncate">{label.name}</span>
    </button>
  );
}

/**
 * Dropdown rendered through a portal so it is never clipped by the
 * horizontally scrollable nav row.
 */
function TopDropdown({
  button,
  children,
  open,
  onClose,
}: {
  button: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        left: rect.left,
        top: rect.bottom + 4,
        width: Math.max(rect.width, 240),
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const listener = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [open, onClose]);

  return (
    <div ref={anchorRef} className="relative shrink-0">
      {button}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[110] max-h-80 overflow-y-auto rounded-lg border border-border-primary bg-bg-primary shadow-xl py-1"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function TopNavBar() {
  const activeLabel = useActiveLabel();
  const sidebarNavConfig = useUIStore((s) => s.sidebarNavConfig);
  const inboxViewMode = useUIStore((s) => s.inboxViewMode);
  const setInboxViewMode = useUIStore((s) => s.setInboxViewMode);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const taskIncompleteCount = useTaskStore((s) => s.incompleteCount);
  const labels = useLabelStore((s) => s.labels);
  const loadLabels = useLabelStore((s) => s.loadLabels);
  const smartFolders = useSmartFolderStore((s) => s.folders);
  const smartFolderCounts = useSmartFolderStore((s) => s.unreadCounts);
  const loadSmartFolders = useSmartFolderStore((s) => s.loadFolders);
  const refreshSmartFolderCounts = useSmartFolderStore((s) => s.refreshUnreadCounts);
  const createSmartFolder = useSmartFolderStore((s) => s.createFolder);
  const createLabel = useLabelStore((s) => s.createLabel);

  const [foldersOpen, setFoldersOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);

  const closeFolders = useCallback(() => setFoldersOpen(false), []);
  const closeLabels = useCallback(() => setLabelsOpen(false), []);

  // Load labels + smart folders (same lifecycle as the old sidebar)
  useEffect(() => {
    if (activeAccountId) {
      loadLabels(activeAccountId);
    }
  }, [activeAccountId, loadLabels]);

  useEffect(() => {
    loadSmartFolders(activeAccountId ?? undefined);
    if (activeAccountId) refreshSmartFolderCounts(activeAccountId);
  }, [activeAccountId, loadSmartFolders, refreshSmartFolderCounts]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeAccountId) {
          loadLabels(activeAccountId);
          refreshSmartFolderCounts(activeAccountId);
        }
      }, 500);
    };
    window.addEventListener("velo-sync-done", handler);
    return () => {
      window.removeEventListener("velo-sync-done", handler);
      if (timer) clearTimeout(timer);
    };
  }, [activeAccountId, loadLabels, refreshSmartFolderCounts]);

  const navItems = useMemo(() => {
    const itemMap = new Map(ALL_NAV_ITEMS.map((i) => [i.id, i]));
    const hidden = new Set(
      (sidebarNavConfig ?? [])
        .filter((e) => e.id !== "smart-folders" && e.id !== "labels" && !e.visible)
        .map((e) => e.id),
    );
    return TOP_NAV_ORDER.map((id) => itemMap.get(id)).filter(
      (i): i is (typeof ALL_NAV_ITEMS)[number] => !!i && !hidden.has(i.id),
    );
  }, [sidebarNavConfig]);

  const zh = getUiLanguage() === "zh-CN";

  return (
    <div className="flex items-center gap-1 px-2 overflow-x-auto min-w-0">
      {/* Smart Folders dropdown */}
      <TopDropdown
        open={foldersOpen}
        onClose={closeFolders}
        button={
          <button
            onClick={() => setFoldersOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${
              foldersOpen || activeLabel.startsWith("smart-folder:")
                ? "bg-accent/15 text-accent font-medium"
                : "text-sidebar-text hover:bg-sidebar-hover"
            }`}
            title="Smart Folders"
          >
            <FolderSearch size={14} />
            <span>Smart Folders</span>
            <ChevronDown size={12} />
          </button>
        }
      >
        {smartFolders.length === 0 && (
          <div className="px-3 py-2 text-xs text-text-tertiary">
            {zh ? "暂无智能文件夹" : "No smart folders"}
          </div>
        )}
        {smartFolders.map((folder) => {
          const isActive = activeLabel === `smart-folder:${folder.id}`;
          const count = smartFolderCounts[folder.id] ?? 0;
          return (
            <button
              key={folder.id}
              onClick={() => {
                void navigateToLabelAutoOpen(
                  `smart-folder:${folder.id}`,
                  activeAccountId ?? "",
                );
                setFoldersOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                isActive
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-primary hover:bg-bg-hover"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: folder.color ?? "var(--color-accent)" }}
              />
              <span className="flex-1 truncate">
                {smartFolderDisplayName(folder.name)}
              </span>
              {count > 0 && (
                <span className="text-[0.625rem] bg-accent/15 text-accent px-1.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <div className="border-t border-border-secondary mt-1 pt-1">
          <button
            onClick={() => {
              setFoldersOpen(false);
              setShowNewFolder(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent hover:bg-bg-hover text-left"
          >
            <Plus size={13} />
            <span>New smart folder</span>
          </button>
        </div>
      </TopDropdown>

      {/* Labels dropdown */}
      <TopDropdown
        open={labelsOpen}
        onClose={closeLabels}
        button={
          <button
            onClick={() => setLabelsOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${
              labelsOpen || labels.some((l) => activeLabel === l.id)
                ? "bg-accent/15 text-accent font-medium"
                : "text-sidebar-text hover:bg-sidebar-hover"
            }`}
            title="Labels"
          >
            <Tag size={14} />
            <span>Labels</span>
            <ChevronDown size={12} />
          </button>
        }
      >
        {labels.length === 0 && (
          <div className="px-3 py-2 text-xs text-text-tertiary">
            {zh ? "暂无标签" : "No labels"}
          </div>
        )}
        {labels.map((label) => (
          <DroppableLabelRow
            key={label.id}
            label={label}
            isActive={activeLabel === label.id}
            onClick={() => {
              void navigateToLabelAutoOpen(label.id, activeAccountId ?? "");
              setLabelsOpen(false);
            }}
          />
        ))}
        <div className="border-t border-border-secondary mt-1 pt-1">
          <button
            onClick={() => {
              setLabelsOpen(false);
              setShowNewLabel(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-accent hover:bg-bg-hover text-left"
          >
            <Plus size={13} />
            <span>New label</span>
          </button>
        </div>
      </TopDropdown>

      <div className="w-px h-5 bg-border-secondary mx-1 shrink-0" />

      {navItems.map((item) => {
        const isInbox = item.id === "inbox";
        const isActive = isInbox ? activeLabel === "inbox" : activeLabel === item.id;
        return (
          <div key={item.id} className="flex items-center shrink-0">
            <TopNavButton
              id={item.id}
              label={item.label}
              icon={item.icon}
              isActive={isActive}
              onClick={() => {
                if (isInbox && inboxViewMode === "split") {
                  void navigateToLabelAutoOpen(item.id, activeAccountId ?? "", {
                    category: "Primary",
                  });
                } else if (MAIL_AUTO_OPEN.has(item.id)) {
                  void navigateToLabelAutoOpen(item.id, activeAccountId ?? "");
                } else {
                  navigateToLabel(item.id);
                }
              }}
            />
            {item.id === "tasks" && taskIncompleteCount > 0 && (
              <span className="ml-0.5 text-[0.625rem] bg-accent/15 text-accent px-1.5 rounded-full leading-normal shrink-0">
                {taskIncompleteCount}
              </span>
            )}
            {isInbox && (
              <button
                onClick={() =>
                  setInboxViewMode(inboxViewMode === "split" ? "unified" : "split")
                }
                title={
                  inboxViewMode === "split"
                    ? "Switch to unified inbox"
                    : "Switch to split inbox"
                }
                className={`p-1 rounded transition-colors ${
                  inboxViewMode === "split"
                    ? "text-accent hover:bg-accent/10"
                    : "text-sidebar-text/40 hover:text-sidebar-text hover:bg-sidebar-hover"
                }`}
              >
                <Columns2 size={13} />
              </button>
            )}
          </div>
        );
      })}

      <InputDialog
        isOpen={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onSubmit={(values) => {
          createSmartFolder(
            values.name!.trim(),
            values.query!.trim(),
            activeAccountId ?? undefined,
          );
          setShowNewFolder(false);
        }}
        title="New Smart Folder"
        fields={[
          { key: "name", label: "Name", placeholder: "e.g. Unread from boss" },
          { key: "query", label: "Search query", placeholder: "e.g. is:unread from:boss" },
        ]}
      />

      <InputDialog
        isOpen={showNewLabel}
        onClose={() => setShowNewLabel(false)}
        onSubmit={async (values) => {
          const name = values.name?.trim();
          if (name && activeAccountId) {
            await createLabel(activeAccountId, name);
            await loadLabels(activeAccountId);
          }
          setShowNewLabel(false);
        }}
        title="New Label"
        fields={[{ key: "name", label: "Name", placeholder: "e.g. Work" }]}
        submitLabel="Create"
      />
    </div>
  );
}
