import { useState } from "react";
import { Tooltip } from "../components/Tooltip";
import { useToast } from "../components/Toast";
import { getBackend } from "../../state/backend";
import { Badge, Button, Card, FormField, NumberInput, Select, Checkbox, TextInput } from "../components/ui";

interface Settings {
  inboxDir: string;
  mode: "dj-safe" | "fast";
  audioFormat: "aiff" | "wav" | "flac" | "mp3";
  normalizeEnabled: boolean;
  loudness: {
    targetI: number;
    targetTP: number;
    targetLRA: number;
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Presets - Easy one-click configurations for common use cases
   ───────────────────────────────────────────────────────────────────────────── */
type PresetKey = "club" | "streaming" | "radio" | "custom";

interface Preset {
  label: string;
  description: string;
  audioFormat: Settings["audioFormat"];
  normalizeEnabled: boolean;
  loudness: Settings["loudness"];
}

const PRESETS: Record<Exclude<PresetKey, "custom">, Preset> = {
  club: {
    label: "Club / Festival",
    description: "Best for DJing - loud, punchy, industry standard",
    audioFormat: "aiff",
    normalizeEnabled: true,
    loudness: { targetI: -14, targetTP: -1.0, targetLRA: 11 },
  },
  streaming: {
    label: "YouTube / Spotify",
    description: "Optimized for streaming platforms",
    audioFormat: "flac",
    normalizeEnabled: true,
    loudness: { targetI: -14, targetTP: -1.0, targetLRA: 11 },
  },
  radio: {
    label: "Radio / Podcast",
    description: "Broadcast-friendly with more headroom",
    audioFormat: "wav",
    normalizeEnabled: true,
    loudness: { targetI: -16, targetTP: -1.0, targetLRA: 8 },
  },
};

const PRESET_OPTIONS = [
  { value: "club", label: "Club / Festival (Recommended)" },
  { value: "streaming", label: "YouTube / Spotify" },
  { value: "radio", label: "Radio / Podcast" },
  { value: "custom", label: "Custom Settings" },
];

const AUDIO_FORMAT_OPTIONS = [
  { value: "aiff", label: "AIFF - Best for DJing (Lossless)" },
  { value: "wav", label: "WAV - Universal (Lossless)" },
  { value: "flac", label: "FLAC - Smaller files (Lossless)" },
  { value: "mp3", label: "MP3 - Smallest files (Lossy)" },
];

const MODE_OPTIONS = [
  { value: "dj-safe", label: "Full Quality (Recommended)" },
  { value: "fast", label: "Quick Download (No Processing)" },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Helper to detect which preset matches current settings
   ───────────────────────────────────────────────────────────────────────────── */
function detectPreset(settings: Settings): PresetKey {
  for (const [key, preset] of Object.entries(PRESETS) as [Exclude<PresetKey, "custom">, Preset][]) {
    if (
      settings.audioFormat === preset.audioFormat &&
      settings.normalizeEnabled === preset.normalizeEnabled &&
      settings.loudness.targetI === preset.loudness.targetI &&
      settings.loudness.targetTP === preset.loudness.targetTP &&
      settings.loudness.targetLRA === preset.loudness.targetLRA
    ) {
      return key;
    }
  }
  return "custom";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────────────────────────── */
export function SettingsView(props: {
  settings: {
    inboxDir: string;
    mode: "dj-safe" | "fast";
    audioFormat?: "aiff" | "wav" | "flac" | "mp3";
    normalizeEnabled?: boolean;
    loudness: { targetI: number; targetTP: number; targetLRA: number };
  };
  onSettingsChange: (next: Settings) => void;
}): JSX.Element {
  const backend = getBackend();
  const { addToast } = useToast();

  // Local state for form (no auto-save)
  const [localSettings, setLocalSettings] = useState<Settings>({
    inboxDir: props.settings.inboxDir,
    mode: props.settings.mode,
    audioFormat: props.settings.audioFormat ?? "aiff",
    normalizeEnabled: props.settings.normalizeEnabled ?? true,
    loudness: { ...props.settings.loudness },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentPreset = detectPreset(localSettings);

  const handlePresetChange = (presetKey: string) => {
    if (presetKey === "custom") {
      setShowAdvanced(true);
      return;
    }
    const preset = PRESETS[presetKey as Exclude<PresetKey, "custom">];
    if (preset) {
      setLocalSettings((prev) => ({
        ...prev,
        audioFormat: preset.audioFormat,
        normalizeEnabled: preset.normalizeEnabled,
        loudness: { ...preset.loudness },
      }));
      setShowAdvanced(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      props.onSettingsChange(localSettings);
      await backend.settings.set({
        inboxDir: localSettings.inboxDir,
        mode: localSettings.mode,
        loudness: localSettings.loudness,
      });
      addToast("success", "Settings saved successfully");
    } catch {
      addToast("error", "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const updateLoudness = (key: keyof Settings["loudness"], value: number) => {
    setLocalSettings((prev) => ({
      ...prev,
      loudness: { ...prev.loudness, [key]: value },
    }));
  };

  return (
    <Card className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-[color:var(--dc-border)]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--dc-text)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--dc-muted)]">
            Choose how your tracks are processed and saved
          </p>
        </div>
        <Badge className="rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
          Global
        </Badge>
      </div>

      {/* Quick Setup - Presets */}
      <section className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--dc-text)]">Quick Setup</h2>
            <p className="text-xs text-[var(--dc-muted)]">Choose a preset that matches your needs</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.entries(PRESETS) as [Exclude<PresetKey, "custom">, Preset][]).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePresetChange(key)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                currentPreset === key
                  ? "border-[var(--dc-accent)] bg-[var(--dc-accent-bg)]"
                  : "border-[var(--dc-border)] bg-[var(--dc-card2)] hover:border-[var(--dc-border-strong)] hover:bg-[var(--dc-card2-hover)]"
              }`}
            >
              {currentPreset === key && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-[var(--dc-accent)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="text-sm font-semibold text-[var(--dc-text)]">{preset.label}</div>
              <div className="mt-1 text-xs text-[var(--dc-muted)]">{preset.description}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="inline-flex items-center rounded-md bg-[var(--dc-chip)] px-2 py-0.5 text-[10px] font-medium text-[var(--dc-muted)]">
                  {preset.audioFormat.toUpperCase()}
                </span>
                <span className="inline-flex items-center rounded-md bg-[var(--dc-chip)] px-2 py-0.5 text-[10px] font-medium text-[var(--dc-muted)]">
                  {preset.loudness.targetI} LUFS
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* General Section */}
      <section className="mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--dc-text)]">Download Location</h2>
            <p className="text-xs text-[var(--dc-muted)]">Where your processed tracks are saved</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField label="Save To Folder" hint="your DJ library folder">
            <TextInput
              value={localSettings.inboxDir}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, inboxDir: e.target.value }))}
              placeholder="./DJ Library/00_INBOX/"
            />
          </FormField>

          <FormField label="Download Mode" hint="how tracks are processed">
            <Tooltip
              title="Download Mode"
              body="Full Quality: Downloads, converts to lossless format, and normalizes volume for consistent playback. Quick Download: Keeps original format, no processing."
            >
              <Select
                value={localSettings.mode}
                onChange={(value) => setLocalSettings((prev) => ({ ...prev, mode: value as Settings["mode"] }))}
                options={MODE_OPTIONS}
              />
            </Tooltip>
          </FormField>
        </div>
      </section>

      {/* Advanced Settings Toggle */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--dc-accent)] hover:underline"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
        </button>
      </div>

      {/* Advanced Settings (collapsible) */}
      {showAdvanced && (
        <div className="mt-6 space-y-10 rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] p-6">
          {/* Audio Format Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--dc-text)]">Audio Format</h2>
                <p className="text-xs text-[var(--dc-muted)]">Choose file format and quality</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Output Format" hint="AIFF recommended for DJ software">
                <Select
                  value={localSettings.audioFormat}
                  onChange={(value) => setLocalSettings((prev) => ({ ...prev, audioFormat: value as Settings["audioFormat"] }))}
                  options={AUDIO_FORMAT_OPTIONS}
                />
              </FormField>

              <div className="flex items-end pb-2">
                <Checkbox
                  checked={localSettings.normalizeEnabled}
                  onChange={(checked) => setLocalSettings((prev) => ({ ...prev, normalizeEnabled: checked }))}
                  label="Make all tracks the same volume"
                />
              </div>
            </div>
          </section>

          {/* Volume Normalization Section */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--dc-text)]">Volume Settings</h2>
                <Tooltip
                  title="What do these numbers mean?"
                  body="Target Volume (LUFS): How loud your tracks will be. -14 is industry standard. Max Peak (dBTP): Prevents distortion and clipping. -1.0 is safe. Dynamic Range (LU): How much volume variation is allowed. Higher = more natural, lower = more compressed."
                >
                  <p className="text-xs text-[var(--dc-muted)] cursor-help underline decoration-dotted underline-offset-2">
                    Fine-tune volume normalization (for experts)
                  </p>
                </Tooltip>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <FormField label="Target Volume" hint="how loud tracks will be">
                <NumberInput
                  value={localSettings.loudness.targetI}
                  onChange={(value) => updateLoudness("targetI", value)}
                  min={-70}
                  max={0}
                  step={0.5}
                  unit="LUFS"
                  disabled={!localSettings.normalizeEnabled}
                />
              </FormField>

              <FormField label="Max Peak" hint="prevents distortion">
                <NumberInput
                  value={localSettings.loudness.targetTP}
                  onChange={(value) => updateLoudness("targetTP", value)}
                  min={-10}
                  max={0}
                  step={0.1}
                  unit="dBTP"
                  disabled={!localSettings.normalizeEnabled}
                />
              </FormField>

              <FormField label="Dynamic Range" hint="volume variation">
                <NumberInput
                  value={localSettings.loudness.targetLRA}
                  onChange={(value) => updateLoudness("targetLRA", value)}
                  min={1}
                  max={20}
                  step={1}
                  unit="LU"
                  disabled={!localSettings.normalizeEnabled}
                />
              </FormField>
            </div>

            {!localSettings.normalizeEnabled && (
              <p className="mt-4 text-xs text-[var(--dc-muted)] italic">
                Volume normalization is off. Your tracks will keep their original volume levels.
              </p>
            )}
          </section>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-10 pt-6 border-t border-[color:var(--dc-border)] flex items-center justify-end gap-4">
        <p className="text-xs text-[var(--dc-muted)]">Click save to apply your changes</p>
        <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </Card>
  );
}
