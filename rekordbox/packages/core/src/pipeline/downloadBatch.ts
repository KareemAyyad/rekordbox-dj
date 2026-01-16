import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { downloadOne } from "./downloadOne.js";
import { parseYtDlpError } from "../ytdlp/client.js";
import { sleep } from "../util/async.js";

export type DownloadMode = "audio" | "video" | "both";
export type AudioFormatPreference = "auto" | "aiff" | "wav" | "flac" | "m4a" | "mp3";

export type LoudnessNormalization = {
  enabled: boolean;
  targetI: number; // LUFS
  targetTP: number; // dBTP
  targetLRA: number; // LU
};

export type DjTagDefaults = {
  genre: string;
  energy: string; // "1/5"..."5/5"
  time: string; // Warmup | Peak | Closing | etc (free text for now)
  vibe: string; // comma-separated
};

export type DownloadBatchInput = {
  urls: string[];
  mode: DownloadMode;
  rootDir?: string;
  inboxDir?: string;
  audioFormat?: AudioFormatPreference;
  normalize?: LoudnessNormalization;
  djDefaults?: DjTagDefaults;
  onEvent?: (event: DownloadEvent) => void;
  /** Maximum concurrent downloads (default: 1 for sequential) */
  maxConcurrent?: number;
  /** Maximum retry attempts for transient failures (default: 2) */
  maxRetries?: number;
};

export type DownloadStage =
  | "metadata"      // Fetching video info from yt-dlp
  | "classify"      // Auto-classifying genre/energy/time/vibe
  | "download"      // Downloading audio/video file
  | "fingerprint"   // Running AcoustID/MusicBrainz match
  | "normalize"     // Loudness normalization (2-pass, slow)
  | "transcode"     // Transcoding to target format
  | "tag"           // Applying tags and artwork
  | "finalize";     // Writing sidecar JSON

export type DownloadEvent =
  | { type: "batch-start"; inboxDir: string; count: number; mode: DownloadMode }
  | { type: "item-start"; url: string; index: number; count: number }
  | { type: "item-progress"; url: string; index: number; count: number; stage: DownloadStage }
  | { type: "item-done"; url: string; index: number; count: number }
  | { type: "item-error"; url: string; index: number; count: number; error: unknown };

export async function downloadBatch(input: DownloadBatchInput): Promise<void> {
  const rootDir = input.rootDir ?? path.join(os.homedir(), "DJ Library");
  const inboxDir = input.inboxDir ?? path.join(rootDir, "00_INBOX");
  const maxConcurrent = Math.max(1, input.maxConcurrent ?? 1);

  await fs.mkdir(inboxDir, { recursive: true });

  input.onEvent?.({ type: "batch-start", inboxDir, count: input.urls.length, mode: input.mode });

  // Sequential processing (default, maxConcurrent=1)
  if (maxConcurrent === 1) {
    for (const [i, url] of input.urls.entries()) {
      const index = i + 1;
      await processOneUrl(input, url, index, inboxDir);
    }
    return;
  }

  // Parallel processing with concurrency limit
  const semaphore = new Semaphore(maxConcurrent);
  const tasks = input.urls.map((url, i) => {
    const index = i + 1;
    return semaphore.run(() => processOneUrl(input, url, index, inboxDir));
  });
  await Promise.all(tasks);
}

async function processOneUrl(input: DownloadBatchInput, url: string, index: number, inboxDir: string): Promise<void> {
  const maxRetries = input.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt === 0) {
      input.onEvent?.({ type: "item-start", url, index, count: input.urls.length });
    }

    try {
      await downloadOne({
        url,
        mode: input.mode,
        inboxDir,
        audioFormat: input.audioFormat ?? "aiff",
        normalize:
          input.normalize ?? {
            enabled: true,
            targetI: -14,
            targetTP: -1.0,
            targetLRA: 11
          },
        djDefaults:
          input.djDefaults ?? {
            genre: "Other",
            energy: "",
            time: "",
            vibe: ""
          },
        onProgress: input.onEvent
          ? (stage) => input.onEvent!({ type: "item-progress", url, index, count: input.urls.length, stage })
          : undefined
      });
      input.onEvent?.({ type: "item-done", url, index, count: input.urls.length });
      return; // Success
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const parsed = parseYtDlpError(error);
      if (!parsed.retryable || attempt >= maxRetries) {
        // Not retryable or max retries reached
        break;
      }

      // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s...)
      const delayMs = Math.pow(2, attempt) * 1000;
      console.warn(`[dropcrate] Retrying ${url} in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries}): ${parsed.message}`);
      await sleep(delayMs);
    }
  }

  input.onEvent?.({ type: "item-error", url, index, count: input.urls.length, error: lastError });
  // Continue with remaining items instead of stopping the batch
}

/** Simple semaphore for concurrency control */
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
