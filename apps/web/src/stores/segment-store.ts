"use client";

import { create } from "zustand";
import type { SegmentItem, SegmentSession } from "@/lib/types";

interface SegmentStore {
  session: SegmentSession | null;
  segments: SegmentItem[];
  mode: "describe" | "auto";
  processing: boolean;
  progress: { current: number; total: number; label: string } | null;
  modelLoading: boolean;
  error: string | null;
  jobId: string | null;

  setSession: (session: SegmentSession | null) => void;
  addSegment: (segment: SegmentItem) => void;
  setSegments: (segments: SegmentItem[]) => void;
  setMode: (mode: "describe" | "auto") => void;
  setProcessing: (processing: boolean) => void;
  setProgress: (progress: { current: number; total: number; label: string } | null) => void;
  setModelLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setJobId: (jobId: string | null) => void;
  reset: () => void;
}

export const useSegmentStore = create<SegmentStore>((set) => ({
  session: null,
  segments: [],
  mode: "auto",
  processing: false,
  progress: null,
  modelLoading: false,
  error: null,
  jobId: null,

  setSession: (session) => set({ session, segments: [], error: null, progress: null }),
  addSegment: (segment) => set((s) => ({ segments: [...s.segments, segment] })),
  setSegments: (segments) => set({ segments }),
  setMode: (mode) => set({ mode }),
  setProcessing: (processing) => set({ processing }),
  setProgress: (progress) => set({ progress }),
  setModelLoading: (modelLoading) => set({ modelLoading }),
  setError: (error) => set({ error }),
  setJobId: (jobId) => set({ jobId }),
  reset: () =>
    set({
      session: null,
      segments: [],
      processing: false,
      progress: null,
      modelLoading: false,
      error: null,
      jobId: null,
    }),
}));
