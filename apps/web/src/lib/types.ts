export type AppTab = "queue" | "library" | "settings" | "segment";

export type QueueItemStatus = "queued" | "running" | "done" | "error";

export type DownloadStage =
  | "metadata"
  | "classify"
  | "download"
  | "fingerprint"
  | "normalize"
  | "transcode"
  | "tag"
  | "finalize";

export type DJTags = {
  genre: string;
  energy: string;
  time: string;
  vibe: string;
};

export type AutoClassification = {
  status: "idle" | "running" | "done" | "error";
  confidence?: number;
  notes?: string;
  kind?: string;
  stage?: DownloadStage;
};

export type QueueItem = {
  id: string;
  url: string;
  status: QueueItemStatus;
  message?: string;
  presetSnapshot: DJTags;
  auto?: AutoClassification;
};

export type LibraryItem = {
  id: string;
  file_path: string;
  download_url: string;
  artist: string;
  title: string;
  genre: string;
  energy?: string;
  time?: string;
  vibe?: string;
  duration_seconds?: number;
  audio_format?: string;
  downloaded_at: string;
};

export type LoudnessConfig = {
  target_i: number;
  target_tp: number;
  target_lra: number;
};

export type Settings = {
  inbox_dir: string;
  mode: "dj-safe" | "fast";
  audio_format: "aiff" | "wav" | "flac" | "mp3";
  normalize_enabled: boolean;
  loudness: LoudnessConfig;
  rekordbox_xml_enabled: boolean;
};

export type ClassifyResult = {
  id: string;
  kind: string;
  genre: string | null;
  energy: string | null;
  time: string | null;
  vibe: string | null;
  confidence: number;
  notes: string;
};

export type SSEEvent =
  | { type: "queue-start"; job_id: string; count: number; inbox_dir: string; mode: string }
  | { type: "item-start"; job_id: string; item_id: string; url: string }
  | { type: "item-progress"; job_id: string; item_id: string; url: string; stage: DownloadStage }
  | { type: "item-done"; job_id: string; item_id: string; url: string }
  | { type: "item-error"; job_id: string; item_id: string; url: string; error: string }
  | { type: "queue-done"; job_id: string };

// --- Segment (SAM-Audio) ---

export type SegmentItem = {
  id: string;
  prompt: string;
  label: string;
  targetUrl: string;
  residualUrl: string;
  durationSeconds: number;
};

export type SegmentSession = {
  id: string;
  filename: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
};

export type SegmentSSEEvent =
  | { type: "auto-start"; total: number }
  | { type: "model-loading" }
  | { type: "model-ready" }
  | { type: "segment-start"; label: string; index: number; total: number }
  | { type: "segment-done"; segment: SegmentItem }
  | { type: "segment-error"; prompt: string; error: string }
  | { type: "auto-done"; segments: SegmentItem[] }
  | { type: "auto-error"; error: string };
