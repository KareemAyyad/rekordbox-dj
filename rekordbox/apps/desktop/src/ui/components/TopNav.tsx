import clsx from "clsx";
import type { AppTab } from "../../types/app";
import { Button } from "./ui";

interface TopNavProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  helpMode: boolean;
  onToggleHelpMode: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isConnected?: boolean;
}

function ConnectionIndicator({ isConnected }: { isConnected: boolean }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5" title={isConnected ? "Connected" : "Disconnected"}>
      <div className="relative flex h-2 w-2">
        {!isConnected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2 w-2 rounded-full",
            isConnected ? "bg-emerald-500" : "bg-red-500"
          )}
        />
      </div>
    </div>
  );
}

export function TopNav(props: TopNavProps): JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--dc-border)] bg-[var(--dc-header)] backdrop-blur-[var(--dc-blur)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="h-9 w-9 rounded-xl bg-[var(--dc-accent)] flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-[var(--dc-text)]">Hoover</div>
            <div className="text-xs text-[var(--dc-muted)]">Paste → Download → Rekordbox-ready</div>
          </div>
        </div>

        <nav className="flex items-center gap-2 rounded-2xl bg-[var(--dc-card)] p-1 ring-1 ring-[color:var(--dc-border)]">
          <TabButton active={props.tab === "queue"} onClick={() => props.onTabChange("queue")} label="Queue" />
          <TabButton active={props.tab === "library"} onClick={() => props.onTabChange("library")} label="Library" />
          <TabButton active={props.tab === "settings"} onClick={() => props.onTabChange("settings")} label="Settings" />
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-[var(--dc-chip)] px-3 py-1.5">
            <span className="text-xs font-medium text-[var(--dc-muted)]">Welcome,</span>
            <span className="text-xs font-semibold text-[var(--dc-text)]">DJ Alaa</span>
          </div>
          <ConnectionIndicator isConnected={props.isConnected ?? false} />
          <div className="h-4 w-px bg-[var(--dc-border)]" />
          <Button size="sm" onClick={props.onToggleTheme} title="Toggle theme">
            {props.theme === "light" ? "Dark" : "Light"}
          </Button>
          <Button size="sm" variant={props.helpMode ? "primary" : "secondary"} onClick={props.onToggleHelpMode} title="Toggle Help Mode (Ctrl/⌘ + ?)">
            Help {props.helpMode ? "On" : "Off"}
          </Button>
        </div>
      </div>
    </header>
  );
}

function TabButton(props: { active: boolean; label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={clsx(
        "relative rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
        props.active
          ? "bg-[var(--dc-chip-strong)] text-[var(--dc-text)] shadow-sm"
          : "text-[var(--dc-muted)] hover:bg-[var(--dc-chip)]/60 hover:text-[var(--dc-text)]"
      )}
    >
      {props.active && (
        <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-[var(--dc-text)] opacity-40" />
      )}
      {props.label}
    </button>
  );
}
