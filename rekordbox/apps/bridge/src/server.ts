import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { z } from "zod";
import OpenAI from "openai";
import { downloadBatch, getVideoInfo, heuristicClassifyDjTags } from "@dropcrate/core";

type SseClient = { id: string; write: (chunk: string) => void; close: () => void };
type Job = { id: string; cancelRequested: boolean; clients: Map<string, SseClient>; history: any[] };

const jobs = new Map<string, Job>();

process.on("unhandledRejection", (reason) => {
  console.error("[bridge] unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[bridge] uncaughtException", err);
});

const LoudnessSchema = z.object({
  targetI: z.number().min(-23, "Target LUFS must be at least -23").max(-8, "Target LUFS must be at most -8"),
  targetTP: z.number().min(-5, "True peak must be at least -5 dBTP").max(0, "True peak must be at most 0 dBTP"),
  targetLRA: z.number().min(5, "LRA must be at least 5 LU").max(20, "LRA must be at most 20 LU")
});

const SettingsSchema = z.object({
  inboxDir: z.string().optional(),
  mode: z.enum(["dj-safe", "fast"]).optional(),
  loudness: LoudnessSchema.optional()
});

const QueueStartSchema = z.object({
  inboxDir: z.string().min(1),
  mode: z.enum(["dj-safe", "fast"]).default("dj-safe"),
  loudness: LoudnessSchema.extend({
    targetI: LoudnessSchema.shape.targetI.default(-14),
    targetTP: LoudnessSchema.shape.targetTP.default(-1.0),
    targetLRA: LoudnessSchema.shape.targetLRA.default(11)
  }).optional(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      url: z.string().min(1),
      presetSnapshot: z.object({
        genre: z.string().default("Other"),
        energy: z.string().default(""),
        time: z.string().default(""),
        vibe: z.string().default("")
      })
    })
  )
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Resolve the path to the desktop dist folder
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, "../../desktop/dist");

// Serve frontend static files
app.use(express.static(frontendPath));

const PORT = Number(process.env.PORT ?? process.env.DROPCRATE_BRIDGE_PORT ?? 8787);
const settingsPath = path.join(process.cwd(), ".dropcrate-bridge-settings.json");
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const openaiModel = process.env.DROPCRATE_OPENAI_MODEL ?? "gpt-4o-mini";

function truncateText(value: unknown, max: number): string | null {
  const s = typeof value === "string" ? value : null;
  if (!s) return null;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function send(job: Job, event: any) {
  job.history.push(event);
  if (job.history.length > 250) job.history.splice(0, job.history.length - 250);
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const deadClients: string[] = [];
  for (const client of job.clients.values()) {
    try {
      client.write(payload);
    } catch (err) {
      console.warn(`[bridge] SSE write failed for client ${client.id}: ${String((err as Error)?.message ?? err)}`);
      deadClients.push(client.id);
    }
  }
  // Clean up dead clients
  for (const id of deadClients) {
    job.clients.delete(id);
  }
}

async function loadSettings(): Promise<{ inboxDir: string; mode: "dj-safe" | "fast"; loudness: { targetI: number; targetTP: number; targetLRA: number } }> {
  const envInboxDir = process.env.DROPCRATE_INBOX_DIR?.trim() || path.join(process.cwd(), "DJ Library/00_INBOX");
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const json = JSON.parse(raw);
    const parsed = SettingsSchema.parse(json);
    return {
      inboxDir: (parsed.inboxDir?.trim() || envInboxDir).trim(),
      mode: parsed.mode ?? "dj-safe",
      loudness: parsed.loudness ?? { targetI: -14, targetTP: -1.0, targetLRA: 11 }
    };
  } catch {
    return { 
      inboxDir: envInboxDir, 
      mode: "dj-safe", 
      loudness: { targetI: -14, targetTP: -1.0, targetLRA: 11 } 
    };
  }
}

async function saveSettings(next: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await loadSettings();
    const parsed = SettingsSchema.parse(next);
    const merged = {
      ...current,
      ...parsed,
      loudness: parsed.loudness ?? current.loudness
    };
    await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/settings", async (_req, res) => {
  res.json(await loadSettings());
});

app.post("/settings", async (req, res) => {
  const result = await saveSettings(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ ok: true });
});

app.get("/events", (req, res) => {
  const jobId = String(req.query.jobId ?? "");
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("\n");

  const clientId = crypto.randomUUID();
  const client: SseClient = {
    id: clientId,
    write: (chunk) => res.write(chunk),
    close: () => res.end()
  };
  job.clients.set(clientId, client);

  // Replay history so late subscribers (common in browser flow) don't miss early events.
  for (const evt of job.history) {
    try {
      client.write(`data: ${JSON.stringify(evt)}\n\n`);
    } catch (err) {
      console.warn(`[bridge] SSE history replay failed for client ${clientId}: ${String((err as Error)?.message ?? err)}`);
      break; // Stop replaying if client is disconnected
    }
  }

  req.on("close", () => {
    job.clients.delete(clientId);
  });
});

app.post("/queue/cancel", (req, res) => {
  const jobId = String(req.body?.jobId ?? "");
  const job = jobs.get(jobId);
  if (job) job.cancelRequested = true;
  res.json({ ok: true });
});

app.post("/queue/start", async (req, res) => {
  let payload;
  try {
    payload = QueueStartSchema.parse(req.body);
  } catch (err: any) {
    console.error("[bridge] /queue/start: Validation failed", err.message);
    return res.status(400).json({ error: "Invalid request", details: err?.message ?? String(err) });
  }
  const settings = await loadSettings();
  const jobId = crypto.randomUUID();
  const job: Job = { id: jobId, cancelRequested: false, clients: new Map(), history: [] };
  jobs.set(jobId, job);

  const loudness = payload.loudness ?? settings.loudness;
  const count = payload.items.length;

  console.log(`[bridge] /queue/start: jobId=${jobId} items=${count} inboxDir=${payload.inboxDir}`);
  res.json({ jobId });

  send(job, { type: "queue-start", jobId, count, inboxDir: payload.inboxDir, mode: payload.mode });

  const isFast = payload.mode === "fast";

  try {
    // Process the entire batch in parallel (concurrency managed by downloadBatch)
    await downloadBatch({
      urls: payload.items.map(i => i.url),
      mode: "audio",
      inboxDir: payload.inboxDir,
      audioFormat: isFast ? "auto" : "aiff",
      maxConcurrent: 3, // Download 3 tracks at once
      normalize: {
        enabled: !isFast,
        targetI: loudness.targetI,
        targetTP: loudness.targetTP,
        targetLRA: loudness.targetLRA
      },
      // Map item IDs to their specific preset snapshots from the payload using the event index
      onEvent: (e: any) => {
        const item = e.index ? payload.items[e.index - 1] : null;
        if (!item) return;

        if (e.type === "item-start") {
          send(job, { type: "item-start", jobId, itemId: item.id, url: item.url });
        } else if (e.type === "item-done") {
          send(job, { type: "item-done", jobId, itemId: item.id, url: item.url });
        } else if (e.type === "item-error") {
          send(job, { type: "item-error", jobId, itemId: item.id, url: item.url, error: String(e.error ?? "Unknown error") });
        } else if (e.type === "item-progress") {
          send(job, { type: "core", jobId, itemId: item.id, url: item.url, event: e });
        }
      },
      // Note: downloadBatch uses the same djDefaults for the whole batch if passed here,
      // but the core downloadOne already handles individual item defaults if we skip it here.
      // However, to be safe, we'll let downloadOne handle the defaults based on what it finds.
    });

    console.log(`[bridge] /queue/start: jobId=${jobId} all items processed`);
    send(job, { type: "queue-done", jobId });
  } catch (error: any) {
    console.error(`[bridge] /queue/start: jobId=${jobId} batch error:`, error.message);
    send(job, { type: "queue-done", jobId }); // Signal done anyway to close the UI state
  } finally {
    // Keep job around briefly so Library can refresh; clients will disconnect naturally.
    setTimeout(() => jobs.delete(jobId), 5 * 60_000);
  }
});

const ClassifySchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), url: z.string().min(1) }))
});

const ClassifyResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(["track", "set", "podcast", "video", "unknown"]),
      genre: z.string().nullable(),
      energy: z.string().nullable(),
      time: z.string().nullable(),
      vibe: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      notes: z.string()
    })
  )
});

app.post("/classify", async (req, res) => {
  const startedAt = Date.now();
  let payload;
  try {
    payload = ClassifySchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({ error: "Invalid request", details: err?.message ?? String(err) });
  }
  const requestId = crypto.randomUUID();
  console.log(`[classify:${requestId}] start items=${payload.items.length}`);

  const infos = await Promise.all(
    payload.items.map(async (it) => {
      try {
        const info = await getVideoInfo(it.url, { timeoutMs: 60_000 });
        return { id: it.id, url: it.url, info };
      } catch (e: any) {
        const msg = String(e?.stderr ?? e?.message ?? e);
        return { id: it.id, url: it.url, info: null, error: msg };
      }
    })
  );

  // LLM path if key is present; fallback to heuristics otherwise.
  if (openai) {
    try {
      const missingInfoResults = new Map(
        infos
          .filter((x) => !x.info)
          .map((x) => [
            x.id,
            {
              id: x.id,
              kind: "unknown" as const,
              genre: null,
              energy: null,
              time: null,
              vibe: null,
              confidence: 0,
              notes: x.error?.trim() ? x.error : "Failed to fetch video info."
            }
          ] as const)
      );

      const input = infos.map((x) => ({
        id: x.id,
        url: x.url,
        title: truncateText(x.info?.title ?? null, 220),
        uploader: truncateText(x.info?.uploader ?? x.info?.channel ?? null, 120),
        description: truncateText(x.info?.description ?? null, 800),
        duration: x.info?.duration ?? null,
        tags: Array.isArray(x.info?.tags) ? (x.info.tags as any[]).slice(0, 25) : null,
        categories: Array.isArray(x.info?.categories) ? (x.info.categories as any[]).slice(0, 8) : null,
        fetchError: x.info ? null : truncateText((x as any).error ?? null, 400)
      }));

      const response = await openai.chat.completions.create(
        {
          model: openaiModel as any,
          messages: [
            {
              role: "system",
              content: "You are an expert touring DJ assistant. You classify YouTube items into Rekordbox-friendly DJ tags.\n\nRules:\n- If you are not confident, set fields to null (do not guess).\n- If it is not a music item (tutorial, vlog, interview, talking-head, podcast), set kind accordingly and set genre/energy/time/vibe to null.\n- Tutorials about DJing are NOT sets (kind=video), even if they contain a short demo mix.\n- Allowed genres: Afro House, House, Melodic House & Techno, Tech House, Deep House, Progressive House, Other.\n- If the content is primarily Techno / Melodic Techno, map genre to \"Melodic House & Techno\".\n- If fetchError is present, set kind=unknown, set genre/energy/time/vibe to null, confidence=0, and include fetchError in notes.\n- Energy must be one of: 1/5, 2/5, 3/5, 4/5, 5/5.\n- Time must be one of: Warmup, Peak, Closing.\n- Vibe is a comma-separated string using only relevant terms when supported (Organic, Tribal, Latin, Minimal, Dark, Vocal, Instrumental, Driving, Hypnotic)."
            },
            {
              role: "user",
              content: `Classify the following items:\n${JSON.stringify(input)}`
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_dj_tags",
                strict: true,
                description: "Return DJ tag classification for each item id.",
                parameters: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    results: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          id: { type: "string" },
                          kind: { type: "string", enum: ["track", "set", "podcast", "video", "unknown"] },
                          genre: { type: ["string", "null"], enum: ["Afro House", "House", "Melodic House & Techno", "Tech House", "Deep House", "Progressive House", "Other", null] },
                          energy: { type: ["string", "null"], enum: ["1/5", "2/5", "3/5", "4/5", "5/5", null] },
                          time: { type: ["string", "null"], enum: ["Warmup", "Peak", "Closing", null] },
                          vibe: { type: ["string", "null"] },
                          confidence: { type: "number" },
                          notes: { type: "string" }
                        },
                        required: ["id", "kind", "genre", "energy", "time", "vibe", "confidence", "notes"]
                      }
                    }
                  },
                  required: ["results"]
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "classify_dj_tags" } },
          temperature: 0.2,
          max_tokens: 4000
        },
        { timeout: 90_000 }
      );

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      const argsText = toolCall ? toolCall.function.arguments : null;
      const parsedArgs = argsText ? JSON.parse(argsText) : null;
      const parsed = ClassifyResultSchema.safeParse(parsedArgs);
      if (parsed.success) {
        const ms = Date.now() - startedAt;
        const byId = new Map(parsed.data.results.map((r) => [r.id, r] as const));
        const orderedResults = infos.map((x) => {
          const missing = missingInfoResults.get(x.id);
          if (missing) return missing;
          const r = byId.get(x.id);
          if (r) return r;
          return { id: x.id, kind: "unknown", genre: null, energy: null, time: null, vibe: null, confidence: 0, notes: "No classification returned." };
        });
        console.log(`[classify:${requestId}] ok source=openai ms=${ms} results=${JSON.stringify(orderedResults)}`);
        res.json({ ok: true, source: "openai", results: orderedResults, ms });
        return;
      } else {
        console.warn(`[classify:${requestId}] openai parse failed`, parsed.error);
      }
    } catch (err) {
      console.warn(`[classify:${requestId}] openai failed`, String((err as any)?.message ?? err));
      // fall back to heuristic below
    }
  }

  const results = infos.map((x) => {
    if (!x.info) {
      return { id: x.id, kind: "unknown", genre: null, energy: null, time: null, vibe: null, confidence: 0, notes: x.error ?? "Failed to fetch video info." };
    }
    const s = heuristicClassifyDjTags({
      title: x.info.title ?? null,
      uploader: x.info.uploader ?? x.info.channel ?? null,
      description: x.info.description ?? null,
      duration: x.info.duration ?? null,
      webpage_url: x.info.webpage_url ?? null,
      categories: x.info.categories ?? null,
      tags: x.info.tags ?? null
    });
    return { id: x.id, ...s };
  });
  const ms = Date.now() - startedAt;
  console.log(`[classify:${requestId}] ok source=heuristic ms=${ms}`);
  res.json({ ok: true, source: "heuristic", results, ms });
});

app.get("/library", async (req, res) => {
  const inboxDir = String(req.query.inboxDir ?? "").trim();
  if (!inboxDir) {
    console.log("[bridge] /library: Missing inboxDir");
    return res.json([]);
  }

  let entries: string[] = [];
  try {
    entries = await fs.readdir(inboxDir);
    console.log(`[bridge] /library: Scanning ${inboxDir}, found ${entries.length} entries`);
  } catch (err: any) {
    console.warn(`[bridge] /library: Failed to read ${inboxDir}: ${err.message}`);
    return res.json([]);
  }

  const sidecars = entries.filter((f) => f.endsWith(".dropcrate.json"));
  console.log(`[bridge] /library: Found ${sidecars.length} sidecar files`);
  const results: any[] = [];
  for (const f of sidecars) {
    const p = path.join(inboxDir, f);
    try {
      const raw = await fs.readFile(p, "utf8");
      const json = JSON.parse(raw);
      const normalized = json.normalized ?? {};
      const outputs = json.outputs ?? {};
      const audioPath = outputs.audioPath ?? "";
      if (!audioPath) {
        console.log(`[bridge] /library: Sidecar ${f} missing audioPath`);
        continue;
      }

      // When running on the web, provide a download URL
      const audioFilename = path.basename(audioPath);
      const downloadUrl = `/library/download?inboxDir=${encodeURIComponent(inboxDir)}&filename=${encodeURIComponent(audioFilename)}`;

      results.push({
        id: f,
        path: audioPath,
        downloadUrl, // For web browser downloads
        artist: String(normalized.artist ?? ""),
        title: String(normalized.title ?? ""),
        genre: String(json.djDefaults?.genre ?? ""),
        downloadedAt: String(json.downloadedAt ?? "")
      });
    } catch (err: any) {
      console.warn(`[bridge] /library: Failed to read sidecar ${f}: ${err.message}`);
    }
  }
  results.sort((a, b) => String(b.downloadedAt).localeCompare(String(a.downloadedAt)));
  res.json(results);
});

app.get("/library/download", async (req, res) => {
  const inboxDir = String(req.query.inboxDir ?? "").trim();
  const filename = String(req.query.filename ?? "").trim();

  if (!inboxDir || !filename) {
    return res.status(400).json({ error: "Missing inboxDir or filename" });
  }

  const filePath = path.join(inboxDir, filename);

  try {
    // Security check: ensure the file is actually inside the inboxDir
    const absoluteInboxDir = path.resolve(inboxDir);
    const absoluteFilePath = path.resolve(filePath);
    if (!absoluteFilePath.startsWith(absoluteInboxDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    await fs.access(absoluteFilePath);
    res.download(absoluteFilePath);
  } catch (err) {
    console.error("[library/download]", err);
    res.status(404).json({ error: "File not found" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   Shell operations (open file, reveal in Finder)
   ───────────────────────────────────────────────────────────────────────────── */
import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);

app.post("/shell/open", async (req, res) => {
  const filePath = String(req.body?.path ?? "").trim();
  if (!filePath) return res.status(400).json({ ok: false, error: "Missing path" });

  try {
    // Check if file exists
    await fs.access(filePath);

    // Open with default application (macOS: open, Linux: xdg-open, Windows: start)
    const platform = process.platform;
    const cmd = platform === "darwin"
      ? `open "${filePath.replace(/"/g, '\\"')}"`
      : platform === "win32"
        ? `start "" "${filePath.replace(/"/g, '\\"')}"`
        : `xdg-open "${filePath.replace(/"/g, '\\"')}"`;

    await execAsync(cmd);
    res.json({ ok: true });
  } catch (err) {
    console.error("[shell/open]", err);
    res.status(500).json({ ok: false, error: String((err as any)?.message ?? err) });
  }
});

app.post("/shell/reveal", async (req, res) => {
  const filePath = String(req.body?.path ?? "").trim();
  if (!filePath) return res.status(400).json({ ok: false, error: "Missing path" });

  try {
    // Check if file exists
    await fs.access(filePath);

    // Reveal in file manager (macOS: open -R, Linux: xdg-open folder, Windows: explorer /select)
    const platform = process.platform;
    const cmd = platform === "darwin"
      ? `open -R "${filePath.replace(/"/g, '\\"')}"`
      : platform === "win32"
        ? `explorer /select,"${filePath.replace(/"/g, '\\"')}"`
        : `xdg-open "${path.dirname(filePath).replace(/"/g, '\\"')}"`;

    await execAsync(cmd);
    res.json({ ok: true });
  } catch (err) {
    console.error("[shell/reveal]", err);
    res.status(500).json({ ok: false, error: String((err as any)?.message ?? err) });
  }
});

// Fallback to index.html for SPA routing
app.get("*", (req, res, next) => {
  // Don't intercept API or Event routes
  if (req.path.startsWith("/api") || req.path.startsWith("/events") || req.path.startsWith("/settings") || req.path.startsWith("/library") || req.path.startsWith("/shell")) {
    return next();
  }
  res.sendFile(path.join(frontendPath, "index.html"));
});

export { app };

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Hoover bridge listening on http://localhost:${PORT}`);
    const settings = await loadSettings();
    console.log(`[bridge] Current settings: inboxDir=${settings.inboxDir} mode=${settings.mode}`);
    try {
      await fs.mkdir(settings.inboxDir, { recursive: true });
      await fs.access(settings.inboxDir, fs.constants.W_OK);
      console.log(`[bridge] inboxDir "${settings.inboxDir}" is writable`);
    } catch (err: any) {
      console.error(`[bridge] CRITICAL: inboxDir "${settings.inboxDir}" is NOT writable:`, err.message);
    }
  });
}
