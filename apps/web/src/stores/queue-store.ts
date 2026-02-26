"use client";

import { create } from "zustand";
import type { DJTags, QueueItem, QueueItemStatus, DownloadStage } from "@/lib/types";

interface QueueStore {
  items: QueueItem[];
  running: boolean;
  jobId: string | null;

  addItems: (urls: string[], defaults: DJTags) => void;
  removeItem: (id: string) => void;
  clearDone: () => void;
  updateItemStatus: (id: string, status: QueueItemStatus, message?: string) => void;
  updateItemStage: (id: string, stage: DownloadStage) => void;
  updateItemAuto: (id: string, auto: QueueItem["auto"]) => void;
  updateItemTags: (id: string, tags: Partial<DJTags>) => void;
  setRunning: (running: boolean) => void;
  setJobId: (jobId: string | null) => void;
  reset: () => void;
}

let counter = 0;

export const useQueueStore = create<QueueStore>((set) => ({
  items: [],
  running: false,
  jobId: null,

  addItems: (urls, defaults) =>
    set((s) => ({
      items: [
        ...s.items,
        ...urls.map((url) => ({
          id: `q-${++counter}-${Date.now()}`,
          url,
          status: "queued" as const,
          presetSnapshot: { ...defaults },
          auto: { status: "idle" as const },
        })),
      ],
    })),

  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

  clearDone: () => set((s) => ({ items: s.items.filter((i) => i.status !== "done") })),

  updateItemStatus: (id, status, message) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, status, message: message ?? i.message } : i
      ),
    })),

  updateItemStage: (id, stage) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? { ...i, auto: { ...i.auto, status: "running" as const, stage } }
          : i
      ),
    })),

  updateItemAuto: (id, auto) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, auto } : i)),
    })),

  updateItemTags: (id, tags) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id
          ? { ...i, presetSnapshot: { ...i.presetSnapshot, ...tags } }
          : i
      ),
    })),

  setRunning: (running) => set({ running }),
  setJobId: (jobId) => set({ jobId }),
  reset: () => set({ items: [], running: false, jobId: null }),
}));
