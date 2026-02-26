import type { ClassifyResult, LibraryItem, Settings } from "./types";

const API_BASE = typeof window !== "undefined" ? "" : "http://localhost:8000";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => apiFetch<{ ok: boolean }>("/api/health"),

  getSettings: () => apiFetch<Settings>("/api/settings"),

  updateSettings: (update: Partial<Settings>) =>
    apiFetch<{ ok: boolean }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(update),
    }),

  classify: (items: { id: string; url: string }[]) =>
    apiFetch<{ ok: boolean; source: string; results: ClassifyResult[]; ms: number }>(
      "/api/classify",
      { method: "POST", body: JSON.stringify({ items }) }
    ),

  startQueue: (payload: {
    inbox_dir: string;
    mode: string;
    audio_format: string;
    normalize_enabled: boolean;
    loudness: { target_i: number; target_tp: number; target_lra: number };
    items: { id: string; url: string; preset_snapshot: { genre: string; energy: string; time: string; vibe: string } }[];
  }) =>
    apiFetch<{ job_id: string }>("/api/queue/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  stopQueue: (jobId: string) =>
    apiFetch<{ ok: boolean }>("/api/queue/stop", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId }),
    }),

  getLibrary: (search = "", sort = "date") =>
    apiFetch<LibraryItem[]>(`/api/library?search=${encodeURIComponent(search)}&sort=${sort}`),
};
