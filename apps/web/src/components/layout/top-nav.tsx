"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Moon, Sun, AudioWaveform } from "lucide-react";
import { useThemeStore } from "@/stores/theme-store";
import { useConnectionStore } from "@/stores/connection-store";
import type { AppTab } from "@/lib/types";

function ConnectionIndicator() {
  const connected = useConnectionStore((s) => s.connected);
  return (
    <div className="flex items-center gap-2 px-2" title={connected ? "Engine Connected" : "Engine Disconnected"}>
      <Activity className={clsx("w-4 h-4", connected ? "text-[var(--dc-success-text)]" : "text-[var(--dc-danger-text)] animate-pulse")} />
      <div className="relative flex h-2 w-2">
        {!connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--dc-danger-text)] opacity-75" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-2 w-2 rounded-full",
            connected ? "bg-[var(--dc-success-text)] shadow-[0_0_8px_var(--dc-success-text)]" : "bg-[var(--dc-danger-text)]"
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
        "relative rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200 z-10",
        active ? "text-[var(--dc-text)]" : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]"
      )}
    >
      {active && (
        <motion.div
          layoutId="active-tab-indicator"
          className="absolute inset-0 rounded-full bg-[var(--dc-chip-strong)] shadow-sm -z-10 border border-[var(--dc-border)]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      {label}
    </Link>
  );
}

export function TopNav() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="dc-glass-strong pointer-events-auto rounded-full flex items-center justify-between px-3 py-2 w-full max-w-4xl shadow-2xl">
        {/* Logo */}
        <div className="flex items-center gap-3 pl-2 pr-6 border-r border-[var(--dc-border)]">
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[var(--dc-accent)] to-[var(--dc-accent-light)] flex items-center justify-center shadow-[0_0_15px_var(--dc-accent-ring)] relative overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-white/20"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <AudioWaveform className="w-5 h-5 text-black z-10" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-wider text-[var(--dc-text)] uppercase leading-none">DropCrate</span>
            <span className="text-[9px] font-medium text-[var(--dc-accent-text)] tracking-widest uppercase mt-0.5 opacity-80">Engine</span>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 px-4 flex-1 justify-center">
          <TabButton tab="queue" label="Queue" />
          <TabButton tab="library" label="Library" />
          <TabButton tab="segment" label="Segment" />
          <TabButton tab="settings" label="Settings" />
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3 pl-6 border-l border-[var(--dc-border)]">
          <ConnectionIndicator />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--dc-chip)] hover:bg-[var(--dc-chip-strong)] text-[var(--dc-text)] transition-colors border border-[var(--dc-border)] shadow-sm"
            title="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
