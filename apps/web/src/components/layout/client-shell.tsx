"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { TopNav } from "./top-nav";
import { useThemeStore } from "@/stores/theme-store";
import { useConnectionMonitor } from "@/hooks/use-connection";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const pathname = usePathname();
  useConnectionMonitor();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <>
      <div className="dc-ambient-bg" />
      <Toaster position="bottom-right" theme={theme} richColors />
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-8 mt-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
}
