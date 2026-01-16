import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getChromaprintFingerprint } from "./fingerprint.js";

export type MusicMatch = {
  provider: "acoustid+musicbrainz";
  acoustidScore: number;
  recordingMbid: string;
  recordingTitle: string;
  artist: string;
  album: string | null;
  year: string | null;
  label: string | null;
  applied: boolean;
};

export type MatchedMetadata = {
  artist: string;
  title: string;
  version: string | null;
  album: string | null;
  year: string | null;
  label: string | null;
  match: MusicMatch;
};

export async function tryMatchMusicMetadata(input: {
  audioPath: string;
  fallback: { artist: string; title: string; version: string | null };
  titleHadSeparator: boolean;
}): Promise<MatchedMetadata | null> {
  const key = process.env.DROPCRATE_ACOUSTID_KEY?.trim();
  if (!key) return null;

  let fp: { duration: number; fingerprint: string };
  try {
    fp = await getChromaprintFingerprint(input.audioPath, { timeoutMs: 20_000 });
  } catch {
    return null;
  }

  const cacheKey = crypto.createHash("sha1").update(`${fp.duration}:${fp.fingerprint}`).digest("hex");
  const cached = await readCache(cacheKey);
  let lookup: AcoustidResponse | null = null;
  if (cached) {
    lookup = cached as AcoustidResponse;
  } else {
    try {
      lookup = await acoustidLookup({ key, duration: fp.duration, fingerprint: fp.fingerprint });
      await writeCache(cacheKey, lookup);
    } catch {
      // Invalid key / network errors should never break downloads.
      return null;
    }
  }

  const best = pickBestAcoustid(lookup);
  if (!best) return null;

  // Be conservative: override only when the fingerprint match is strong.
  const required = input.titleHadSeparator ? 0.95 : 0.85;
  if (best.score < required) return null;

  const mb = await musicbrainzRecording(best.recordingMbid).catch(() => null);
  if (!mb) return null;

  const artist = joinArtistCredit(mb["artist-credit"]);
  const title = String(mb.title ?? "").trim();
  if (!artist || !title) return null;

  const { album, year, label } = pickBestRelease(mb.releases ?? null);

  const { title: nextTitle, version: nextVersion } = applyFallbackVersion({ title, fallbackVersion: input.fallback.version });
  const applied = artist !== input.fallback.artist || nextTitle !== input.fallback.title;

  return {
    artist,
    title: nextTitle,
    version: nextVersion,
    album,
    year,
    label,
    match: {
      provider: "acoustid+musicbrainz",
      acoustidScore: best.score,
      recordingMbid: best.recordingMbid,
      recordingTitle: title,
      artist,
      album,
      year,
      label,
      applied
    }
  };
}

type AcoustidResponse = {
  status?: string;
  results?: Array<{
    score?: number;
    recordings?: Array<{ id?: string; title?: string; artists?: Array<{ name?: string }> }>;
  }>;
};

async function acoustidLookup(input: { key: string; duration: number; fingerprint: string }): Promise<AcoustidResponse> {
  // Use POST to avoid URL length limits (fingerprints are large).
  const url = "https://api.acoustid.org/v2/lookup";
  const body = new URLSearchParams();
  body.set("client", input.key);
  body.set("meta", "recordings");
  body.set("duration", String(Math.round(input.duration)));
  body.set("fingerprint", input.fingerprint);
  return await fetchJson(url, {
    timeoutMs: 25_000,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
}

function pickBestAcoustid(resp: AcoustidResponse): { score: number; recordingMbid: string } | null {
  const results = Array.isArray(resp?.results) ? resp.results : [];
  let bestScore = -1;
  let bestRecording: string | null = null;
  for (const r of results) {
    const score = typeof r?.score === "number" ? r.score : 0;
    const recId = r?.recordings?.[0]?.id ? String(r.recordings[0].id) : null;
    if (!recId) continue;
    if (score > bestScore) {
      bestScore = score;
      bestRecording = recId;
    }
  }
  if (!bestRecording || bestScore < 0) return null;
  return { score: bestScore, recordingMbid: bestRecording };
}

type MbRecording = {
  title?: string;
  "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
  releases?: Array<{
    title?: string;
    date?: string;
    status?: string;
    "label-info"?: Array<{ label?: { name?: string } }>;
  }>;
};

async function musicbrainzRecording(mbid: string): Promise<MbRecording> {
  const url = new URL(`https://musicbrainz.org/ws/2/recording/${encodeURIComponent(mbid)}`);
  url.searchParams.set("inc", "artists+releases+labels");
  url.searchParams.set("fmt", "json");
  return await fetchJson(url.toString(), {
    timeoutMs: 25_000,
    headers: { "User-Agent": process.env.DROPCRATE_MUSICBRAINZ_UA?.trim() || "DropCrate/0.1.0 (local)" }
  });
}

function joinArtistCredit(ac: MbRecording["artist-credit"]): string {
  const parts = (ac ?? [])
    .map((p) => String(p?.artist?.name ?? p?.name ?? "").trim())
    .filter(Boolean);
  return parts.join(" & ");
}

function pickBestRelease(releases: MbRecording["releases"] | null): { album: string | null; year: string | null; label: string | null } {
  const list = Array.isArray(releases) ? releases : [];
  if (!list.length) return { album: null, year: null, label: null };
  const best = list.find((r) => String(r.status ?? "").toLowerCase() === "official") ?? list[0]!;
  const album = best.title ? String(best.title).trim() : null;
  const date = best.date ? String(best.date) : "";
  const year = date.length >= 4 ? date.slice(0, 4) : null;
  const labelInfo = best["label-info"]?.[0]?.label?.name;
  const label = labelInfo ? String(labelInfo).trim() : null;
  return { album, year, label };
}

/**
 * Extract version info from a title and return base title + version.
 * E.g. "Strobe (Extended Mix)" → { base: "Strobe", version: "Extended Mix" }
 */
function extractVersionFromTitle(title: string): { base: string; version: string | null } {
  const match = title.match(/^(.+?)\s*\(([^)]{2,80})\)\s*$/);
  if (match) {
    return { base: match[1]!.trim(), version: match[2]!.trim() };
  }
  return { base: title.trim(), version: null };
}

function applyFallbackVersion(input: { title: string; fallbackVersion: string | null }): { title: string; version: string | null } {
  const title = input.title.trim();
  const extracted = extractVersionFromTitle(title);

  // If MusicBrainz title has a version, use that
  if (extracted.version) {
    return { title: title, version: extracted.version };
  }

  // Otherwise, apply fallback version from YouTube
  const version = input.fallbackVersion?.trim() ?? "";
  if (!version) {
    return { title, version: null };
  }
  return { title: `${title} (${version})`, version };
}

async function fetchJson(
  url: string,
  opts: { timeoutMs: number; headers?: Record<string, string>; method?: string; body?: string }
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, { method: opts.method, body: opts.body, headers: opts.headers, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

type CacheFile = { version: 1; entries: Record<string, any> };

async function readCache(key: string): Promise<any | null> {
  const file = cachePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw) as CacheFile;
    if (json?.version !== 1) return null;
    return json.entries?.[key] ?? null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: any): Promise<void> {
  const file = cachePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  let json: CacheFile = { version: 1, entries: {} };
  try {
    const raw = await fs.readFile(file, "utf8");
    json = JSON.parse(raw) as CacheFile;
    if (json?.version !== 1 || !json.entries) json = { version: 1, entries: {} };
  } catch {
    // ignore
  }
  json.entries[key] = value;
  // Cheap cap to avoid unbounded growth.
  const keys = Object.keys(json.entries);
  if (keys.length > 500) {
    for (const k of keys.slice(0, keys.length - 500)) delete json.entries[k];
  }
  await fs.writeFile(file, JSON.stringify(json, null, 2));
}

function cachePath(): string {
  return path.join(process.cwd(), ".dropcrate", "cache", "acoustid.json");
}
