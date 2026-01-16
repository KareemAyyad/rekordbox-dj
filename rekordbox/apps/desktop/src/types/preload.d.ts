export {};

type SessionPreset = { genre: string; energy: string; time: string; vibe: string };

type QueueStartPayload = {
  inboxDir: string;
  mode: "dj-safe" | "fast";
  loudness?: { targetI: number; targetTP: number; targetLRA: number };
  items: Array<{ id: string; url: string; presetSnapshot: SessionPreset }>;
};

type DropCrateEvent =
  | { type: "queue-start"; jobId: string; count: number; inboxDir: string; mode: string }
  | { type: "queue-done"; jobId: string }
  | { type: "queue-cancelled"; jobId: string }
  | { type: "item-start"; jobId: string; itemId: string; url: string }
  | { type: "item-done"; jobId: string; itemId: string; url: string }
  | { type: "item-error"; jobId: string; itemId: string; url: string; error: string }
  | { type: "core"; jobId: string; itemId: string; url: string; event: unknown };

declare global {
  interface Window {
    dropcrate: {
      settings: {
        get: () => Promise<{ inboxDir: string; loudness: { targetI: number; targetTP: number; targetLRA: number } }>;
        set: (next: { inboxDir?: string; loudness?: { targetI: number; targetTP: number; targetLRA: number } }) => Promise<boolean>;
      };
      queue: {
        start: (payload: QueueStartPayload) => Promise<{ jobId: string }>;
        cancel: () => Promise<boolean>;
      };
      library: {
        list: (payload: { inboxDir: string }) => Promise<Array<{ id: string; path: string; artist: string; title: string; genre: string; downloadedAt: string }>>;
      };
      shell: {
        open: (path: string) => Promise<boolean>;
        reveal: (path: string) => Promise<boolean>;
      };
      onEvent: (handler: (event: DropCrateEvent) => void) => () => void;
    };
  }
}
