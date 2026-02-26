"use client";

import { useEffect, useCallback, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
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

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
  }, [setSettings]);

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
      <div className="rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-6 shadow-[var(--dc-shadow)]">
        <div className="space-y-4">
          <div className="dc-skeleton h-6 w-32" />
          <div className="dc-skeleton h-4 w-64" />
          <div className="dc-skeleton h-20 w-full rounded-xl" />
          <div className="dc-skeleton h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-6 shadow-[var(--dc-shadow)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--dc-text)]">Settings</h1>
        <span className="rounded-full bg-[var(--dc-chip)] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--dc-muted)]">
          Global
        </span>
      </div>

      {/* Quick Setup Presets */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-[var(--dc-text)]">Quick Setup</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className={clsx(
                "rounded-2xl border p-4 text-left transition",
                activePreset === key
                  ? "border-[color:var(--dc-accent-border)] bg-[var(--dc-accent-bg)] ring-2 ring-[var(--dc-accent-ring)]"
                  : "border-[color:var(--dc-border)] bg-[var(--dc-card2)] hover:border-[color:var(--dc-border-strong)]"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    "h-3 w-3 rounded-full border-2",
                    activePreset === key
                      ? "border-[var(--dc-accent)] bg-[var(--dc-accent)]"
                      : "border-[var(--dc-border-strong)]"
                  )}
                />
                <span className="text-sm font-medium text-[var(--dc-text)]">{preset.label}</span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--dc-muted)]">{preset.description}</p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full bg-[var(--dc-chip)] px-2 py-0.5 text-[10px] font-medium text-[var(--dc-muted)]">
                  {preset.audio_format.toUpperCase()}
                </span>
                <span className="rounded-full bg-[var(--dc-chip)] px-2 py-0.5 text-[10px] font-medium text-[var(--dc-muted)]">
                  {preset.loudness.target_i} LUFS
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* General Settings */}
      <div className="mt-8 space-y-5">
        <h2 className="text-sm font-semibold text-[var(--dc-text)]">General</h2>

        {/* Save To Folder */}
        <div>
          <label className="block text-xs font-medium text-[var(--dc-muted)] mb-1.5">Save To Folder</label>
          <input
            type="text"
            value={settings.inbox_dir}
            onChange={(e) => updateSettings({ inbox_dir: e.target.value })}
            className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-4 py-2.5 text-sm text-[var(--dc-text)] font-mono focus:border-[var(--dc-accent)] focus:ring-2 focus:ring-[var(--dc-accent-ring)] focus:outline-none"
          />
        </div>

        {/* Download Mode */}
        <div>
          <label className="block text-xs font-medium text-[var(--dc-muted)] mb-1.5">Download Mode</label>
          <select
            value={settings.mode}
            onChange={(e) => updateSettings({ mode: e.target.value as Settings["mode"] })}
            className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-4 py-2.5 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none"
          >
            <option value="dj-safe">Full Quality (DJ-Safe)</option>
            <option value="fast">Quick Download (Fast)</option>
          </select>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="mt-8">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--dc-text)] hover:text-[var(--dc-accent)] transition"
        >
          <svg
            className={clsx("h-4 w-4 transition-transform", showAdvanced && "rotate-90")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="dc-animate-slideUp mt-4 space-y-5 rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] p-5">
            {/* Audio Format */}
            <div>
              <label className="block text-xs font-medium text-[var(--dc-muted)] mb-1.5">Output Format</label>
              <select
                value={settings.audio_format}
                onChange={(e) => updateSettings({ audio_format: e.target.value as Settings["audio_format"] })}
                className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-4 py-2.5 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label} — {f.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Normalize Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="normalize"
                checked={settings.normalize_enabled}
                onChange={(e) => updateSettings({ normalize_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-[var(--dc-border-strong)] text-[var(--dc-accent)] focus:ring-[var(--dc-accent-ring)]"
              />
              <label htmlFor="normalize" className="text-sm text-[var(--dc-text)]">
                Make all tracks the same volume (loudness normalization)
              </label>
            </div>

            {/* Loudness Controls */}
            {settings.normalize_enabled && (
              <div className="space-y-4 mt-2">
                <h3 className="text-xs font-semibold text-[var(--dc-muted)] uppercase tracking-wider">Volume Settings</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--dc-muted)] mb-1">Target LUFS</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.loudness.target_i}
                        onChange={(e) => updateLoudness({ target_i: Number(e.target.value) })}
                        min={-23}
                        max={-8}
                        step={0.5}
                        className="w-full rounded-lg border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 pr-12 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--dc-muted2)]">LUFS</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--dc-muted)] mb-1">Max Peak</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.loudness.target_tp}
                        onChange={(e) => updateLoudness({ target_tp: Number(e.target.value) })}
                        min={-5}
                        max={0}
                        step={0.1}
                        className="w-full rounded-lg border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 pr-12 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--dc-muted2)]">dBTP</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--dc-muted)] mb-1">Dynamic Range</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.loudness.target_lra}
                        onChange={(e) => updateLoudness({ target_lra: Number(e.target.value) })}
                        min={5}
                        max={20}
                        step={1}
                        className="w-full rounded-lg border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 pr-8 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--dc-muted2)]">LU</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!settings.normalize_enabled && (
              <p className="text-xs text-[var(--dc-muted)] italic">
                Loudness normalization is disabled. Tracks will be transcoded without volume adjustment.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            "rounded-xl px-6 py-2.5 text-sm font-medium text-white transition",
            saving
              ? "bg-[var(--dc-accent)] opacity-60 cursor-not-allowed"
              : "bg-[var(--dc-accent)] hover:opacity-90"
          )}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
