"use client";

import { useEffect, useCallback, useState, useRef } from "react";
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

  // YouTube Auth state
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; method: string } | null>(null);
  const [authFlow, setAuthFlow] = useState<{
    userCode: string;
    verificationUrl: string;
    deviceCode: string;
    interval: number;
    expiresAt: number;
  } | null>(null);
  const [authStarting, setAuthStarting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCookiesFallback, setShowCookiesFallback] = useState(false);
  const [cookiesUploading, setCookiesUploading] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {});
    api.getYoutubeAuthStatus().then(setAuthStatus).catch(() => {});
  }, [setSettings]);

  // Poll for OAuth2 token when auth flow is active
  useEffect(() => {
    if (!authFlow) return;

    pollingRef.current = setInterval(async () => {
      if (Date.now() > authFlow.expiresAt) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setAuthFlow(null);
        toast.error("Authorization timed out. Try again.");
        return;
      }
      try {
        const result = await api.pollYoutubeAuth(authFlow.deviceCode);
        if (result.status === "authorized") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setAuthFlow(null);
          setAuthStatus({ authenticated: true, method: "oauth2" });
          toast.success("YouTube account connected!");
        } else if (result.status === "denied" || result.status === "expired" || result.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setAuthFlow(null);
          toast.error(result.error || "Authorization failed");
        }
      } catch {
        // Network error — keep polling
      }
    }, (authFlow.interval || 5) * 1000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [authFlow]);

  const startYoutubeAuth = useCallback(async () => {
    setAuthStarting(true);
    try {
      const data = await api.startYoutubeAuth();
      setAuthFlow({
        userCode: data.user_code,
        verificationUrl: data.verification_url,
        deviceCode: data.device_code,
        interval: data.interval,
        expiresAt: Date.now() + data.expires_in * 1000,
      });
    } catch {
      toast.error("Failed to start YouTube sign-in");
    } finally {
      setAuthStarting(false);
    }
  }, []);

  const revokeYoutubeAuth = useCallback(async () => {
    try {
      await api.revokeYoutubeAuth();
      setAuthStatus({ authenticated: false, method: "none" });
      toast.success("YouTube account disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  }, []);

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

      {/* YouTube Authentication */}
      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--dc-text)]">YouTube Authentication</h2>
        <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] p-5 space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                authStatus?.authenticated ? "bg-green-500" : "bg-red-500"
              )}
            />
            <span className="text-sm text-[var(--dc-text)]">
              {authStatus?.authenticated
                ? authStatus.method === "oauth2"
                  ? "Signed in with YouTube"
                  : "Authenticated via cookies"
                : "Not connected"}
            </span>
          </div>

          {/* Active auth flow — show user code */}
          {authFlow && (
            <div className="dc-animate-fadeIn rounded-xl border border-[color:var(--dc-accent-border)] bg-[var(--dc-accent-bg)] p-4 space-y-3">
              <p className="text-sm font-medium text-[var(--dc-text)]">
                Go to the link below and enter this code:
              </p>
              <div className="flex items-center justify-center">
                <span className="rounded-lg bg-[var(--dc-card)] px-6 py-3 text-2xl font-mono font-bold tracking-widest text-[var(--dc-accent)]">
                  {authFlow.userCode}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <a
                  href={authFlow.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--dc-accent)] underline hover:opacity-80"
                >
                  {authFlow.verificationUrl}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(authFlow.userCode);
                    toast.success("Code copied!");
                  }}
                  className="rounded-lg bg-[var(--dc-chip)] px-2 py-1 text-[10px] font-medium text-[var(--dc-muted)] hover:bg-[var(--dc-chip-strong)] transition"
                >
                  Copy code
                </button>
              </div>
              <div className="flex items-center justify-center gap-2">
                <svg className="h-3.5 w-3.5 dc-animate-spin text-[var(--dc-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xs text-[var(--dc-muted)]">Waiting for authorization...</span>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setAuthFlow(null);
                  }}
                  className="text-xs text-[var(--dc-muted)] hover:text-[var(--dc-danger-text)] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Not authenticated — show sign in button */}
          {!authStatus?.authenticated && !authFlow && (
            <>
              <p className="text-xs text-[var(--dc-muted)]">
                Sign in with your YouTube/Google account to enable downloading.
                You&apos;ll be given a code to enter at google.com/device.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={startYoutubeAuth}
                  disabled={authStarting}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition",
                    authStarting
                      ? "bg-[var(--dc-accent)] opacity-60 cursor-not-allowed"
                      : "bg-[var(--dc-accent)] hover:opacity-90"
                  )}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.582 6.186a2.506 2.506 0 00-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418c-.86.23-1.538.908-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814c.23.86.908 1.538 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.504 2.504 0 001.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.464V8.536L16 12l-6 3.464z" />
                  </svg>
                  {authStarting ? "Starting..." : "Sign in with YouTube"}
                </button>
              </div>
            </>
          )}

          {/* Authenticated — show disconnect */}
          {authStatus?.authenticated && !authFlow && (
            <div className="flex items-center gap-3">
              <button
                onClick={revokeYoutubeAuth}
                className="rounded-xl border border-[color:var(--dc-danger-border)] px-4 py-2 text-xs font-medium text-[var(--dc-danger-text)] hover:bg-[var(--dc-danger-bg)] transition"
              >
                Disconnect YouTube
              </button>
            </div>
          )}

          {/* Cookies fallback */}
          {!authStatus?.authenticated && !authFlow && (
            <div className="border-t border-[color:var(--dc-border)] pt-3 mt-3">
              <button
                onClick={() => setShowCookiesFallback(!showCookiesFallback)}
                className="text-[11px] text-[var(--dc-muted2)] hover:text-[var(--dc-muted)] transition"
              >
                {showCookiesFallback ? "Hide" : "Alternative: Upload cookies.txt"}
              </button>
              {showCookiesFallback && (
                <div className="dc-animate-fadeIn mt-3 space-y-2">
                  <p className="text-xs text-[var(--dc-muted)]">
                    Export cookies using a browser extension and upload the file.
                  </p>
                  <label
                    className={clsx(
                      "inline-block cursor-pointer rounded-xl px-4 py-2 text-xs font-medium text-white transition",
                      cookiesUploading
                        ? "bg-[var(--dc-chip)] opacity-60 cursor-not-allowed"
                        : "bg-[var(--dc-chip-strong)] hover:opacity-90"
                    )}
                  >
                    {cookiesUploading ? "Uploading..." : "Upload cookies.txt"}
                    <input
                      type="file"
                      accept=".txt"
                      className="hidden"
                      disabled={cookiesUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setCookiesUploading(true);
                        try {
                          const result = await api.uploadYoutubeCookies(file);
                          if (result.ok) {
                            toast.success("Cookies uploaded");
                            const status = await api.getYoutubeAuthStatus();
                            setAuthStatus(status);
                          } else {
                            toast.error(result.error || "Upload failed");
                          }
                        } catch {
                          toast.error("Failed to upload cookies");
                        } finally {
                          setCookiesUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rekordbox Integration */}
      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--dc-text)]">Rekordbox Integration</h2>
        <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rekordbox-xml"
              checked={settings.rekordbox_xml_enabled}
              onChange={(e) => updateSettings({ rekordbox_xml_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--dc-border-strong)] text-[var(--dc-accent)] focus:ring-[var(--dc-accent-ring)]"
            />
            <label htmlFor="rekordbox-xml" className="text-sm text-[var(--dc-text)]">
              Generate Rekordbox XML after each batch
            </label>
          </div>
          <p className="text-xs text-[var(--dc-muted)]">
            Creates a <code className="rounded bg-[var(--dc-chip)] px-1 py-0.5 text-[10px] font-mono">dropcrate_import.xml</code> file
            in your inbox folder with auto-generated playlists by genre, energy, and time slot.
            Import in Rekordbox via File &gt; Import Collection in XML format.
          </p>
        </div>
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
