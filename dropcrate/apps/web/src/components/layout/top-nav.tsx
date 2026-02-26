"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useThemeStore } from "@/stores/theme-store";
import { useConnectionStore } from "@/stores/connection-store";
import type { AppTab } from "@/lib/types";

function ConnectionIndicator() {
  const connected = useConnectionStore((s) => s.connected);
  return (
    <div className="flex items-center gap-1.5" title={connected ? "Connected" : "Disconnected"}>
      <div className="relative flex h-2 w-2">
        {!connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2 w-2 rounded-full",
            connected ? "bg-emerald-500" : "bg-red-500"
          )}
        />
      </div>
    </div>
  );
}

function TabButton({ tab, label }: { tab: AppTab; label: string }) {
  const pathname = usePathname();
  const active = pathname === `/${tab}` || (pathname === "/" && tab === "queue");
  return (
    <Link
      href={`/${tab}`}
      className={clsx(
        "relative rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
        active
          ? "bg-[var(--dc-chip-strong)] text-[var(--dc-text)] shadow-sm"
          : "text-[var(--dc-muted)] hover:bg-[var(--dc-chip)] hover:text-[var(--dc-text)]"
      )}
    >
      {active && (
        <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-[var(--dc-text)] opacity-40" />
      )}
      {label}
    </Link>
  );
}

export function TopNav() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--dc-border)] bg-[var(--dc-header)] backdrop-blur-[var(--dc-blur)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[var(--dc-accent)] flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-[var(--dc-text)]">DropCrate</div>
            <div className="text-xs text-[var(--dc-muted)]">Paste &rarr; Download &rarr; DJ-ready</div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-2 rounded-2xl bg-[var(--dc-card)] p-1 ring-1 ring-[color:var(--dc-border)]">
          <TabButton tab="queue" label="Queue" />
          <TabButton tab="library" label="Library" />
          <TabButton tab="settings" label="Settings" />
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <ConnectionIndicator />
          <div className="h-4 w-px bg-[var(--dc-border)]" />
          <button
            onClick={toggleTheme}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dc-muted)] bg-[var(--dc-chip)] hover:bg-[var(--dc-chip-strong)] transition"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </div>
    </header>
  );
}
