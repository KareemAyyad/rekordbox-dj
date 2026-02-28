"use client";

import { useEffect, useCallback, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, ShieldCheck, Zap, Disc3, SlidersHorizontal,
  Upload, Trash2, RefreshCw, Headphones, Radio,
  Music2, ChevronDown,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/lib/api-client";
import { PRESETS, FORMAT_OPTIONS } from "@/lib/constants";
import type { Settings } from "@/lib/types";

/* ─── Helpers ─── */

function detectPreset(s: Settings): string | null {
  for (const [key, preset] of Object.entries(PRESETS)) {
    if (
      s.audio_format === preset.audio_format &&
      s.loudness.target_i === preset.loudness.target_i &&
      s.loudness.target_tp === preset.loudness.target_tp &&
      s.loudness.target_lra === preset.loudness.target_lra
    ) return key;
  }
  return null;
}

const PRESET_META: Record<string, { icon: React.ReactNode; gradient: string }> = {
  club: {
    icon: <Headphones className="w-6 h-6" />,
    gradient: "from-cyan-500/20 to-blue-500/20",
  },
  streaming: {
    icon: <Music2 className="w-6 h-6" />,
    gradient: "from-violet-500/20 to-fuchsia-500/20",
  },
  radio: {
    icon: <Radio className="w-6 h-6" />,
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
};

/* ─── Custom Range Slider ─── */

function RangeSlider({
  label, value, onChange, min, max, step, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-[var(--dc-muted)] tracking-widest">{label}</span>
        <span className="text-xs font-mono font-bold text-[var(--dc-accent-light)]">{value} {unit}</span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--dc-chip-strong)]" />
        {/* Filled track */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-[var(--dc-accent)] to-[var(--dc-accent-light)]"
          style={{ width: `${pct}%` }}
        />
        {/* Glow behind thumb */}
        <div
          className="absolute w-4 h-4 rounded-full bg-[var(--dc-accent)] blur-md opacity-50 -translate-x-1/2 pointer-events-none"
          style={{ left: `${pct}%` }}
        />
        {/* Native range input */}
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        {/* Visual thumb */}
        <div
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-[var(--dc-accent)] shadow-[0_0_10px_var(--dc-accent-ring)] -translate-x-1/2 pointer-events-none transition-all"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const saving = useSettingsStore((s) => s.saving);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const updateLoudness = useSettingsStore((s) => s.updateLoudness);
  const setSaving = useSettingsStore((s) => s.setSaving);

  const [cookiesStatus, setCookiesStatus] = useState<{ configured: boolean; source: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cookiesUploading, setCookiesUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => { });
    api.getYoutubeCookiesStatus().then(setCookiesStatus).catch(() => { });
  }, [setSettings]);

  const markDirty = useCallback(() => setDirty(true), []);

  const refreshCookiesStatus = useCallback(async () => {
    setRefreshing(true);
    try { setCookiesStatus(await api.getYoutubeCookiesStatus()); }
    catch { toast.error("Failed to refresh"); }
    finally { setRefreshing(false); }
  }, []);

  const handleCookiesUpload = useCallback(async (file: File) => {
    setCookiesUploading(true);
    try {
      await api.uploadYoutubeCookies(file);
      toast.success("Cookies uploaded — YouTube downloads should work now");
      refreshCookiesStatus();
    } catch { toast.error("Failed to upload cookies"); }
    finally { setCookiesUploading(false); }
  }, [refreshCookiesStatus]);

  const handleCookiesDelete = useCallback(async () => {
    try { await api.deleteYoutubeCookies(); toast.success("Cookies removed"); refreshCookiesStatus(); }
    catch { toast.error("Failed to remove cookies"); }
  }, [refreshCookiesStatus]);

  const activePreset = detectPreset(settings);

  const applyPreset = useCallback((key: string) => {
    const preset = PRESETS[key as keyof typeof PRESETS];
    if (!preset) return;
    updateSettings({ audio_format: preset.audio_format });
    updateLoudness(preset.loudness);
    markDirty();
  }, [updateSettings, updateLoudness, markDirty]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try { await api.updateSettings(settings); setDirty(false); toast.success("Preferences saved"); }
    catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }, [settings, setSaving]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="relative">
          <SlidersHorizontal className="w-10 h-10 text-[var(--dc-accent)] animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 bg-[var(--dc-accent)] blur-2xl opacity-30 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">

      {/* ═══════════════ Header ═══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--dc-text)]">Preferences</h1>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            "flex items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold tracking-wide transition-all duration-500",
            saving
              ? "bg-[var(--dc-accent)] opacity-50 cursor-not-allowed text-[var(--dc-accent-contrast)]"
              : dirty
                ? "bg-gradient-to-r from-[var(--dc-accent)] to-[var(--dc-accent-light)] text-[var(--dc-accent-contrast)] shadow-[0_0_30px_var(--dc-accent-ring)] hover:shadow-[0_0_50px_var(--dc-accent-ring)]"
                : "bg-[var(--dc-card)] text-[var(--dc-muted)] border border-[var(--dc-border-strong)] hover:border-[var(--dc-accent-border)] hover:text-[var(--dc-text)]"
          )}
        >
          {saving ? (
            <><span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Saving…</>
          ) : (
            <><Save className="w-4 h-4" /> {dirty ? "Save Changes" : "Save"}</>
          )}
        </motion.button>
      </motion.div>

      {/* ═══════════════ Quick Profiles ═══════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="dc-glass-strong rounded-[2rem] p-8 relative overflow-hidden"
      >
        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-[400px] h-[400px] bg-[var(--dc-accent)] opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[300px] h-[300px] bg-purple-500 opacity-[0.02] blur-[80px] rounded-full pointer-events-none" />

        <h2 className="relative z-10 text-xs font-black uppercase tracking-[0.2em] text-[var(--dc-muted)] mb-6 flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-[var(--dc-accent)]" /> Quick Profiles
        </h2>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {Object.entries(PRESETS).map(([key, preset]) => {
            const active = activePreset === key;
            const meta = PRESET_META[key];
            return (
              <motion.button
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.97 }}
                key={key}
                onClick={() => applyPreset(key)}
                className={clsx(
                  "relative flex flex-col items-center text-center p-6 rounded-2xl transition-all duration-500 overflow-hidden group",
                  active
                    ? "border-2 border-[var(--dc-accent-light)] bg-[var(--dc-accent-bg)] shadow-[0_0_40px_var(--dc-accent-ring)]"
                    : "border border-[var(--dc-border-strong)] bg-[var(--dc-card2)] hover:border-[var(--dc-accent-border)] hover:shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
                )}
              >
                {/* Glow behind icon */}
                {active && (
                  <div className="absolute inset-0 bg-gradient-to-b from-[var(--dc-accent)] to-transparent opacity-[0.06] pointer-events-none" />
                )}

                {/* Icon container */}
                <div className={clsx(
                  "relative w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-500",
                  active
                    ? "bg-[var(--dc-accent)] text-[var(--dc-accent-contrast)] shadow-[0_0_30px_var(--dc-accent-ring)]"
                    : `bg-gradient-to-br ${meta?.gradient || ''} text-[var(--dc-muted)] group-hover:text-[var(--dc-accent-light)] border border-[var(--dc-border-strong)]`
                )}>
                  {meta?.icon || <Music2 className="w-6 h-6" />}
                  {active && (
                    <div className="absolute inset-0 rounded-full bg-[var(--dc-accent)] animate-ping opacity-20" />
                  )}
                </div>

                <span className="text-sm font-bold text-[var(--dc-text)] tracking-wide mb-1">{preset.label}</span>
                <p className="text-[11px] text-[var(--dc-muted)] leading-relaxed mb-4">{preset.description}</p>

                <div className="flex gap-2">
                  <span className={clsx(
                    "rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider border",
                    active
                      ? "bg-[var(--dc-accent-bg)] text-[var(--dc-accent-light)] border-[var(--dc-accent-border)]"
                      : "bg-[var(--dc-chip)] text-[var(--dc-muted)] border-[var(--dc-border)]"
                  )}>
                    {preset.audio_format.toUpperCase()}
                  </span>
                  <span className="rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider bg-[var(--dc-chip)] text-[var(--dc-muted)] border border-[var(--dc-border)]">
                    {preset.loudness.target_i} LUFS
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      {/* ═══════════════ Audio Settings ═══════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="dc-glass-strong rounded-[2rem] p-8 space-y-8"
      >
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--dc-muted)] flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-[var(--dc-accent)]" /> Audio Settings
        </h2>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--dc-muted)] mb-2.5">Processing Mode</label>
            <div className="relative">
              <select
                value={settings.mode}
                onChange={(e) => { updateSettings({ mode: e.target.value as Settings["mode"] }); markDirty(); }}
                className="w-full rounded-xl border border-[var(--dc-border-strong)] bg-[var(--dc-card)] px-4 py-3.5 text-sm font-bold text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:shadow-[0_0_20px_var(--dc-accent-ring)] outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="dj-safe">DJ-Safe (Full Processing)</option>
                <option value="fast">Fast (Direct Download)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dc-muted)] pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--dc-muted)] mb-2.5">Audio Format</label>
            <div className="relative">
              <select
                value={settings.audio_format}
                onChange={(e) => { updateSettings({ audio_format: e.target.value as Settings["audio_format"] }); markDirty(); }}
                className="w-full rounded-xl border border-[var(--dc-border-strong)] bg-[var(--dc-card)] px-4 py-3.5 text-sm font-bold text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:shadow-[0_0_20px_var(--dc-accent-ring)] outline-none transition-all appearance-none cursor-pointer"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dc-muted)] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Normalization */}
        <div className="space-y-5">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--dc-card2)] border border-[var(--dc-border)]">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.normalize_enabled}
                onChange={(e) => { updateSettings({ normalize_enabled: e.target.checked }); markDirty(); }}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-[var(--dc-chip-strong)] rounded-full peer-checked:bg-[var(--dc-accent)] transition-colors duration-500" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-md" />
            </label>
            <div>
              <span className="text-sm font-bold text-[var(--dc-text)] block">Loudness Normalization</span>
              <span className="text-[11px] text-[var(--dc-muted)]">Consistent volume across all tracks</span>
            </div>
          </div>

          <AnimatePresence>
            {settings.normalize_enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-5 p-5 rounded-xl bg-[var(--dc-card2)] border border-[var(--dc-border)]">
                  <RangeSlider
                    label="Target LUFS" value={settings.loudness.target_i}
                    onChange={(v) => { updateLoudness({ target_i: v }); markDirty(); }}
                    min={-23} max={-8} step={0.5} unit="LUFS"
                  />
                  <RangeSlider
                    label="True Peak" value={settings.loudness.target_tp}
                    onChange={(v) => { updateLoudness({ target_tp: v }); markDirty(); }}
                    min={-5} max={0} step={0.1} unit="dBTP"
                  />
                  <RangeSlider
                    label="Dynamic Range" value={settings.loudness.target_lra}
                    onChange={(v) => { updateLoudness({ target_lra: v }); markDirty(); }}
                    min={5} max={20} step={1} unit="LU"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!settings.normalize_enabled && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-[var(--dc-muted)] pl-1 italic"
            >
              Tracks will keep their original loudness — may cause inconsistent volume during sets.
            </motion.p>
          )}
        </div>
      </motion.section>

      {/* ═══════════════ Integrations ═══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* YouTube */}
        <div className="dc-glass-strong rounded-[2rem] p-7 flex flex-col relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-[200px] h-[200px] bg-red-500 opacity-[0.02] blur-[60px] rounded-full pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--dc-text)] flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--dc-accent-light)]" /> YouTube
            </h2>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={refreshCookiesStatus}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-[var(--dc-chip)] transition-colors"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5 text-[var(--dc-muted)]", refreshing && "animate-spin")} />
            </motion.button>
          </div>

          <p className="text-xs text-[var(--dc-muted)] mb-5 leading-relaxed">
            Upload your browser cookies to enable YouTube downloads from the cloud.
          </p>

          {/* Connection badge */}
          <div className={clsx(
            "p-4 rounded-xl border flex items-center gap-3 mb-5 transition-all duration-500",
            cookiesStatus?.configured
              ? "bg-[var(--dc-success-bg)] border-[var(--dc-success-border)]"
              : "bg-[var(--dc-card2)] border-[var(--dc-border)]"
          )}>
            <div className={clsx(
              "h-3 w-3 rounded-full shrink-0 transition-all",
              cookiesStatus?.configured
                ? "bg-[var(--dc-success-text)] shadow-[0_0_12px_var(--dc-success-text)]"
                : "bg-[var(--dc-muted2)]"
            )} />
            <span className={clsx(
              "text-sm font-bold",
              cookiesStatus?.configured ? "text-[var(--dc-success-text)]" : "text-[var(--dc-muted)]"
            )}>
              {cookiesStatus?.configured ? "Connected" : "Not Connected"}
            </span>
          </div>

          {/* Cookie actions */}
          <div className="mt-auto">
            {cookiesStatus?.configured ? (
              <div className="flex items-center justify-between p-3.5 bg-[var(--dc-card2)] rounded-xl border border-[var(--dc-border)]">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--dc-success-text)]" />
                  <span className="text-xs font-bold text-[var(--dc-text)]">Cookies Active</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleCookiesDelete}
                  className="p-2 rounded-lg text-[var(--dc-danger-text)] hover:bg-[var(--dc-danger-bg)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[var(--dc-border-strong)] text-xs font-bold text-[var(--dc-muted)] cursor-pointer hover:border-[var(--dc-accent)] hover:text-[var(--dc-accent-light)] hover:bg-[var(--dc-accent-bg)] transition-all duration-300 group">
                <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {cookiesUploading ? "Uploading…" : "Upload cookies.txt"}
                <input
                  type="file" accept=".txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCookiesUpload(f); }}
                  disabled={cookiesUploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Rekordbox */}
        <div className="dc-glass-strong rounded-[2rem] p-7 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -bottom-16 -left-16 w-[200px] h-[200px] bg-[var(--dc-accent)] opacity-[0.03] blur-[60px] rounded-full pointer-events-none" />

          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--dc-text)] mb-3 flex items-center gap-2.5">
              <Disc3 className="w-4 h-4 text-[var(--dc-accent-light)]" /> Rekordbox
            </h2>
            <p className="text-xs text-[var(--dc-muted)] mb-6 leading-relaxed">
              Auto-generate XML playlists sorted by energy, genre, and vibe. Imports directly into your Rekordbox collection.
            </p>
          </div>

          <label className="flex items-center gap-4 p-5 bg-[var(--dc-card2)] rounded-xl border border-[var(--dc-border)] cursor-pointer group hover:border-[var(--dc-accent-border)] transition-all duration-300">
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={settings.rekordbox_xml_enabled}
                onChange={(e) => { updateSettings({ rekordbox_xml_enabled: e.target.checked }); markDirty(); }}
                className="peer sr-only"
              />
              <div className="w-11 h-6 bg-[var(--dc-chip-strong)] rounded-full peer-checked:bg-[var(--dc-accent)] transition-colors duration-500" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-5 shadow-md" />
            </div>
            <span className="text-sm font-bold text-[var(--dc-text)] group-hover:text-[var(--dc-accent-light)] transition-colors">
              Auto-export Rekordbox XML
            </span>
          </label>
        </div>
      </motion.div>
    </div>
  );
}
