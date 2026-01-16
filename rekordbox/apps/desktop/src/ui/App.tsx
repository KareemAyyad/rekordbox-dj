import { useEffect, useMemo, useState } from "react";
import { TooltipProvider } from "./components/Tooltip";
import { ToastProvider } from "./components/Toast";
import { TopNav } from "./components/TopNav";
import { HelpOverlay } from "./components/HelpOverlay";
import { QueueView } from "./views/QueueView";
import { LibraryView } from "./views/LibraryView";
import { SettingsView } from "./views/SettingsView";
import type { AppTab } from "../types/app";
import { getBackend } from "../state/backend";

type AppSettings = {
  inboxDir: string;
  mode: "dj-safe" | "fast";
  loudness: { targetI: number; targetTP: number; targetLRA: number };
  audioFormat: "aiff" | "wav" | "flac" | "mp3";
  normalizeEnabled: boolean;
};

export function App(): JSX.Element {
  const [tab, setTab] = useState<AppTab>("queue");
  const [helpMode, setHelpMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("dropcrate.theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [settings, setSettings] = useState<AppSettings>({
    inboxDir: "./DJ Library/00_INBOX",
    mode: "dj-safe",
    loudness: { targetI: -14, targetTP: -1.0, targetLRA: 11 },
    audioFormat: "aiff",
    normalizeEnabled: true
  });
  const [isConnected, setIsConnected] = useState(true); // Optimistic - assume connected until proven otherwise
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && helpMode) {
        e.preventDefault();
        setHelpMode(false);
        return;
      }
      if (e.key === "?" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setHelpMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("dropcrate.theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const backend = getBackend();
    let consecutiveFailures = 0;

    const checkConnection = async (loadSettingsOnSuccess = false) => {
      try {
        const s = await backend.settings.get();
        if (cancelled) return;
        consecutiveFailures = 0;
        setFailCount(0);
        setIsConnected(true);
        if (loadSettingsOnSuccess) {
          setSettings((prev) => ({
            ...prev,
            inboxDir: s.inboxDir?.trim() ? s.inboxDir : prev.inboxDir,
            mode: s.mode ?? prev.mode,
            loudness: s.loudness ?? prev.loudness
          }));
        }
      } catch {
        if (cancelled) return;
        consecutiveFailures++;
        setFailCount(consecutiveFailures);
        // Only mark disconnected after 2+ consecutive failures
        if (consecutiveFailures >= 2) {
          setIsConnected(false);
        }
      }
    };

    // Initial load
    void checkConnection(true);

    // Periodic health check (every 15s)
    const interval = setInterval(() => checkConnection(false), 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const tooltip = useMemo(() => ({ helpMode }), [helpMode]);

  return (
    <ToastProvider>
      <TooltipProvider value={tooltip}>
        <div className="min-h-screen">
          <TopNav
            tab={tab}
            onTabChange={setTab}
            helpMode={helpMode}
            onToggleHelpMode={() => setHelpMode((v) => !v)}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            isConnected={isConnected}
          />
          <main className="mx-auto max-w-6xl px-6 py-6">
            {/* Keep views mounted so long-running queue state and SSE subscriptions persist across tab switches. */}
            <div className={tab === "queue" ? "dc-animate-fadeIn" : "hidden"} aria-hidden={tab !== "queue"}>
              <QueueView settings={settings} onOpenSettings={() => setTab("settings")} />
            </div>
            <div className={tab === "library" ? "dc-animate-fadeIn" : "hidden"} aria-hidden={tab !== "library"}>
              <LibraryView settings={settings} />
            </div>
            <div className={tab === "settings" ? "dc-animate-fadeIn" : "hidden"} aria-hidden={tab !== "settings"}>
              <SettingsView settings={settings} onSettingsChange={setSettings} />
            </div>
          </main>
          {helpMode ? <HelpOverlay /> : null}
        </div>
      </TooltipProvider>
    </ToastProvider>
  );
}
