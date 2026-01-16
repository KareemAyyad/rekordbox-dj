#!/usr/bin/env node
import { Command } from "commander";
import { z } from "zod";
import { downloadBatch, parseYtDlpError, type DownloadEvent, type DownloadStage } from "@dropcrate/core";

const STAGE_LABELS: Record<DownloadStage, string> = {
  metadata: "Fetching info",
  classify: "Classifying",
  download: "Downloading",
  fingerprint: "Fingerprinting",
  normalize: "Normalizing",
  transcode: "Transcoding",
  tag: "Tagging",
  finalize: "Finalizing"
};

const program = new Command();

program
  .name("dropcrate")
  .description("Local DJ downloader + extractor (Rekordbox watch-folder workflow)")
  .version("0.1.0");

const DownloadModeSchema = z.enum(["audio", "video", "both"]);
const AudioFormatSchema = z.enum(["auto", "aiff", "m4a", "mp3"]);

program
  .command("download")
  .argument("<urls...>", "YouTube URLs (1–10)")
  .option("--mode <mode>", "audio | video | both", "audio")
  .option("--audio-format <fmt>", "auto | aiff | m4a | mp3 (audio/both)", "aiff")
  .option("--no-normalize", "Disable loudness normalization (default: normalized)")
  .option("--lufs <num>", "Target LUFS (normalize)", "-14")
  .option("--true-peak <num>", "Target true peak dBTP (normalize)", "-1.0")
  .option("--lra <num>", "Target loudness range LRA (normalize)", "11")
  .option("--dj-safe", "Shortcut for: --mode audio --audio-format aiff --normalize", false)
  .option("--fast", "Shortcut for: --audio-format auto --no-normalize", false)
  .option("--root <path>", "DJ Library root (defaults to ~/DJ Library)")
  .option("--inbox <path>", "Override inbox folder (defaults to <root>/00_INBOX)")
  .option("--concurrent <n>", "Max parallel downloads (default: 1 for sequential)", "1")
  .action(async (urls: string[], options: any) => {
    const djSafe = Boolean(options.djSafe);
    const fast = Boolean(options.fast);
    const mode = DownloadModeSchema.parse(djSafe ? "audio" : options.mode);
    const audioFormat = AudioFormatSchema.parse(fast ? "auto" : djSafe ? "aiff" : options.audioFormat);
    const normalize = Boolean(fast ? false : djSafe ? true : options.normalize);
    const targetI = Number(options.lufs);
    const targetTP = Number(options.truePeak);
    const targetLRA = Number(options.lra);
    const maxConcurrent = Math.max(1, Math.min(5, Number(options.concurrent) || 1));

    if (urls.length < 1 || urls.length > 10) {
      throw new Error("Provide 1–10 URLs for MVP.");
    }

    await downloadBatch({
      urls,
      mode,
      rootDir: options.root,
      inboxDir: options.inbox,
      audioFormat,
      normalize: {
        enabled: normalize,
        targetI,
        targetTP,
        targetLRA
      },
      maxConcurrent,
      onEvent: (e: DownloadEvent) => {
        if (e.type === "batch-start") {
          console.log(`DropCrate: ${e.count} item(s), mode=${e.mode}`);
          console.log(`INBOX: ${e.inboxDir}`);
        }
        if (e.type === "item-start") console.log(`[${e.index}/${e.count}] Starting: ${e.url}`);
        if (e.type === "item-progress") console.log(`[${e.index}/${e.count}] ${STAGE_LABELS[e.stage]}...`);
        if (e.type === "item-done") console.log(`[${e.index}/${e.count}] ✓ Complete`);
        if (e.type === "item-error") {
          const parsed = parseYtDlpError(e.error);
          console.error(`[${e.index}/${e.count}] ✗ ${parsed.message}`);
          if (parsed.hint) console.error(`   Hint: ${parsed.hint}`);
        }
      }
    });
  });

program.parse();
