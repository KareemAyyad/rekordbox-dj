import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import https from "node:https";
import { createWriteStream } from "node:fs";
import { sanitizeFileComponent, makeRekordboxFilename } from "../util/naming.js";
import { withTimeout, safeRemove } from "../util/async.js";
import { normalizeFromYouTubeTitle } from "../metadata/normalize.js";
import { tryMatchMusicMetadata } from "../metadata/musicbrainz.js";
import { heuristicClassifyDjTags } from "../metadata/autoclassify.js";
import type { AudioFormatPreference, DownloadMode, DownloadStage, LoudnessNormalization } from "./downloadBatch.js";
import { createYtDlp, getYtDlpCookieArgs } from "../ytdlp/client.js";

type DownloadOneInput = {
  url: string;
  mode: DownloadMode;
  inboxDir: string;
  audioFormat: AudioFormatPreference;
  normalize: LoudnessNormalization;
  djDefaults: { genre: string; energy: string; time: string; vibe: string };
  onProgress?: (stage: DownloadStage) => void;
};

type YtdlpInfo = {
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  webpage_url?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string; width?: number; height?: number; preference?: number }>;
  description?: string;
  categories?: string[];
  tags?: string[];
};

export async function downloadOne(input: DownloadOneInput): Promise<void> {
  const { ytdlp } = await createYtDlp();

  input.onProgress?.("metadata");
  const infoRaw = await withTimeout(
    ytdlp.execPromise([input.url, "--dump-single-json", "--no-warnings", "--no-playlist", "--socket-timeout", "10", "--retries", "1", ...getYtDlpCookieArgs()]),
    45_000,
    "yt-dlp metadata timed out"
  );
  const info = JSON.parse(infoRaw) as YtdlpInfo;
  const sourceUrl = info.webpage_url ?? input.url;
  const sourceId = info.id ?? crypto.createHash("sha1").update(sourceUrl).digest("hex").slice(0, 10);

  // Auto-classify DJ tags from video metadata if not provided by caller
  input.onProgress?.("classify");
  const autoClassified = heuristicClassifyDjTags({
    title: info.title ?? null,
    uploader: info.uploader ?? info.channel ?? null,
    description: info.description ?? null,
    duration: info.duration ?? null,
    webpage_url: info.webpage_url ?? null,
    categories: info.categories ?? null,
    tags: info.tags ?? null
  });

  // Merge auto-classification with provided djDefaults (caller overrides take precedence)
  const effectiveDjDefaults = {
    genre: input.djDefaults.genre && input.djDefaults.genre !== "Other"
      ? input.djDefaults.genre
      : (autoClassified.genre ?? "Other"),
    energy: input.djDefaults.energy || (autoClassified.energy ?? ""),
    time: input.djDefaults.time || (autoClassified.time ?? ""),
    vibe: input.djDefaults.vibe || (autoClassified.vibe ?? "")
  };

  const cleanedTitle = (info.title ?? "Unknown Title").trim();
  const titleHadSeparator = /(\s-\s|\s–\s|\s—\s|\s\|\s)/.test(cleanedTitle);
  const normalized = normalizeFromYouTubeTitle({ rawTitle: cleanedTitle, uploader: info.uploader ?? null });

  const baseName = sanitizeFileComponent(`${normalized.artist} - ${normalized.title}`.trim());
  const workDir = path.join(input.inboxDir, `.dropcrate_tmp_${sourceId}`);

  await fs.mkdir(workDir, { recursive: true });

  try {
    const outputs: { audioPath?: string; videoPath?: string } = {};
    let effectiveMeta: { artist: string; title: string; version: string | null; album: string | null; year: string | null; label: string | null; match: unknown } | null = null;

    if (input.mode === "video" || input.mode === "both") {
      input.onProgress?.("download");
      const outTemplate = path.join(workDir, `${baseName}__video.%(ext)s`);
      await ytdlp.execPromise([
        sourceUrl,
        "-f",
        "bv*+ba/b",
        "--merge-output-format",
        "mp4",
        ...getYtDlpCookieArgs(),
        "-o",
        outTemplate
      ]);

      const downloadedVideo = await findByPrefix(workDir, `${baseName}__video`);
      const ext = path.extname(downloadedVideo).toLowerCase() || ".mp4";
      const finalVideoPath = path.join(input.inboxDir, `${baseName}${ext === ".mkv" ? ".mkv" : ".mp4"}`);
      await fs.rename(downloadedVideo, finalVideoPath);
      outputs.videoPath = finalVideoPath;
    }

    if (input.mode === "audio" || input.mode === "both") {
      // Download best available audio, then decide whether to keep codec or output AIFF.
      input.onProgress?.("download");
      const outTemplate = path.join(workDir, `${baseName}__audio.%(ext)s`);

      await ytdlp.execPromise([
        sourceUrl,
        "-f",
        "bestaudio/best",
        ...getYtDlpCookieArgs(),
        "-o",
        outTemplate
      ]);

      const downloaded = await findByPrefix(workDir, `${baseName}__audio`);
      const ext = path.extname(downloaded).toLowerCase();
      const thumbnailPath = await maybeDownloadThumbnail(workDir, pickBestThumbnailUrl(info));
      input.onProgress?.("fingerprint");
      const matched = await tryMatchMusicMetadata({
        audioPath: downloaded,
        fallback: normalized,
        titleHadSeparator
      });
      const effective = matched
        ? { artist: matched.artist, title: matched.title, version: matched.version, album: matched.album, year: matched.year, label: matched.label, match: matched.match }
        : { artist: normalized.artist, title: normalized.title, version: normalized.version, album: null, year: null, label: null, match: null };
      effectiveMeta = effective;

      const tags = buildTags({
        artist: effective.artist,
        title: effective.title,
        version: effective.version,
        album: effective.album,
        year: effective.year,
        label: effective.label,
        genre: effectiveDjDefaults.genre,
        dj: { energy: effectiveDjDefaults.energy, time: effectiveDjDefaults.time, vibe: effectiveDjDefaults.vibe },
        sourceUrl,
        sourceId
      });

      const finalPath = await finalizeAudio({
        downloadedPath: downloaded,
        downloadedExt: ext,
        inboxDir: input.inboxDir,
        baseName,
        audioFormat: input.audioFormat,
        normalize: input.normalize,
        thumbnailPath,
        tags,
        onProgress: input.onProgress
      });

      outputs.audioPath = finalPath;
    }

    if (outputs.audioPath || outputs.videoPath) {
      input.onProgress?.("finalize");
      const sidecar = {
        sourceUrl,
        sourceId,
        title: info.title ?? null,
        uploader: info.uploader ?? null,
        duration: info.duration ?? null,
        downloadedAt: new Date().toISOString(),
        normalized: effectiveMeta
          ? { artist: effectiveMeta.artist, title: effectiveMeta.title, version: effectiveMeta.version, album: effectiveMeta.album, year: effectiveMeta.year, label: effectiveMeta.label }
          : { artist: normalized.artist, title: normalized.title, version: normalized.version, album: null, year: null, label: null },
        fingerprintMatch: effectiveMeta?.match ?? null,
        djDefaults: effectiveDjDefaults,
        processing: {
          audioFormat: input.audioFormat,
          normalize: input.normalize
        },
        outputs
      };
      const sidecarBase = sanitizeFileComponent(
        `${(effectiveMeta?.artist ?? normalized.artist) as string} - ${(effectiveMeta?.title ?? normalized.title) as string}`.trim()
      );
      await fs.writeFile(path.join(input.inboxDir, `${sidecarBase}.dropcrate.json`), JSON.stringify(sidecar, null, 2));
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

function buildTags(input: {
  artist: string;
  title: string;
  version: string | null;
  album: string | null;
  year: string | null;
  label: string | null;
  genre: string;
  dj: { energy: string; time: string; vibe: string };
  sourceUrl: string;
  sourceId: string;
}): Record<string, string> {
  const commentLines: string[] = [];
  const energy = input.dj.energy.trim();
  const time = input.dj.time.trim();
  const vibe = input.dj.vibe.trim();
  if (energy) commentLines.push(`ENERGY: ${energy}`);
  if (time) commentLines.push(`TIME: ${time}`);
  if (vibe) commentLines.push(`VIBE: ${vibe}`);
  commentLines.push(`SOURCE: YouTube`, `URL: ${input.sourceUrl}`, `YOUTUBE_ID: ${input.sourceId}`);
  const tags: Record<string, string> = {
    artist: input.artist,
    title: input.title,
    genre: input.genre,
    comment: commentLines.join("\n")
  };
  if (input.album?.trim()) tags.album = input.album.trim();
  if (input.year?.trim()) tags.date = input.year.trim();
  if (input.label?.trim()) tags.publisher = input.label.trim(); // Record label → "publisher" ID3 tag (shows in Rekordbox)
  return tags;
}

async function maybeDownloadThumbnail(workDir: string, url?: string): Promise<string | null> {
  if (!url) return null;
  const dest = path.join(workDir, "cover.jpg");
  try {
    await downloadToFile(url, dest);
    return dest;
  } catch (err) {
    console.warn(`[dropcrate] Thumbnail download failed for ${url}: ${String((err as Error)?.message ?? err)}`);
    return null;
  }
}

function pickBestThumbnailUrl(info: YtdlpInfo): string | undefined {
  const fromList = (info.thumbnails ?? [])
    .map((t) => ({ url: t.url, score: (t.width ?? 0) * (t.height ?? 0) + (t.preference ?? 0) }))
    .filter((t): t is { url: string; score: number } => Boolean(t.url))
    .sort((a, b) => b.score - a.score)[0]?.url;
  return fromList ?? info.thumbnail;
}

async function finalizeAudio(input: {
  downloadedPath: string;
  downloadedExt: string;
  inboxDir: string;
  baseName: string;
  audioFormat: AudioFormatPreference;
  normalize: LoudnessNormalization;
  thumbnailPath: string | null;
  tags: Record<string, string>;
  onProgress?: (stage: DownloadStage) => void;
}): Promise<string> {
  // Normalization implies decoding; for lossless output use the specified format
  const effectiveAudioFormat: AudioFormatPreference = input.normalize.enabled
    ? (["aiff", "wav", "flac"].includes(input.audioFormat) ? input.audioFormat : "aiff")
    : input.audioFormat;

  const isM4a = input.downloadedExt === ".m4a";
  const isMp3 = input.downloadedExt === ".mp3";

  const finalExt =
    effectiveAudioFormat === "m4a"
      ? ".m4a"
      : effectiveAudioFormat === "mp3"
        ? ".mp3"
        : effectiveAudioFormat === "aiff"
          ? ".aiff"
          : effectiveAudioFormat === "wav"
            ? ".wav"
            : effectiveAudioFormat === "flac"
              ? ".flac"
              : isM4a
                ? ".m4a"
                : isMp3
                  ? ".mp3"
                  : ".aiff";

  const finalPath = path.join(input.inboxDir, makeRekordboxFilename({ artist: input.tags.artist ?? "Unknown Artist", title: input.tags.title ?? "Unknown Title", bpm: null, key: null, ext: finalExt }));

  if (!input.normalize.enabled && finalExt === ".m4a" && isM4a) {
    await fs.rename(input.downloadedPath, finalPath);
    input.onProgress?.("tag");
    await applyTagsAndArtwork({ mediaPath: finalPath, ext: ".m4a", tags: input.tags, artworkPath: input.thumbnailPath });
    return finalPath;
  }

  if (!input.normalize.enabled && finalExt === ".mp3" && isMp3) {
    await fs.rename(input.downloadedPath, finalPath);
    input.onProgress?.("tag");
    await applyTagsAndArtwork({ mediaPath: finalPath, ext: ".mp3", tags: input.tags, artworkPath: input.thumbnailPath });
    return finalPath;
  }

  // For everything else (opus/webm/etc) decode to lossless format (optionally loudness-normalized).
  if (![".aiff", ".wav", ".flac"].includes(finalExt)) {
    throw new Error(`Requested output ${finalExt} requires lossy re-encode; use --audio-format aiff, wav, or flac.`);
  }

  const tmp = path.join(input.inboxDir, `${input.baseName}.tmp${finalExt}`);
  await safeRemove(tmp);
  if (input.normalize.enabled) {
    input.onProgress?.("normalize");
    await normalizeToFormat({
      inputPath: input.downloadedPath,
      outputPath: tmp,
      format: finalExt as ".aiff" | ".wav" | ".flac",
      targetI: input.normalize.targetI,
      targetTP: input.normalize.targetTP,
      targetLRA: input.normalize.targetLRA
    });
  } else {
    input.onProgress?.("transcode");
    await transcodeToFormat(input.downloadedPath, tmp, finalExt as ".aiff" | ".wav" | ".flac");
  }
  await fs.rename(tmp, finalPath);
  input.onProgress?.("tag");
  await applyTagsAndArtwork({ mediaPath: finalPath, ext: finalExt as ".m4a" | ".mp3" | ".aiff" | ".wav" | ".flac", tags: input.tags, artworkPath: input.thumbnailPath });
  return finalPath;
}

async function applyTagsAndArtwork(input: {
  mediaPath: string;
  ext: ".m4a" | ".mp3" | ".aiff" | ".wav" | ".flac";
  tags: Record<string, string>;
  artworkPath: string | null;
}): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();
  const tmp = `${input.mediaPath}.tagged.tmp${input.ext}`;
  await safeRemove(tmp);

  // Write metadata to both container (global) and audio stream to maximize compatibility.
  // Also ensure attached artwork stream doesn't accidentally inherit "comment"/"genre".
  const metaArgsGlobal = Object.entries(input.tags).flatMap(([k, v]) => ["-metadata", `${k}=${v}`]);
  const metaArgsAudio = Object.entries(input.tags).flatMap(([k, v]) => ["-metadata:s:a:0", `${k}=${v}`]);

  // No artwork: just remux/retag.
  if (!input.artworkPath) {
    let args: string[];
    if (input.ext === ".m4a") {
      args = ["-y", "-i", input.mediaPath, ...metaArgsGlobal, ...metaArgsAudio, "-c", "copy", tmp];
    } else if (input.ext === ".mp3") {
      args = ["-y", "-i", input.mediaPath, ...metaArgsGlobal, ...metaArgsAudio, "-c", "copy", "-id3v2_version", "3", tmp];
    } else if (input.ext === ".flac") {
      // FLAC uses Vorbis comments natively
      args = ["-y", "-i", input.mediaPath, ...metaArgsGlobal, ...metaArgsAudio, "-c", "copy", tmp];
    } else {
      // AIFF and WAV use ID3v2
      args = ["-y", "-i", input.mediaPath, ...metaArgsGlobal, ...metaArgsAudio, "-c", "copy", "-write_id3v2", "1", tmp];
    }
    await runFfmpeg(ffmpegPath, args);
    await fs.rename(tmp, input.mediaPath);
    return;
  }

  // Artwork + metadata.
  if (input.ext === ".m4a") {
    const args = [
      "-y",
      "-i",
      input.mediaPath,
      "-i",
      input.artworkPath,
      ...metaArgsGlobal,
      ...metaArgsAudio,
      "-map",
      "0:a:0",
      "-map",
      "1:v:0",
      "-c:a",
      "copy",
      "-c:v",
      "mjpeg",
      "-disposition:v:0",
      "attached_pic",
      "-metadata:s:v:0",
      "title=Album cover",
      "-metadata:s:v:0",
      "comment=Cover (front)",
      tmp
    ];
    await runFfmpeg(ffmpegPath, args);
    await fs.rename(tmp, input.mediaPath);
    return;
  }

  if (input.ext === ".mp3") {
    const args = [
      "-y",
      "-i",
      input.mediaPath,
      "-i",
      input.artworkPath,
      ...metaArgsGlobal,
      ...metaArgsAudio,
      "-map",
      "0:a:0",
      "-map",
      "1:v:0",
      "-c:a",
      "copy",
      "-c:v",
      "mjpeg",
      "-id3v2_version",
      "3",
      "-metadata:s:v",
      "title=Album cover",
      "-metadata:s:v",
      "comment=Cover (front)",
      tmp
    ];
    await runFfmpeg(ffmpegPath, args);
    await fs.rename(tmp, input.mediaPath);
    return;
  }

  // FLAC: uses Vorbis comments and embedded picture blocks
  if (input.ext === ".flac") {
    const args = [
      "-y",
      "-i",
      input.mediaPath,
      "-i",
      input.artworkPath,
      ...metaArgsGlobal,
      ...metaArgsAudio,
      "-map",
      "0:a:0",
      "-map",
      "1:v:0",
      "-c:a",
      "copy",
      "-c:v",
      "mjpeg",
      "-disposition:v:0",
      "attached_pic",
      "-metadata:s:v:0",
      "title=Album cover",
      "-metadata:s:v:0",
      "comment=Cover (front)",
      tmp
    ];
    await runFfmpeg(ffmpegPath, args);
    await fs.rename(tmp, input.mediaPath);
    return;
  }

  // AIFF/WAV: best-effort ID3 tagging + artwork (may be ignored by some readers).
  const args = [
    "-y",
    "-i",
    input.mediaPath,
    "-i",
    input.artworkPath,
    ...metaArgsGlobal,
    ...metaArgsAudio,
    "-map",
    "0:a:0",
    "-map",
    "1:v:0",
    "-c:a",
    "copy",
    "-c:v",
    "mjpeg",
    "-disposition:v:0",
    "attached_pic",
    "-metadata:s:v:0",
    "title=Album cover",
    "-metadata:s:v:0",
    "comment=Cover (front)",
    "-write_id3v2",
    "1",
    tmp
  ];
  await runFfmpeg(ffmpegPath, args);
  await fs.rename(tmp, input.mediaPath);
}

function resolveFfmpegPath(): string {
  const ffmpegPath: string | null =
    typeof ffmpegStatic === "string" || ffmpegStatic === null
      ? ffmpegStatic
      : ((ffmpegStatic as unknown as { default?: string | null }).default ?? null);
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an ffmpeg binary for this platform.");
  return ffmpegPath;
}

async function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr?.on("data", (buf: Buffer) => {
      stderr += buf.toString("utf8");
    });
    ff.on("error", reject);
    ff.on("close", (code: number | null) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (${code ?? "null"}): ${stderr.slice(-8000)}`));
    });
  });
}

type LoudnormAnalysis = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};

function getCodecForFormat(format: ".aiff" | ".wav" | ".flac"): string {
  switch (format) {
    case ".aiff": return "pcm_s16be";
    case ".wav": return "pcm_s16le";
    case ".flac": return "flac";
  }
}

async function normalizeToFormat(input: { inputPath: string; outputPath: string; format: ".aiff" | ".wav" | ".flac"; targetI: number; targetTP: number; targetLRA: number }): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();
  const analysis = await ffmpegLoudnormAnalyze(ffmpegPath, input.inputPath, input.targetI, input.targetTP, input.targetLRA);
  const filter = `loudnorm=I=${input.targetI}:TP=${input.targetTP}:LRA=${input.targetLRA}:measured_I=${analysis.input_i}:measured_TP=${analysis.input_tp}:measured_LRA=${analysis.input_lra}:measured_thresh=${analysis.input_thresh}:offset=${analysis.target_offset}:linear=true:print_format=summary`;
  const codec = getCodecForFormat(input.format);
  await runFfmpeg(ffmpegPath, ["-y", "-i", input.inputPath, "-vn", "-af", filter, "-acodec", codec, "-ar", "44100", input.outputPath]);
}

async function ffmpegLoudnormAnalyze(
  ffmpegPath: string,
  inputPath: string,
  targetI: number,
  targetTP: number,
  targetLRA: number
): Promise<LoudnormAnalysis> {
  const stderr = await runFfmpegCaptureStderr(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-af",
    `loudnorm=I=${targetI}:TP=${targetTP}:LRA=${targetLRA}:print_format=json`,
    "-f",
    "null",
    "-"
  ]);
  const json = extractLastJsonObject(stderr);
  return JSON.parse(json) as LoudnormAnalysis;
}

async function runFfmpegCaptureStderr(ffmpegPath: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const ff = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr?.on("data", (buf: Buffer) => {
      stderr += buf.toString("utf8");
    });
    ff.on("error", reject);
    ff.on("close", (code: number | null) => {
      if (code === 0) return resolve(stderr);
      reject(new Error(`ffmpeg failed (${code ?? "null"}): ${stderr.slice(-8000)}`));
    });
  });
}

function extractLastJsonObject(text: string): string {
  const start = text.lastIndexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Could not parse ffmpeg loudnorm JSON output.");
  return text.slice(start, end + 1);
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const tmp = `${destPath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await safeRemove(tmp);

  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      url,
      {
        headers: {
          "User-Agent": "dropcrate/0.1.0",
          Accept: "application/octet-stream"
        }
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          downloadToFile(location, destPath).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new Error(`Download failed (${status}) for ${url}`));
          res.resume();
          return;
        }
        const out = createWriteStream(tmp);
        res.pipe(out);
        out.on("finish", () => resolve());
        out.on("error", reject);
      }
    );
    request.on("error", reject);
    request.end();
  });

  try {
    await fs.rename(tmp, destPath);
  } catch (err) {
    // Redirect path: nested downloader already wrote/renamed (or this call never wrote a temp file).
    if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return;
    throw err;
  }
}

async function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const request = https.request(
      url,
      { headers },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          httpsGet(location, headers).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status} for ${url}`));
          res.resume();
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    request.on("error", reject);
    request.end();
  });
}

async function findByPrefix(workDir: string, prefix: string): Promise<string> {
  const entries = await fs.readdir(workDir);
  const candidates = entries
    .filter((f) => f.startsWith(prefix + "."))
    .map((f) => path.join(workDir, f))
    .filter((f) => !f.endsWith(".part"));
  if (candidates.length === 0) {
    throw new Error("yt-dlp produced no output file.");
  }
  if (candidates.length > 1) {
    // Prefer audio-ish files if multiple exist.
    const preferred = candidates.find((f) => [".m4a", ".mp3", ".aiff", ".aif", ".webm", ".opus"].includes(path.extname(f)));
    if (preferred) return preferred;
    return candidates[0]!;
  }
  return candidates[0]!;
}

async function transcodeToFormat(inputPath: string, outputPath: string, format: ".aiff" | ".wav" | ".flac"): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const codec = getCodecForFormat(format);
  await runFfmpeg(ffmpegPath, ["-y", "-i", inputPath, "-vn", "-acodec", codec, "-ar", "44100", outputPath]);
}
