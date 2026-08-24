import { AccountSwitcher } from "../accounts/AccountSwitcher";
import { EmailList } from "./EmailList";
import { useComposerStore } from "@/stores/composerStore";
import { useUIStore } from "@/stores/uiStore";
import { useActiveLabel } from "@/hooks/useRouteNavigation";
import { navigateToLabel } from "@/router/navigate";
import {
  Inbox,
  Star,
  Clock,
  Send,
  FileEdit,
  Trash2,
  Ban,
  Mail,
  CheckSquare,
  Calendar,
  Plus,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  FolderSearch,
  Tag,
  type LucideIcon,
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onAddAccount: () => void;
}

/**
 * All navigable items. They live in the top bar; the sidebar hosts the
 * account switch, compose button, and the mail list only.
 */
export const ALL_NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "starred", label: "Starred", icon: Star },
  { id: "snoozed", label: "Snoozed", icon: Clock },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "spam", label: "Spam", icon: Ban },
  { id: "all", label: "All Mail", icon: Mail },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "smart-folders", label: "Smart Folders", icon: FolderSearch },
  { id: "labels", label: "Labels", icon: Tag },
];

export function Sidebar({ collapsed, onAddAccount }: SidebarProps) {
  const activeLabel = useActiveLabel();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openComposer = useComposerStore((s) => s.openComposer);
  const pendingOpsCount = useUIStore((s) => s.pendingOpsCount);

  return (
    <aside
      className={`no-select flex flex-col bg-sidebar-bg text-sidebar-text border-r border-border-primary transition-all duration-200 glass-panel ${
        collapsed ? "w-16" : "w-[300px]"
      }`}
    >
      <AccountSwitcher collapsed={collapsed} onAddAccount={onAddAccount} />

      {/* Compose button */}
      <div className="px-3 py-2">
        <button
          onClick={() => openComposer()}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-lg py-2 text-sm font-medium interactive-btn"
        >
          {collapsed ? <Plus size={16} /> : "Compose"}
        </button>
      </div>

      {/* Mail list (includes its own search box, header and thread list) */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden border-t border-border-primary">
          <EmailList />
        </div>
      )}

      {/* Bottom bar: Settings + collapse toggle */}
      <div className={`py-2 border-t border-border-primary flex ${collapsed ? "flex-col items-center gap-1 px-2" : "items-center gap-1 px-3"}`}>
        <button
          onClick={() => navigateToLabel("settings")}
          className={`flex items-center text-sm rounded-md transition-colors ${
            collapsed ? "p-2 justify-center" : "gap-3 flex-1 px-3 py-2 text-left"
          } ${
            activeLabel === "settings"
              ? "bg-accent/10 text-accent font-medium"
              : "text-sidebar-text hover:bg-sidebar-hover"
          }`}
          title="Settings"
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        <button
          onClick={() => navigateToLabel("help")}
          className={`flex items-center text-sm rounded-md transition-colors ${
            collapsed ? "p-2 justify-center" : "p-2"
          } ${
            activeLabel === "help"
              ? "bg-accent/10 text-accent font-medium"
              : "text-sidebar-text hover:bg-sidebar-hover"
          }`}
          title="Help"
        >
          <HelpCircle size={18} className="shrink-0" />
        </button>
        <button
          onClick={toggleSidebar}
          className="p-2 text-sidebar-text/60 hover:text-sidebar-text hover:bg-sidebar-hover rounded-md transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {pendingOpsCount > 0 && (
        <div className="px-3 py-2 border-t border-border-primary">
          <div className="text-xs text-text-secondary">
            {pendingOpsCount} pending {pendingOpsCount === 1 ? "change" : "changes"}
          </div>
        </div>
      )}
    </aside>
  );
}
