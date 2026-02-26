"use client";

import { create } from "zustand";

type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme:
    typeof window !== "undefined"
      ? (localStorage.getItem("dc-theme") as Theme) || "dark"
      : "dark",
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    set({ theme: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("dc-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  },
  set: (t: Theme) => {
    set({ theme: t });
    if (typeof window !== "undefined") {
      localStorage.setItem("dc-theme", t);
      document.documentElement.setAttribute("data-theme", t);
    }
  },
}));
