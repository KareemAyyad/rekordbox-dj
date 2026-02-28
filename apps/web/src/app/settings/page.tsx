"use client";

import { useEffect, useCallback, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Save, ShieldCheck, Zap, Disc3, SlidersHorizontal, Upload, Trash2, RefreshCw, Headphones, Radio, Music2, AlertTriangle, ChevronDown } from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/lib/api-client";
import { PRESETS, FORMAT_OPTIONS } from "@/lib/constants";
import type { Settings } from "@/lib/types";

function detectPreset(s: Settings): string | null {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (
      s.audio_format === preset.audio_format &&
      s.loudness.target_i === preset.loudness.target_i &&
      s.loudness.target_tp === preset.loudness.target_tp &&
      s.loudness.target_lra === preset.loudness.target_lra
    ) {
      return key;
    }
  }
  return null;
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
  club: <Headphones className="w-5 h-5" />,
  streaming: <Music2 className="w-5 h-5" />,
  radio: <Radio className="w-5 h-5" />,
};

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const updateLoudness = useSettingsStore((s) => s.updateLoudness);
  const setSaving = useSettingsStore((s) => s.setSaving);

  // YouTube Auth state
  const [cookiesStatus, setCookiesStatus] = useState<{ configured: boolean; source: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cookiesUploading, setCookiesUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => { });
    api.getYoutubeCookiesStatus().then(setCookiesStatus).catch(() => { });
  }, [setSettings]);

  // Track unsaved changes
  const markDirty = useCallback(() => setDirty(true), []);

  const refreshCookiesStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const cookies = await api.getYoutubeCookiesStatus();
      setCookiesStatus(cookies);
    } catch {
      toast.error("Failed to refresh status");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleCookiesUpload = useCallback(async (file: File) => {
    setCookiesUploading(true);
    try {
      await api.uploadYoutubeCookies(file);
      toast.success("Cookies uploaded — YouTube downloads should work now");
      refreshCookiesStatus();
    } catch {
      toast.error("Failed to upload cookies");
    } finally {
      setCookiesUploading(false);
    }
  }, [refreshCookiesStatus]);

  const handleCookiesDelete = useCallback(async () => {
    try {
      await api.deleteYoutubeCookies();
      toast.success("Cookies removed");
      refreshCookiesStatus();
    } catch {
      toast.error("Failed to remove cookies");
    }
  }, [refreshCookiesStatus]);

  const activePreset = detectPreset(settings);

  const applyPreset = useCallback(
    (key: string) => {
      const preset = PRESETS[key as keyof typeof PRESETS];
      if (!preset) return;
      updateSettings({ audio_format: preset.audio_format });
      updateLoudness(preset.loudness);
      markDirty();
    },
    [updateSettings, updateLoudness, markDirty]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setDirty(false);
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [settings, setSaving]);

  if (loading) {
    return (
      <div className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 animate-pulse text-center py-20">
        <div className="inline-block relative">
          <SlidersHorizontal className="w-12 h-12 text-[var(--dc-muted)] animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 bg-[var(--dc-accent)] blur-xl opacity-20 rounded-full" />
        </div>
        <p className="mt-4 text-sm font-bold tracking-widest uppercase text-[var(--dc-muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* ─── Header + Save ─── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--dc-text)]">Preferences</h1>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-300",
            saving
              ? "bg-[var(--dc-accent-light)] opacity-60 cursor-not-allowed text-[var(--dc-accent-contrast)]"
              : dirty
                ? "bg-gradient-to-r from-[var(--dc-accent)] to-[var(--dc-accent-light)] text-[var(--dc-accent-contrast)] shadow-[0_0_20px_var(--dc-accent-bg)] hover:shadow-[0_0_30px_var(--dc-accent-light)]"
                : "bg-[var(--dc-chip-strong)] text-[var(--dc-text)] border border-[var(--dc-border)] hover:bg-[var(--dc-accent-bg)] hover:border-[var(--dc-accent-border)]"
          )}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Saving…
            </span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {dirty ? "Save Changes" : "Save"}
            </>
          )}
        </motion.button>
      </div>

      {/* ─── Quick Profiles ─── */}
      <section className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--dc-accent)] opacity-[0.04] blur-[100px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3" />

        <h2 className="relative z-10 text-xs font-black uppercase tracking-widest text-[var(--dc-muted)] mb-5 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Quick Profiles
        </h2>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              key={key}
              onClick={() => applyPreset(key)}
              className={clsx(
                "relative p-5 text-left transition-all duration-300 rounded-2xl overflow-hidden group",
                activePreset === key
                  ? "border-2 border-[var(--dc-accent-light)] shadow-[0_0_24px_var(--dc-accent-bg)] bg-[var(--dc-accent-bg)]"
                  : "border border-[var(--dc-border-strong)] bg-[var(--dc-card2)] hover:border-[var(--dc-accent)] hover:bg-[var(--dc-card)]"
              )}
            >
              {activePreset === key && (
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--dc-accent)] to-transparent opacity-10 pointer-events-none" />
              )}

              <div className="relative z-10 flex items-center gap-3 mb-2">
                <div className={clsx(
                  "p-2 rounded-xl transition-colors",
                  activePreset === key
                    ? "bg-[var(--dc-accent)] text-[var(--dc-accent-contrast)]"
                    : "bg-[var(--dc-chip-strong)] text-[var(--dc-muted)] group-hover:text-[var(--dc-accent)]"
                )}>
                  {PRESET_ICONS[key] || <Music2 className="w-5 h-5" />}
                </div>
                <span className="text-sm font-bold text-[var(--dc-text)] tracking-wide">{preset.label}</span>
              </div>

              <p className="relative z-10 text-[11px] font-medium text-[var(--dc-muted)] leading-relaxed h-8">
                {preset.description}
              </p>

              <div className="relative z-10 mt-3 flex gap-2">
                <span className="inline-flex items-center rounded-md bg-[var(--dc-chip)] px-2 py-1 text-[10px] font-bold tracking-wider text-[var(--dc-accent-light)] border border-[var(--dc-border)]">
                  {preset.audio_format.toUpperCase()}
                </span>
                <span className="inline-flex items-center rounded-md bg-[var(--dc-chip)] px-2 py-1 text-[10px] font-bold tracking-wider text-[var(--dc-muted)] border border-[var(--dc-border)]">
                  {preset.loudness.target_i} LUFS
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ─── Audio Settings ─── */}
      <section className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-[var(--dc-muted)] flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" /> Audio Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Processing Mode */}
          <div className="dc-glass rounded-2xl p-5 hover:border-[var(--dc-accent-border)] transition-colors">
            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--dc-text)] mb-3">Processing Mode</label>
            <div className="relative">
              <select
                value={settings.mode}
                onChange={(e) => { updateSettings({ mode: e.target.value as Settings["mode"] }); markDirty(); }}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-input)] px-4 py-3 text-sm font-bold text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="dj-safe">DJ-Safe (Full Processing)</option>
                <option value="fast">Fast (Direct Download)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dc-muted)] pointer-events-none" />
            </div>
          </div>

          {/* Audio Format */}
          <div className="dc-glass rounded-2xl p-5 hover:border-[var(--dc-accent-border)] transition-colors">
            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--dc-text)] mb-3">Audio Format</label>
            <div className="relative">
              <select
                value={settings.audio_format}
                onChange={(e) => { updateSettings({ audio_format: e.target.value as Settings["audio_format"] }); markDirty(); }}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-input)] px-4 py-3 text-sm font-bold text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none transition-all appearance-none cursor-pointer"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label} — {f.desc}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dc-muted)] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Normalization */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-[var(--dc-card2)] p-4 rounded-xl border border-[var(--dc-border)]">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.normalize_enabled}
                onChange={(e) => { updateSettings({ normalize_enabled: e.target.checked }); markDirty(); }}
                className="peer sr-only"
              />
              <div className="w-10 h-5 bg-[var(--dc-chip-strong)] rounded-full peer-checked:bg-[var(--dc-accent)] transition-colors duration-300" />
              <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm" />
            </label>
            <span className="text-sm font-bold text-[var(--dc-text)]">
              Loudness Normalization
            </span>
          </div>

          <AnimatePresence>
            {settings.normalize_enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div className="bg-[var(--dc-card2)] p-4 rounded-xl border border-[var(--dc-border)]">
                    <label className="block text-[10px] uppercase font-bold text-[var(--dc-muted)] mb-2">Target LUFS</label>
                    <div className="relative">
                      <input
                        type="number" value={settings.loudness.target_i}
                        onChange={(e) => { updateLoudness({ target_i: Number(e.target.value) }); markDirty(); }}
                        min={-23} max={-8} step={0.5}
                        className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--dc-muted2)]">LUFS</span>
                    </div>
                  </div>

                  <div className="bg-[var(--dc-card2)] p-4 rounded-xl border border-[var(--dc-border)]">
                    <label className="block text-[10px] uppercase font-bold text-[var(--dc-muted)] mb-2">True Peak</label>
                    <div className="relative">
                      <input
                        type="number" value={settings.loudness.target_tp}
                        onChange={(e) => { updateLoudness({ target_tp: Number(e.target.value) }); markDirty(); }}
                        min={-5} max={0} step={0.1}
                        className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--dc-muted2)]">dBTP</span>
                    </div>
                  </div>

                  <div className="bg-[var(--dc-card2)] p-4 rounded-xl border border-[var(--dc-border)]">
                    <label className="block text-[10px] uppercase font-bold text-[var(--dc-muted)] mb-2">Dynamic Range</label>
                    <div className="relative">
                      <input
                        type="number" value={settings.loudness.target_lra}
                        onChange={(e) => { updateLoudness({ target_lra: Number(e.target.value) }); markDirty(); }}
                        min={5} max={20} step={1}
                        className="w-full rounded-lg border border-[var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--dc-muted2)]">LU</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!settings.normalize_enabled && (
            <p className="text-xs text-[var(--dc-muted)] pl-1">
              Tracks will keep their original loudness levels. This may cause inconsistent volume during DJ sets.
            </p>
          )}
        </div>
      </section>

      {/* ─── Integrations ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YouTube Connection */}
        <div className="dc-glass-strong rounded-[2rem] p-6 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--dc-text)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--dc-accent-light)]" /> YouTube
            </h2>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={refreshCookiesStatus}
              disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-[var(--dc-chip)] transition-colors"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5 text-[var(--dc-muted)]", refreshing && "animate-spin")} />
            </motion.button>
          </div>

          <p className="text-xs text-[var(--dc-muted)] mb-4 leading-relaxed">
            Upload your browser cookies to enable YouTube downloads from the cloud.
          </p>

          {/* Status */}
          <div className="p-3 bg-[var(--dc-card2)] rounded-xl border border-[var(--dc-border)] mb-4 flex items-center gap-3">
            <div className={clsx(
              "h-2.5 w-2.5 rounded-full shrink-0",
              cookiesStatus?.configured
                ? "bg-[var(--dc-success-text)] shadow-[0_0_8px_var(--dc-success-text)]"
                : "bg-[var(--dc-warning-text)] shadow-[0_0_8px_var(--dc-warning-text)]"
            )} />
            <span className="text-xs font-bold text-[var(--dc-text)]">
              {cookiesStatus?.configured ? "Connected" : "Not Connected"}
            </span>
          </div>

          {/* Cookie Actions */}
          <div className="mt-auto">
            {cookiesStatus?.configured ? (
              <div className="flex items-center justify-between p-3 bg-[var(--dc-card2)] rounded-xl border border-[var(--dc-border)]">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--dc-success-text)]" />
                  <span className="text-xs font-bold text-[var(--dc-text)]">Cookies Active</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCookiesDelete}
                  className="p-2 rounded-lg text-[var(--dc-danger-text)] hover:bg-[var(--dc-danger-bg)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-[var(--dc-border)] text-xs font-bold text-[var(--dc-muted)] cursor-pointer hover:border-[var(--dc-accent)] hover:text-[var(--dc-text)] hover:bg-[var(--dc-accent-bg)] transition-all">
                <Upload className="w-3.5 h-3.5" />
                {cookiesUploading ? "Uploading…" : "Upload cookies.txt"}
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCookiesUpload(file);
                  }}
                  disabled={cookiesUploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Rekordbox Integration */}
        <div className="dc-glass-strong rounded-[2rem] p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--dc-text)] mb-3 flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-[var(--dc-accent-light)]" /> Rekordbox
            </h2>
            <p className="text-xs text-[var(--dc-muted)] mb-4 leading-relaxed">
              Auto-generate XML playlists sorted by energy, genre, and vibe. Imports directly into your Rekordbox collection.
            </p>
          </div>

          <label className="flex items-center gap-4 p-4 bg-[var(--dc-card2)] rounded-xl border border-[var(--dc-border)] cursor-pointer group">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={settings.rekordbox_xml_enabled}
                onChange={(e) => { updateSettings({ rekordbox_xml_enabled: e.target.checked }); markDirty(); }}
                className="peer sr-only"
              />
              <div className="w-10 h-5 bg-[var(--dc-chip-strong)] rounded-full peer-checked:bg-[var(--dc-accent)] transition-colors duration-300" />
              <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm" />
            </div>
            <span className="text-sm font-bold text-[var(--dc-text)] group-hover:text-[var(--dc-accent-light)] transition-colors">
              Auto-export Rekordbox XML
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
