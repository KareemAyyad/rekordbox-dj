"use client";

import { create } from "zustand";
import type { LibraryItem } from "@/lib/types";

interface LibraryStore {
  items: LibraryItem[];
  loading: boolean;
  error: string | null;
  search: string;
  sort: "date" | "artist" | "title";
  setItems: (items: LibraryItem[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setSearch: (s: string) => void;
  setSort: (s: "date" | "artist" | "title") => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  items: [],
  loading: true,
  error: null,
  search: "",
  sort: "date",
  setItems: (items) => set({ items, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
}));
