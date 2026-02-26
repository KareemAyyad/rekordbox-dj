"use client";

import { create } from "zustand";
import type { Settings, LoudnessConfig } from "@/lib/types";

interface SettingsStore {
  settings: Settings;
  loading: boolean;
  saving: boolean;
  setSettings: (s: Settings) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateLoudness: (patch: Partial<LoudnessConfig>) => void;
  setLoading: (v: boolean) => void;
  setSaving: (v: boolean) => void;
}

const DEFAULT_SETTINGS: Settings = {
  inbox_dir: "/data/inbox",
  mode: "dj-safe",
  audio_format: "aiff",
  normalize_enabled: true,
  loudness: { target_i: -14, target_tp: -1, target_lra: 11 },
  rekordbox_xml_enabled: true,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,
  saving: false,
  setSettings: (settings) => set({ settings, loading: false }),
  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),
  updateLoudness: (patch) =>
    set((s) => ({
      settings: { ...s.settings, loudness: { ...s.settings.loudness, ...patch } },
    })),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
}));
