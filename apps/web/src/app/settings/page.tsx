"use client";

import { useEffect, useCallback, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Save, AlertTriangle, ShieldCheck, Zap, Disc3, SlidersHorizontal, Upload, Trash2, RefreshCw } from "lucide-react";
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

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const updateLoudness = useSettingsStore((s) => s.updateLoudness);
  const setSaving = useSettingsStore((s) => s.setSaving);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // YouTube Auth state
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; method: string } | null>(null);
  const [cookiesStatus, setCookiesStatus] = useState<{ configured: boolean; source: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cookiesUploading, setCookiesUploading] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => { });
    api.getYoutubeAuthStatus().then(setAuthStatus).catch(() => { });
    api.getYoutubeCookiesStatus().then(setCookiesStatus).catch(() => { });
  }, [setSettings]);

  const refreshAuthStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const [auth, cookies] = await Promise.all([
        api.getYoutubeAuthStatus(),
        api.getYoutubeCookiesStatus(),
      ]);
      setAuthStatus(auth);
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
      toast.success("Cookies uploaded");
      refreshAuthStatus();
    } catch {
      toast.error("Failed to upload cookies");
    } finally {
      setCookiesUploading(false);
    }
  }, [refreshAuthStatus]);

  const handleCookiesDelete = useCallback(async () => {
    try {
      await api.deleteYoutubeCookies();
      toast.success("Cookies removed");
      refreshAuthStatus();
    } catch {
      toast.error("Failed to remove cookies");
    }
  }, [refreshAuthStatus]);

  const activePreset = detectPreset(settings);

  const applyPreset = useCallback(
    (key: string) => {
      const preset = PRESETS[key as keyof typeof PRESETS];
      if (!preset) return;
      updateSettings({ audio_format: preset.audio_format });
      updateLoudness(preset.loudness);
    },
    [updateSettings, updateLoudness]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [settings, setSaving]);

  if (loading) {
    return (
      <div className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 animate-pulse text-center py-20">
        <div className="inline-block relative">
          <Settings2 className="w-12 h-12 text-[var(--dc-muted)] animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 bg-[var(--dc-accent)] blur-xl opacity-20 rounded-full" />
        </div>
        <p className="mt-4 text-sm font-bold tracking-widest uppercase text-[var(--dc-muted)]">Loading Config...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 relative overflow-hidden shadow-2xl">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--dc-accent)] opacity-[0.05] blur-[120px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-[var(--dc-accent)]" />
            <h1 className="text-2xl font-bold tracking-tight text-[var(--dc-text)]">Settings Overview</h1>
          </div>
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[var(--dc-border)]">
            <span className="flex h-2 w-2 rounded-full bg-[var(--dc-success-text)] shadow-[0_0_8px_var(--dc-success-text)] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-success-text)]">
              System Online
            </span>
          </span>
        </div>

        {/* Quick Setup Presets */}
        <div className="relative z-10 mt-8">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--dc-muted)] mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Quick Config Profiles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={key}
                onClick={() => applyPreset(key)}
                className={clsx(
                  "relative p-5 text-left transition-all duration-300 rounded-2xl overflow-hidden group",
                  activePreset === key
                    ? "border-[var(--dc-accent-light)] shadow-[0_0_20px_var(--dc-accent-bg)] bg-[var(--dc-accent-bg)]"
                    : "border-[var(--dc-border-strong)] bg-[rgba(0,0,0,0.2)] hover:border-[var(--dc-accent)] hover:bg-[rgba(0,0,0,0.4)]"
                )}
                style={{ borderWidth: activePreset === key ? '2px' : '1px' }}
              >
                {activePreset === key && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--dc-accent)] to-transparent opacity-10 pointer-events-none" />
                )}
                <div className="relative z-10 flex items-center gap-3 mb-2">
                  <div
                    className={clsx(
                      "h-4 w-4 rounded-full flex items-center justify-center transition-colors",
                      activePreset === key
                        ? "bg-[var(--dc-accent-light)] shadow-[0_0_10px_var(--dc-accent-light)]"
                        : "bg-[var(--dc-chip-strong)] group-hover:bg-[var(--dc-border-strong)]"
                    )}
                  >
                    {activePreset === key && <div className="w-2 h-2 rounded-full bg-black" />}
                  </div>
                  <span className="text-sm font-bold text-[var(--dc-text)] tracking-wide">{preset.label}</span>
                </div>
                <p className="relative z-10 text-[11px] font-medium text-[var(--dc-muted)] leading-relaxed h-8">
                  {preset.description}
                </p>
                <div className="relative z-10 mt-4 flex gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-[var(--dc-chip)] px-2 py-1 text-[10px] font-bold tracking-wider text-[var(--dc-accent-light)] border border-[var(--dc-border)]">
                    {preset.audio_format.toUpperCase()}
                  </span>
                  <span className="inline-flex items-center justify-center rounded-md bg-[var(--dc-chip)] px-2 py-1 text-[10px] font-bold tracking-wider text-[var(--dc-muted)] border border-[var(--dc-border)]">
                    {preset.loudness.target_i} LUFS
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* General Settings */}
        <div className="relative z-10 mt-12 space-y-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--dc-muted)] border-b border-[var(--dc-border-strong)] pb-2 mb-4">
            Engine Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {/* Save To Folder */}
            <div className="dc-glass rounded-2xl p-5 group transition-colors hover:border-[var(--dc-accent-border)]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--dc-text)] mb-3">Output Directory</label>
              <input
                type="text"
                value={settings.inbox_dir}
                onChange={(e) => updateSettings({ inbox_dir: e.target.value })}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] px-4 py-3 text-sm text-[var(--dc-accent-light)] font-mono focus:border-[var(--dc-accent)] focus:bg-[rgba(0,0,0,0.5)] focus:shadow-[0_0_15px_var(--dc-accent-bg)] outline-none transition-all"
                placeholder="/path/to/music/folder"
              />
            </div>

            {/* Download Mode */}
            <div className="dc-glass rounded-2xl p-5 group transition-colors hover:border-[var(--dc-accent-border)]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--dc-text)] mb-3">Processing Engine Mode</label>
              <div className="relative">
                <select
                  value={settings.mode}
                  onChange={(e) => updateSettings({ mode: e.target.value as Settings["mode"] })}
                  className="w-full rounded-xl border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] px-4 py-3 text-sm font-bold text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:bg-[rgba(0,0,0,0.5)] outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="dj-safe">DJ-Safe (Full Processing & Analysis)</option>
                  <option value="fast">Fast (Direct Download Only)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-[var(--dc-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="relative z-10 mt-8">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full px-5 py-4 text-xs font-bold uppercase tracking-wider text-[var(--dc-text)] bg-[rgba(0,0,0,0.2)] rounded-2xl border border-[var(--dc-border)] hover:bg-[rgba(0,0,0,0.4)] transition-all"
          >
            <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" /> Advanced Audio Parameters</span>
            <svg
              className={clsx("h-4 w-4 transition-transform duration-300", showAdvanced && "rotate-180")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-6 dc-glass rounded-2xl border border-[var(--dc-border-strong)] p-6">
                  {/* Audio Format */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--dc-text)] mb-2">Target Encoding Format</label>
                    <div className="relative">
                      <select
                        value={settings.audio_format}
                        onChange={(e) => updateSettings({ audio_format: e.target.value as Settings["audio_format"] })}
                        className="w-full rounded-xl border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] px-4 py-3 text-sm font-bold text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none transition-all appearance-none cursor-pointer"
                      >
                        {FORMAT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label} — {f.desc}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-[var(--dc-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  {/* Normalize Toggle */}
                  <div className="flex items-center gap-4 bg-[rgba(0,0,0,0.2)] p-4 rounded-xl border border-[var(--dc-border)]">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        id="normalize"
                        checked={settings.normalize_enabled}
                        onChange={(e) => updateSettings({ normalize_enabled: e.target.checked })}
                        className="peer sr-only"
                      />
                      <div className="w-10 h-5 bg-[var(--dc-chip-strong)] rounded-full peer-checked:bg-[var(--dc-accent)] transition-colors duration-300"></div>
                      <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm"></div>
                    </div>
                    <label htmlFor="normalize" className="text-sm font-bold text-[var(--dc-text)] cursor-pointer select-none">
                      Enable LUFS Loudness Normalization
                    </label>
                  </div>

                  {/* Loudness Controls */}
                  {settings.normalize_enabled && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-accent-light)] flex items-center gap-2"><SlidersHorizontal className="w-3.5 h-3.5" /> Normalization Targets</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-[rgba(0,0,0,0.1)] p-3 rounded-xl border border-[var(--dc-border)]">
                          <label className="block text-[10px] uppercase font-bold text-[var(--dc-muted)] mb-2">Target LUFS</label>
                          <div className="relative">
                            <input
                              type="number" value={settings.loudness.target_i} onChange={(e) => updateLoudness({ target_i: Number(e.target.value) })} min={-23} max={-8} step={0.5}
                              className="w-full rounded-lg border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--dc-muted2)]">LUFS</span>
                          </div>
                        </div>

                        <div className="bg-[rgba(0,0,0,0.1)] p-3 rounded-xl border border-[var(--dc-border)]">
                          <label className="block text-[10px] uppercase font-bold text-[var(--dc-muted)] mb-2">True Peak Max</label>
                          <div className="relative">
                            <input
                              type="number" value={settings.loudness.target_tp} onChange={(e) => updateLoudness({ target_tp: Number(e.target.value) })} min={-5} max={0} step={0.1}
                              className="w-full rounded-lg border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--dc-muted2)]">dBTP</span>
                          </div>
                        </div>

                        <div className="bg-[rgba(0,0,0,0.1)] p-3 rounded-xl border border-[var(--dc-border)]">
                          <label className="block text-[10px] uppercase font-bold text-[var(--dc-muted)] mb-2">Dynamic Range</label>
                          <div className="relative">
                            <input
                              type="number" value={settings.loudness.target_lra} onChange={(e) => updateLoudness({ target_lra: Number(e.target.value) })} min={5} max={20} step={1}
                              className="w-full rounded-lg border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--dc-muted2)]">LU</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {!settings.normalize_enabled && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--dc-warning-bg)] border border-[var(--dc-warning-border)] text-[var(--dc-warning-text)]">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p className="text-xs font-medium leading-relaxed">
                        Loudness normalization is disabled. Tracks will be requested at their original volume, which may result in inconsistent output levels during DJ playback.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Integrations Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 relative z-10 transition-all">
          {/* YouTube Auth */}
          <div className="dc-glass rounded-2xl p-6 h-full flex flex-col hover:border-[var(--dc-accent-border)] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-[var(--dc-text)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--dc-accent-light)]" /> YouTube Authentication
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={refreshAuthStatus}
                  disabled={refreshing}
                  className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                >
                  <RefreshCw className={clsx("w-3.5 h-3.5 text-[var(--dc-muted)]", refreshing && "animate-spin")} />
                </motion.button>
              </div>
              <p className="text-xs text-[var(--dc-muted)] mb-4 leading-relaxed">
                PO Token auto-authentication — zero setup required. Cookies available as fallback.
              </p>

              <div className="p-3 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--dc-border)] mb-4 flex items-center gap-3">
                <div className={clsx(
                  "h-2.5 w-2.5 rounded-full shadow-[0_0_8px]",
                  authStatus?.authenticated
                    ? authStatus.method === "po_token"
                      ? "bg-[var(--dc-success-text)] shadow-[var(--dc-success-text)]"
                      : "bg-[var(--dc-warning-text)] shadow-[var(--dc-warning-text)]"
                    : "bg-[var(--dc-danger-text)] shadow-[var(--dc-danger-text)]"
                )} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[var(--dc-text)]">
                    {authStatus?.authenticated
                      ? authStatus.method === "po_token"
                        ? "Auto-Authenticated (PO Token)"
                        : "Authenticated (Cookies)"
                      : "No Authentication"}
                  </span>
                  {authStatus?.authenticated && (
                    <span className="text-[10px] font-mono text-[var(--dc-accent-light)] uppercase tracking-wider">
                      Method: {authStatus.method}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Cookies fallback */}
            <div className="mt-auto pt-4 border-t border-[var(--dc-border)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-muted)] mb-3">
                Fallback: Cookie Auth
              </h3>
              {cookiesStatus?.configured ? (
                <div className="flex items-center justify-between p-3 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--dc-border)]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--dc-success-text)]" />
                    <span className="text-xs font-bold text-[var(--dc-text)]">Cookies Active</span>
                    <span className="text-[10px] text-[var(--dc-muted)]">({cookiesStatus.source})</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCookiesDelete}
                    className="p-2 rounded-lg text-[var(--dc-danger-text)] hover:bg-[rgba(255,0,0,0.1)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[var(--dc-border)] text-xs font-bold text-[var(--dc-muted)] cursor-pointer hover:border-[var(--dc-accent)] hover:text-[var(--dc-text)] transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  {cookiesUploading ? "Uploading..." : "Upload cookies.txt"}
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
          <div className="dc-glass rounded-2xl p-6 h-full flex flex-col justify-between hover:border-[var(--dc-accent-border)] transition-colors">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[var(--dc-text)] mb-2 flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-[var(--dc-accent-light)]" /> Rekordbox Integration
              </h2>
              <p className="text-xs text-[var(--dc-muted)] mb-4 leading-relaxed">
                Auto-generate XML playlists with intelligent sorting (by energy, genre, vibe). Imports directly to your collection.
              </p>
            </div>

            <label className="flex items-center gap-4 mt-auto p-4 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--dc-border)] cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox" checked={settings.rekordbox_xml_enabled} onChange={(e) => updateSettings({ rekordbox_xml_enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="w-10 h-5 bg-[var(--dc-chip-strong)] rounded-full peer-checked:bg-[var(--dc-accent)] transition-colors duration-300"></div>
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-sm"></div>
              </div>
              <span className="text-sm font-bold text-[var(--dc-text)] group-hover:text-[var(--dc-accent-light)] transition-colors">
                Emit XML on Pipeline Completion
              </span>
            </label>
          </div>
        </div>

        {/* Floating Save Bar */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-6 px-6 py-4 bg-[rgba(20,20,20,0.85)] border border-[var(--dc-border-strong)] rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl w-full max-w-md"
        >
          <span className="text-sm font-bold tracking-wide text-[var(--dc-muted)] uppercase">
            Commit Config
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              "flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black uppercase tracking-widest text-[#050505] transition-all duration-300 shadow-[0_0_20px_var(--dc-accent-bg)]",
              saving
                ? "bg-[var(--dc-accent-light)] opacity-60 cursor-not-allowed"
                : "bg-gradient-to-r from-[var(--dc-accent)] to-[var(--dc-accent-light)] hover:shadow-[0_0_30px_var(--dc-accent-light)]"
            )}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                Writing
              </span>
            ) : (
              <>
                <Save className="w-4 h-4 fill-current" /> Save Network State
              </>
            )}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
