export const PRESETS = {
  club: {
    label: "Club / Festival",
    description: "DJ-safe AIFF at -14 LUFS",
    audio_format: "aiff" as const,
    loudness: { target_i: -14, target_tp: -1, target_lra: 11 },
  },
  streaming: {
    label: "YouTube / Spotify",
    description: "FLAC at -14 LUFS",
    audio_format: "flac" as const,
    loudness: { target_i: -14, target_tp: -1, target_lra: 11 },
  },
  radio: {
    label: "Radio / Podcast",
    description: "WAV at -16 LUFS",
    audio_format: "wav" as const,
    loudness: { target_i: -16, target_tp: -1, target_lra: 11 },
  },
} as const;

export const FORMAT_OPTIONS = [
  { value: "aiff", label: "AIFF", desc: "Lossless, DJ-standard, Mac-native" },
  { value: "wav", label: "WAV", desc: "Lossless, universal PCM" },
  { value: "flac", label: "FLAC", desc: "Lossless, compressed, open-source" },
  { value: "mp3", label: "MP3", desc: "Lossy, small file size" },
] as const;

export const SEGMENT_CATEGORIES = [
  { label: "Vocals", desc: "Singing voice and vocal harmonies" },
  { label: "Drums & Percussion", desc: "Drums, hi-hats, cymbals, and percussion" },
  { label: "Bass", desc: "Bass line and sub bass" },
  { label: "Guitar", desc: "Guitar, acoustic and electric" },
  { label: "Piano & Keys", desc: "Piano, keyboard, and synth melodies" },
  { label: "Pads & Atmosphere", desc: "Ambient pads and atmospheric textures" },
  { label: "Strings", desc: "Strings, violins, and orchestral elements" },
  { label: "Effects & FX", desc: "Sound effects, risers, sweeps, and transitions" },
] as const;

export const STAGE_LABELS: Record<string, string> = {
  metadata: "Fetching info",
  classify: "Classifying",
  download: "Downloading",
  fingerprint: "Fingerprinting",
  analysis: "Analyzing key & BPM",
  normalize: "Normalizing",
  transcode: "Transcoding",
  tag: "Tagging",
  finalize: "Finalizing",
};
