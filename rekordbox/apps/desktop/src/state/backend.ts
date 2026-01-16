type SessionPreset = { genre: string; energy: string; time: string; vibe: string };

export type Loudness = { targetI: number; targetTP: number; targetLRA: number };

export type QueueItemInput = { id: string; url: string; presetSnapshot: SessionPreset };

export type DropCrateEvent =
  | { type: "queue-start"; jobId: string; count: number; inboxDir: string; mode: string }
  | { type: "queue-done"; jobId: string }
  | { type: "queue-cancelled"; jobId: string }
  | { type: "item-start"; jobId: string; itemId: string; url: string }
  | { type: "item-done"; jobId: string; itemId: string; url: string }
  | { type: "item-error"; jobId: string; itemId: string; url: string; error: string }
  | { type: "core"; jobId: string; itemId: string; url: string; event: unknown };

export type Backend = {
  kind: "electron" | "bridge";
  settings: {
    get: () => Promise<{ inboxDir: string; mode?: "dj-safe" | "fast"; loudness: Loudness }>;
    set: (next: { inboxDir?: string; mode?: "dj-safe" | "fast"; loudness?: Loudness }) => Promise<boolean>;
  };
  queue: {
    start: (payload: { inboxDir: string; mode: "dj-safe" | "fast"; loudness?: Loudness; items: QueueItemInput[] }) => Promise<{ jobId: string }>;
    cancel: (payload?: { jobId?: string }) => Promise<boolean>;
  };
  library: {
    list: (payload: { inboxDir: string }) => Promise<Array<{ id: string; path: string; downloadUrl?: string; artist: string; title: string; genre: string; downloadedAt: string }>>;
  };
  shell: {
    open: (path: string) => Promise<boolean>;
    reveal: (path: string) => Promise<boolean>;
  };
  classify: (payload: { items: Array<{ id: string; url: string }> }) => Promise<{
    source: "openai" | "heuristic";
    results: Array<{ id: string; kind: string; genre: string | null; energy: string | null; time: string | null; vibe: string | null; confidence: number; notes: string }>;
  }>;
  onEvent: (handler: (event: DropCrateEvent) => void) => () => void;
};

let singleton: Backend | null = null;

export function getBackend(): Backend {
  if (singleton) return singleton;
  if (typeof window !== "undefined" && (window as any).dropcrate) {
    singleton = createElectronBackend();
    return singleton;
  }
  singleton = createBridgeBackend();
  return singleton;
}

function createElectronBackend(): Backend {
  const dc = (window as any).dropcrate;
  return {
    kind: "electron",
    settings: dc.settings,
    queue: {
      start: dc.queue.start,
      cancel: async () => dc.queue.cancel()
    },
    library: dc.library,
    shell: dc.shell,
    classify: async () => ({ source: "heuristic", results: [] }),
    onEvent: dc.onEvent
  };
}

function createBridgeBackend(): Backend {
  const baseUrl = (import.meta as any).env?.VITE_DROPCRATE_BRIDGE_URL ?? 
                  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");
  const listeners = new Set<(event: DropCrateEvent) => void>();
  let eventSource: EventSource | null = null;
  let currentJobId: string | null = null;

  const emit = (e: DropCrateEvent) => {
    for (const fn of listeners) fn(e);
  };

  const ensureSse = (jobId: string) => {
    if (eventSource && currentJobId === jobId) return;
    if (eventSource) eventSource.close();
    currentJobId = jobId;
    eventSource = new EventSource(`${baseUrl}/events?jobId=${encodeURIComponent(jobId)}`);
    eventSource.onmessage = (msg) => {
      try {
        emit(JSON.parse(msg.data) as DropCrateEvent);
      } catch {
        // ignore
      }
    };
    eventSource.onerror = () => {
      // keep trying; browser will reconnect automatically
    };
  };

  return {
    kind: "bridge",
    settings: {
      get: async () => {
        const res = await fetch(`${baseUrl}/settings`);
        if (!res.ok) throw new Error(`Bridge settings failed (${res.status})`);
        return (await res.json()) as { inboxDir: string; mode?: "dj-safe" | "fast"; loudness: Loudness };
      },
      set: async (next) => {
        const res = await fetch(`${baseUrl}/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
        return res.ok;
      }
    },
    queue: {
      start: async (payload) => {
        const res = await fetch(`${baseUrl}/queue/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(`Bridge start failed (${res.status})`);
        const json = (await res.json()) as { jobId: string };
        ensureSse(json.jobId);
        return json;
      },
      cancel: async (payload) => {
        const res = await fetch(`${baseUrl}/queue/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? { jobId: currentJobId }) });
        return res.ok;
      }
    },
    library: {
      list: async (payload) => {
        const url = new URL(`${baseUrl}/library`);
        url.searchParams.set("inboxDir", payload.inboxDir);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Bridge library failed (${res.status})`);
        return (await res.json()) as Array<{ id: string; path: string; artist: string; title: string; genre: string; downloadedAt: string }>;
      }
    },
    shell: {
      open: async (filePath: string) => {
        try {
          const res = await fetch(`${baseUrl}/shell/open`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath })
          });
          return res.ok;
        } catch {
          return false;
        }
      },
      reveal: async (filePath: string) => {
        try {
          const res = await fetch(`${baseUrl}/shell/reveal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath })
          });
          return res.ok;
        } catch {
          return false;
        }
      }
    },
    classify: async (payload) => {
      const res = await fetchWithTimeout(`${baseUrl}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Auto-tagging can take longer (yt-dlp metadata + optional OpenAI). Avoid false timeouts.
        timeoutMs: 90_000
      });
      if (!res.ok) throw new Error(`Bridge classify failed (${res.status})`);
      return (await res.json()) as any;
    },
    onEvent: (handler) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }
  };
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
