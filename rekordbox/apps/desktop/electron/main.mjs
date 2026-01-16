import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import Store from "electron-store";
import { downloadBatch } from "@dropcrate/core";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Optional: portable/local userData for constrained environments.
// In production builds, prefer OS defaults unless explicitly overridden.
if (process.env.DROPCRATE_LOCAL_USERDATA === "1") {
  app.setPath("userData", path.join(process.cwd(), ".electron-user-data"));
  app.setPath("cache", path.join(process.cwd(), ".electron-cache-runtime"));
}

const settingsStore = new Store({
  name: "dropcrate",
  defaults: {
    inboxDir: "",
    loudness: { targetI: -14, targetTP: -1.0, targetLRA: 11 }
  }
});

/** @type {BrowserWindow | null} */
let win = null;

/** @type {{ jobId: string; cancelRequested: boolean } | null} */
let activeJob = null;

function getDefaultInboxDir() {
  const configured = settingsStore.get("inboxDir");
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  // Leave blank by default in dev; UI defaults to repo-local `./DJ Library/00_INBOX`.
  return "";
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 760,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs")
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexHtml = path.join(__dirname, "..", "dist", "index.html");
    await win.loadFile(indexHtml);
  }
}

function sendEvent(event) {
  if (!win) return;
  win.webContents.send("dropcrate:event", event);
}

ipcMain.handle("dropcrate:settings:get", async () => {
  return {
    inboxDir: getDefaultInboxDir(),
    loudness: settingsStore.get("loudness")
  };
});

ipcMain.handle("dropcrate:settings:set", async (_evt, next) => {
  if (next && typeof next === "object") {
    if (typeof next.inboxDir === "string") settingsStore.set("inboxDir", next.inboxDir);
    if (next.loudness && typeof next.loudness === "object") settingsStore.set("loudness", next.loudness);
  }
  return true;
});

ipcMain.handle("dropcrate:queue:cancel", async () => {
  if (activeJob) activeJob.cancelRequested = true;
  return true;
});

ipcMain.handle("dropcrate:library:list", async (_evt, payload) => {
  const inboxDir = String(payload?.inboxDir ?? "").trim();
  if (!inboxDir) return [];

  let entries = [];
  try {
    entries = await fs.readdir(inboxDir);
  } catch {
    return [];
  }

  const sidecars = entries.filter((f) => f.endsWith(".dropcrate.json"));
  const results = [];
  for (const f of sidecars) {
    const p = path.join(inboxDir, f);
    try {
      const raw = await fs.readFile(p, "utf8");
      const json = JSON.parse(raw);
      const normalized = json.normalized ?? {};
      const outputs = json.outputs ?? {};
      const audioPath = outputs.audioPath ?? "";
      if (!audioPath) continue;
      results.push({
        id: f,
        path: audioPath,
        artist: String(normalized.artist ?? ""),
        title: String(normalized.title ?? ""),
        genre: String(json.djDefaults?.genre ?? ""),
        downloadedAt: String(json.downloadedAt ?? "")
      });
    } catch {
      // ignore bad sidecars
    }
  }

  results.sort((a, b) => String(b.downloadedAt).localeCompare(String(a.downloadedAt)));
  return results;
});

ipcMain.handle("dropcrate:shell:open", async (_evt, targetPath) => {
  const p = String(targetPath ?? "");
  if (!p) return false;
  await shell.openPath(p);
  return true;
});

ipcMain.handle("dropcrate:shell:reveal", async (_evt, targetPath) => {
  const p = String(targetPath ?? "");
  if (!p) return false;
  shell.showItemInFolder(p);
  return true;
});

ipcMain.handle("dropcrate:queue:start", async (_evt, payload) => {
  if (activeJob) throw new Error("A queue is already running.");
  const jobId = crypto.randomUUID();
  activeJob = { jobId, cancelRequested: false };

  const inboxDir = String(payload?.inboxDir ?? "").trim();
  const mode = String(payload?.mode ?? "dj-safe");
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const loudness = settingsStore.get("loudness");
  const targetI = Number(payload?.loudness?.targetI ?? loudness?.targetI ?? -14);
  const targetTP = Number(payload?.loudness?.targetTP ?? loudness?.targetTP ?? -1.0);
  const targetLRA = Number(payload?.loudness?.targetLRA ?? loudness?.targetLRA ?? 11);

  sendEvent({ type: "queue-start", jobId, count: items.length, inboxDir, mode });

  try {
    for (const item of items) {
      if (!activeJob || activeJob.cancelRequested) {
        sendEvent({ type: "queue-cancelled", jobId });
        break;
      }

      const itemId = String(item?.id ?? "");
      const url = String(item?.url ?? "");
      const preset = item?.presetSnapshot ?? {};

      sendEvent({ type: "item-start", jobId, itemId, url });

      const djDefaults = {
        genre: String(preset.genre ?? "Afro House"),
        energy: String(preset.energy ?? "3/5"),
        time: String(preset.time ?? "Peak"),
        vibe: String(preset.vibe ?? "Driving")
      };

      const isFast = mode === "fast";

      try {
        await downloadBatch({
          urls: [url],
          mode: "audio",
          inboxDir,
          audioFormat: isFast ? "auto" : "aiff",
          normalize: {
            enabled: !isFast,
            targetI,
            targetTP,
            targetLRA
          },
          djDefaults,
          onEvent: (e) => {
            // Minimal event mapping for UI; we keep itemId attached.
            sendEvent({ type: "core", jobId, itemId, url, event: e });
          }
        });
        sendEvent({ type: "item-done", jobId, itemId, url });
      } catch (error) {
        sendEvent({ type: "item-error", jobId, itemId, url, error: String(error?.message ?? error) });
      }
    }

    sendEvent({ type: "queue-done", jobId });
    return { jobId };
  } finally {
    activeJob = null;
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
