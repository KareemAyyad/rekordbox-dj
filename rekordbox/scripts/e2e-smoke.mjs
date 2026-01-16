#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";

const exec = promisify(execFile);

const args = new Set(process.argv.slice(2));
const shouldDownload = args.has("--download");

const PORT = Number(process.env.DROPCRATE_E2E_PORT ?? 8791);
const base = `http://localhost:${PORT}`;
const ytdlp = "./.dropcrate/bin/yt-dlp";

const queries = [
  { q: "afro house dj set" },
  { q: "afro house mix 2024" },
  { q: "organic house mix" },
  { q: "tribal house mix" },
  { q: "melodic house and techno live set" },
  { q: "melodic techno set" },
  { q: "progressive house mix" },
  { q: "deep house mix" },
  { q: "tech house session" },
  { q: "house music mix" },
  { q: "Amapiano mix" },
  { q: "latin house mix" },
  { q: "DJ interview" },
  { q: "DJ tutorial" },
  { q: "Rekordbox tutorial" },
  { q: "how to beatmatch" },
  { q: "motivational podcast" },
  { q: "cooking recipe" },
  { q: "live DJ set techno" },
  { q: "afro house track" }
];

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function ytsearch1(q) {
  const { stdout } = await exec(
    ytdlp,
    [
      `ytsearch1:${q}`,
      "--get-id",
      "--no-warnings",
      "--no-playlist",
      "--socket-timeout",
      "10",
      "--retries",
      "1",
      "--extractor-retries",
      "1"
    ],
    { timeout: 45_000 }
  );
  const id = String(stdout).trim().split(/\s+/)[0];
  if (!id) throw new Error(`No id for query: ${q}`);
  return `https://www.youtube.com/watch?v=${id}`;
}

function startBridge() {
  const child = spawn("node", ["--import", "tsx", "apps/bridge/src/server.ts"], {
    env: { ...process.env, DROPCRATE_BRIDGE_PORT: String(PORT) },
    stdio: "inherit"
  });
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`${base}/health`);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Bridge did not become healthy at ${base}`);
}

function printTable(rows) {
  // lightweight table (no deps)
  const cols = ["id", "kind", "genre", "conf", "query"];
  const widths = Object.fromEntries(cols.map((c) => [c, c.length]));
  for (const r of rows) {
    for (const c of cols) widths[c] = Math.max(widths[c], String(r[c] ?? "").length);
  }
  const line = (obj) => cols.map((c) => String(obj[c] ?? "").padEnd(widths[c])).join("  ");
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => "-".repeat(widths[c])).join("  "));
  for (const r of rows) console.log(line(r));
}

async function runClassify() {
  const generated = [];
  for (let i = 0; i < queries.length; i++) {
    const id = `t${String(i + 1).padStart(2, "0")}`;
    const query = queries[i].q;
    try {
      const url = await ytsearch1(query);
      generated.push({ id, url, query });
    } catch (e) {
      generated.push({ id, url: null, query, error: String(e?.message ?? e) });
    }
  }

  const items = generated.filter((x) => x.url).map((x) => ({ id: x.id, url: x.url }));
  const out = await fetchJson(`${base}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items })
  });

  const byId = new Map(out.results.map((r) => [r.id, r]));
  const rows = generated.map((g) => {
    const r = g.url ? byId.get(g.id) : null;
    return {
      id: g.id,
      kind: r?.kind ?? "error",
      genre: r?.genre ?? "",
      conf: typeof r?.confidence === "number" ? r.confidence.toFixed(2) : "",
      query: g.query.slice(0, 44)
    };
  });

  console.log(`\nClassify source: ${out.source}\n`);
  printTable(rows);
}

async function runQueueEdgeCase() {
  const inboxDir = "./DJ Library/00_INBOX_E2E";
  const urls = [
    { id: "bad1", url: "https://www.youtube.com/watch?v=dhI6eVMPdhM" }, // private
    { id: "ok1", url: await ytsearch1("tech house track") }
  ];

  const classify = await fetchJson(`${base}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: urls.map((u) => ({ id: u.id, url: u.url })) })
  });
  const tagsById = new Map(classify.results.map((r) => [r.id, r]));

  const start = await fetchJson(`${base}/queue/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inboxDir,
      mode: "fast",
      items: urls.map((u) => {
        const t = tagsById.get(u.id);
        return { id: u.id, url: u.url, presetSnapshot: { genre: t?.genre ?? "Other", energy: t?.energy ?? "", time: t?.time ?? "", vibe: t?.vibe ?? "" } };
      })
    })
  });

  console.log(`\nQueue jobId: ${start.jobId}`);
  console.log(urls);

  const controller = new AbortController();
  const res = await fetch(`${base}/events?jobId=${encodeURIComponent(start.jobId)}`, { signal: controller.signal });
  if (!res.ok || !res.body) throw new Error("Failed to connect to /events");

  const decoder = new TextDecoder();
  let buf = "";

  try {
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = block.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const data = line.slice("data: ".length);
        try {
          const evt = JSON.parse(data);
          if (evt.type === "item-error") {
            console.log("item-error:", evt.itemId, String(evt.error ?? "").split("\n")[0]);
          }
          if (evt.type === "item-done") console.log("item-done:", evt.itemId);
          if (evt.type === "queue-done" || evt.type === "queue-cancelled") {
            console.log(evt.type);
            controller.abort();
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (e) {
    if (String(e?.name ?? "") !== "AbortError") throw e;
  }
}

const bridge = startBridge();
try {
  await waitForHealth();
  await runClassify();
  if (shouldDownload) await runQueueEdgeCase();
} finally {
  bridge.kill("SIGTERM");
}

