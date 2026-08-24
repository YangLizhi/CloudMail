import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";
import { TopNavBar } from "./TopNavBar";
import { useUIStore } from "@/stores/uiStore";
import appIcon from "@/assets/icon.png";

const isMac = navigator.userAgent.includes("Macintosh");

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setMaximized);

    // Listen for resize events to track maximize state
    let unlisten: (() => void) | undefined;
    appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized);
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-[54px] bg-sidebar-bg border-b border-border-primary select-none shrink-0"
    >
      {/* App title — left side (extra padding on macOS for traffic light buttons) */}
      {/* Brand spans the sidebar width so the nav below starts exactly at the
          reading area's left edge. */}
      <div
        data-tauri-drag-region
        className={`flex items-center gap-2 shrink-0 overflow-hidden ${
          isMac ? "pl-20" : "pl-4"
        } ${sidebarCollapsed ? "w-16" : "w-[300px]"}`}
      >
        <img
          data-tauri-drag-region
          src={appIcon}
          alt="CloudMail"
          className="w-5 h-5 rounded shrink-0"
        />
        <span data-tauri-drag-region className="text-sm font-bold text-sidebar-text tracking-wide">
          CloudM
          <span className="text-accent">ai</span>l
        </span>
      </div>

      {/* Main navigation (smart folders / labels dropdowns + mail views) */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <TopNavBar />
      </div>

      {/* Window controls — right side (hidden on macOS, uses native traffic lights) */}
      {!isMac && (
        <div className="flex items-center h-full shrink-0">
          <button
            onClick={handleMinimize}
            className="h-full px-3.5 flex items-center justify-center text-sidebar-text/70 hover:bg-sidebar-hover transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="h-full px-3.5 flex items-center justify-center text-sidebar-text/70 hover:bg-sidebar-hover transition-colors"
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
          <button
            onClick={handleClose}
            className="h-full px-3.5 flex items-center justify-center text-sidebar-text/70 hover:bg-danger hover:text-white transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
