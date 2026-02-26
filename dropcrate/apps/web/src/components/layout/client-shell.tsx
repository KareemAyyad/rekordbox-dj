"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TopNav } from "./top-nav";
import { useThemeStore } from "@/stores/theme-store";
import { useConnectionMonitor } from "@/hooks/use-connection";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  useConnectionMonitor();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <>
      <Toaster position="bottom-right" theme={theme} richColors />
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
