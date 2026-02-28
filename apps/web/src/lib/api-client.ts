import type { ClassifyResult, LibraryItem, SegmentItem, SegmentSession, Settings } from "./types";

const API_BASE = typeof window !== "undefined" ? "" : "http://localhost:8000";

/** Map a backend segment (snake_case) to frontend SegmentItem (camelCase). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSegment(s: any): SegmentItem {
  return {
    id: s.id,
    prompt: s.prompt,
    label: s.label,
    targetUrl: s.target_url ?? s.targetUrl,
    residualUrl: s.residual_url ?? s.residualUrl,
    durationSeconds: s.duration_seconds ?? s.durationSeconds,
  };
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  console.log(`[API] ${opts?.method || 'GET'} ${path}`);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[API] ERROR ${res.status} on ${path}:`, text);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  console.log(`[API] Response from ${path}:`, data);
  return data;
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

  exportRekordboxXml: async () => {
    const res = await fetch(`${API_BASE}/api/library/rekordbox-xml`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Export failed ${res.status}: ${text}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dropcrate_import.xml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // --- YouTube Auth (PO Token auto-auth + cookies fallback) ---

  getYoutubeAuthStatus: () =>
    apiFetch<{ authenticated: boolean; method: string }>("/api/settings/youtube-auth/status"),

  // --- YouTube Cookies (fallback) ---

  getYoutubeCookiesStatus: () =>
    apiFetch<{ configured: boolean; source: string }>("/api/settings/youtube-cookies"),

  uploadYoutubeCookies: async (file: File): Promise<{ ok: boolean; error?: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/settings/youtube-cookies`, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed ${res.status}: ${text}`);
    }
    return res.json();
  },

  deleteYoutubeCookies: () =>
    apiFetch<{ ok: boolean }>("/api/settings/youtube-cookies", { method: "DELETE" }),

  // --- Segment (SAM-Audio) ---

  uploadAudio: async (file: File): Promise<SegmentSession> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/segment/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed ${res.status}: ${text}`);
    }
    const data = await res.json();
    return {
      id: data.session_id,
      filename: data.filename,
      durationSeconds: data.duration_seconds,
      sampleRate: data.sample_rate,
      channels: data.channels,
    };
  },

  separateAudio: async (params: {
    session_id: string;
    prompt: string;
    shifts?: number;
    overlap?: number;
  }): Promise<{ ok: boolean; segment: SegmentItem }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await apiFetch<any>("/api/segment/separate", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { ok: data.ok, segment: mapSegment(data.segment) };
  },

  autoSegment: (params: {
    session_id: string;
    categories?: string[];
    shifts?: number;
    overlap?: number;
  }) =>
    apiFetch<{ ok: boolean; job_id: string }>("/api/segment/auto", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  deleteSegmentSession: (sessionId: string) =>
    apiFetch<{ ok: boolean }>(`/api/segment/session/${sessionId}`, { method: "DELETE" }),
};
