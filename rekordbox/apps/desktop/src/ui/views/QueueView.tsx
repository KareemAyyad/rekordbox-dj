import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Tooltip } from "../components/Tooltip";
import { StatusPill } from "../components/StatusPill";
import { useToast } from "../components/Toast";
import { getBackend } from "../../state/backend";
import { Badge, Button, Card, Panel, TextArea } from "../components/ui";

type QueueItem = {
  id: string;
  url: string;
  status: "queued" | "running" | "done" | "error";
  message?: string;
  presetSnapshot: { genre: string; energy: string; time: string; vibe: string };
  auto?: { status: "idle" | "running" | "done" | "error"; confidence?: number; notes?: string; kind?: string };
};

export function QueueView(props: {
  settings: { inboxDir: string; mode: "dj-safe" | "fast"; loudness: { targetI: number; targetTP: number; targetLRA: number } };
  onOpenSettings: () => void;
}): JSX.Element {
  const backend = getBackend();
  const { addToast } = useToast();
  const [text, setText] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const parsedUrls = useMemo(() => extractUrls(text).slice(0, 10), [text]);
  const hasQueued = useMemo(() => items.some((i) => i.status === "queued"), [items]);

  // Progress stats for global progress bar
  const progressStats = useMemo(() => {
    const total = items.filter((i) => i.status !== "queued" || running).length;
    const completed = items.filter((i) => i.status === "done" || i.status === "error").length;
    const processing = items.filter((i) => i.status === "running").length;
    return { total, completed, processing, percent: total > 0 ? (completed / total) * 100 : 0 };
  }, [items, running]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const retryItem = (item: QueueItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: "queued" as const, message: undefined, auto: { status: "idle" as const } } : i
      )
    );
    void autoClassify([{ id: item.id, url: item.url }]);
  };

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const addToQueue = () => {
    const next = parsedUrls.map((url) => ({
      id: crypto.randomUUID(),
      url,
      status: "queued" as const,
      presetSnapshot: { genre: "Other", energy: "", time: "", vibe: "" },
      auto: { status: "idle" as const }
    }));
    setItems((prev) => [...prev, ...next]);
    setText("");
    void autoClassify(next.map((n) => ({ id: n.id, url: n.url })));
  };

  const autoClassify = async (targets: Array<{ id: string; url: string }>) => {
    if (backend.kind !== "bridge") return;
    setItems((prev) => prev.map((i) => (targets.some((t) => t.id === i.id) ? { ...i, auto: { status: "running" } } : i)));
    try {
      const result = await backend.classify({ items: targets });
      const byId = new Map(result.results.map((r) => [r.id, r]));
      setItems((prev) =>
        prev.map((i) => {
          const r = byId.get(i.id);
          if (!r) return i;
          const confident = (r.confidence ?? 0) >= 0.6;
          const musicish = r.kind === "track" || r.kind === "set";
          const nextPreset = (() => {
            if (!confident) return i.presetSnapshot;
            if (!musicish) return { genre: "Other", energy: "", time: "", vibe: "" };
            return {
              genre: r.genre ?? "Other",
              energy: r.energy ?? "",
              time: r.time ?? "",
              vibe: r.vibe ?? ""
            };
          })();
          return {
            ...i,
            presetSnapshot: nextPreset,
            auto: { status: "done", confidence: r.confidence, notes: r.notes, kind: r.kind }
          };
        })
      );
    } catch (e: any) {
      const details = String(e?.message ?? e);
      const msg = details.includes("timed out")
        ? `Auto-tagging timed out. You can retry, or press Start to continue (tags will use safe defaults if needed). Details: ${details}`
        : `Auto-tagging failed. Details: ${details}`;
      setItems((prev) => prev.map((i) => (targets.some((t) => t.id === i.id) ? { ...i, auto: { status: "error", notes: msg } } : i)));
    }
  };

  const classifyForStart = async (queued: QueueItem[]): Promise<Map<string, QueueItem["presetSnapshot"]>> => {
    if (backend.kind !== "bridge") return new Map();
    const targets = queued.map((q) => ({ id: q.id, url: q.url }));
    setItems((prev) => prev.map((i) => (targets.some((t) => t.id === i.id) ? { ...i, auto: { status: "running" } } : i)));
    try {
      const result = await backend.classify({ items: targets });
      const byId = new Map(result.results.map((r) => [r.id, r] as const));
      const nextByItemId = new Map<string, QueueItem["presetSnapshot"]>();

      setItems((prev) =>
        prev.map((i) => {
          const r = byId.get(i.id);
          if (!r) return i;
          const confident = (r.confidence ?? 0) >= 0.6;
          const musicish = r.kind === "track" || r.kind === "set";
          const nextPreset = (() => {
            if (!confident) return i.presetSnapshot;
            if (!musicish) return { genre: "Other", energy: "", time: "", vibe: "" };
            return {
              genre: r.genre ?? "Other",
              energy: r.energy ?? "",
              time: r.time ?? "",
              vibe: r.vibe ?? ""
            };
          })();
          nextByItemId.set(i.id, nextPreset);
          return { ...i, presetSnapshot: nextPreset, auto: { status: "done", confidence: r.confidence, notes: r.notes, kind: r.kind } };
        })
      );

      return nextByItemId;
    } catch (e: any) {
      const details = String(e?.message ?? e);
      const msg = details.includes("timed out")
        ? `Auto-tagging timed out. Continuing with safe defaults. Details: ${details}`
        : `Auto-tagging failed. Continuing with safe defaults. Details: ${details}`;
      setItems((prev) => prev.map((i) => (queued.some((q) => q.id === i.id) ? { ...i, auto: { status: "error", notes: msg } } : i)));
      return new Map();
    }
  };

  const start = async () => {
    if (running) return;
    const queued = items.filter((i) => i.status === "queued");
    if (!queued.length) return;
    setRunning(true);
    try {
      // Ensure we have best-available tags before we lock them into exported files.
      const tagOverrides = await classifyForStart(queued);

      setItems((prev) => prev.map((i) => (i.status === "queued" ? { ...i, status: "running" } : i)));

      unsubscribeRef.current?.();
      unsubscribeRef.current = backend.onEvent((evt) => {
        if (evt.type === "queue-start") setJobId(evt.jobId);
        if (evt.type === "item-done") {
          setItems((prev) => prev.map((i) => (i.id === evt.itemId ? { ...i, status: "done" } : i)));
        }
        if (evt.type === "item-error") {
          setItems((prev) => prev.map((i) => (i.id === evt.itemId ? { ...i, status: "error", message: evt.error } : i)));
          addToast("error", `Download failed: ${evt.error?.slice(0, 100) ?? "Unknown error"}`);
        }
        if (evt.type === "item-start") {
          setItems((prev) => prev.map((i) => (i.id === evt.itemId ? { ...i, status: "running" } : i)));
        }
        if (evt.type === "queue-done") {
          setRunning(false);
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          // Show completion toast with summary
          setItems((prev) => {
            const done = prev.filter((i) => i.status === "done").length;
            const failed = prev.filter((i) => i.status === "error").length;
            if (failed > 0) {
              addToast("warning", `Completed: ${done} successful, ${failed} failed`);
            } else if (done > 0) {
              addToast("success", `All ${done} track${done > 1 ? "s" : ""} downloaded successfully`);
            }
            return prev;
          });
        }
        if (evt.type === "queue-cancelled") {
          setRunning(false);
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          addToast("info", "Queue cancelled");
        }
      });

      const started = await backend.queue.start({
        inboxDir: props.settings.inboxDir,
        mode: props.settings.mode,
        loudness: props.settings.loudness,
        items: queued.map((i) => ({ id: i.id, url: i.url, presetSnapshot: tagOverrides.get(i.id) ?? i.presetSnapshot }))
      });
      setJobId(started.jobId);
    } catch (e: any) {
      const msg =
        backend.kind === "bridge"
          ? `Backend not running. Start with: npm run dev:web:full. Details: ${String(e?.message ?? e)}`
          : String(e?.message ?? e);
      setItems((prev) => prev.map((i) => (i.status === "running" ? { ...i, status: "error", message: msg } : i)));
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      setRunning(false);
      addToast("error", backend.kind === "bridge" ? "Backend not running" : "Failed to start queue");
    }
  };

  const cancel = async () => {
    await backend.queue.cancel({ jobId: jobId ?? undefined });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--dc-text)]">Paste & Queue</h2>
            <p className="mt-1 text-sm text-[var(--dc-muted)]">
              Paste up to 10 YouTube links. Defaults are DJ-safe and Rekordbox-ready.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={addToQueue} disabled={!parsedUrls.length}>
              Add {parsedUrls.length ? `(${parsedUrls.length})` : ""}
            </Button>
            <Button variant="primary" onClick={start} disabled={running || !hasQueued}>
              {running ? "Running..." : "Start"}
            </Button>
            <Button variant="danger" onClick={cancel} disabled={!running}>
              Stop
            </Button>
          </div>
        </div>

        {/* Input Area */}
        <div className="mt-4 grid gap-3">
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste links here..."
            className="h-28"
          />
          <div className="text-xs text-[var(--dc-muted2)]">Detected: {parsedUrls.length} URL(s)</div>
        </div>

        {/* Global Progress Bar */}
        {running && progressStats.total > 0 && (
          <div className="mt-6 dc-animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--dc-text)]">
                Processing {progressStats.completed} of {progressStats.total}
              </span>
              <span className="text-xs font-medium text-[var(--dc-muted)]">
                {Math.round(progressStats.percent)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--dc-chip)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--dc-accent)] transition-all duration-500 ease-out"
                style={{ width: `${progressStats.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Queue List */}
        <div className="mt-6 space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <QueueItemRow
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
                onRetry={() => retryItem(item)}
                running={running}
              />
            ))
          ) : (
            <EmptyQueueState />
          )}
        </div>
      </Card>

      {/* Sidebar */}
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--dc-text)]">Auto Tagging</h2>
            <p className="mt-1 text-sm text-[var(--dc-muted)]">
              Tags are detected automatically.
            </p>
          </div>
          <Badge className="rounded-xl px-3 py-1.5 text-[10px] font-semibold">Automatic</Badge>
        </div>

        <div className="mt-5 space-y-4">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--dc-text)]">Output</div>
                <div className="mt-1 text-xs text-[var(--dc-muted)]">Rekordbox watch folder (or local test folder).</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-xl px-3 py-1.5 text-[10px] font-semibold">INBOX</Badge>
                <Button size="sm" onClick={props.onOpenSettings}>
                  Change
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <div className="rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm text-[var(--dc-text)]">
                {props.settings.inboxDir}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <Tooltip
                title="Mode"
                body="DJ-Safe outputs normalized AIFF with artwork + tags (recommended). Fast keeps native codec and skips normalization."
                learnMoreHref="docs/cli.md"
              >
                <div className="text-xs font-semibold text-[var(--dc-text)]">
                  Mode{" "}
                  <span className="ml-2 rounded-md bg-[var(--dc-accent-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--dc-accent-text)] ring-1 ring-[color:var(--dc-accent-border)]">
                    ?
                  </span>
                </div>
              </Tooltip>
              <Badge className="rounded-xl px-3 py-1.5 text-[10px] font-semibold">
                {props.settings.mode === "fast" ? "FAST" : "DJ-SAFE"}
              </Badge>
            </div>
          </Panel>

          <Panel>
            <div className="text-xs font-semibold text-[var(--dc-text)]">Tip</div>
            <div className="mt-1 text-xs leading-relaxed text-[var(--dc-muted)]">
              Add links - DropCrate tags them automatically - Start locks tags into the exported files written to your
              Rekordbox watch folder.
            </div>
            {jobId ? (
              <div className="mt-2 text-[10px] font-semibold text-[var(--dc-muted2)]">JOB: {jobId}</div>
            ) : null}
          </Panel>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * QueueItemRow - Individual queue item with actions
 * ───────────────────────────────────────────────────────────────────────────── */
function QueueItemRow({
  item,
  onRemove,
  onRetry,
  running
}: {
  item: QueueItem;
  onRemove: () => void;
  onRetry: () => void;
  running: boolean;
}): JSX.Element {
  const isError = item.status === "error";
  const canRemove = item.status === "queued" || item.status === "done" || item.status === "error";
  const canRetry = isError && !running;

  // Map internal status to StatusPill status type
  const pillStatus = item.status === "running" ? "processing" : item.status;

  return (
    <div
      className={clsx(
        "dc-animate-fadeIn group relative rounded-2xl border bg-[var(--dc-card2)] p-4 transition-all duration-200",
        isError
          ? "border-[color:var(--dc-danger-border)] bg-[var(--dc-danger-bg)]/30"
          : "border-[color:var(--dc-border)] hover:bg-[var(--dc-card)] hover:border-[color:var(--dc-border-strong)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Content */}
        <div className="min-w-0 flex-1">
          {/* URL */}
          <p className="truncate text-sm font-medium text-[var(--dc-text)]">{item.url}</p>

          {/* Auto-classification status */}
          {item.auto?.status === "running" && (
            <p className="mt-1.5 text-xs text-[var(--dc-muted)] flex items-center gap-1.5">
              <svg className="w-3 h-3 dc-animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Auto-classifying...
            </p>
          )}

          {item.auto?.status === "done" && (
            <p className="mt-1.5 text-xs text-[var(--dc-muted2)]">
              {item.auto.kind ?? "unknown"} - {((item.auto.confidence ?? 0) * 100).toFixed(0)}% confidence
            </p>
          )}

          {/* Error Message - Prominent display */}
          {isError && item.message && (
            <div className="mt-3 rounded-xl bg-[var(--dc-danger-bg)] border border-[color:var(--dc-danger-border)] p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-[var(--dc-danger-text)] shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-xs font-medium text-[var(--dc-danger-text)] leading-relaxed">{item.message}</p>
              </div>
            </div>
          )}

          {/* Auto-classification error */}
          {item.auto?.status === "error" && item.auto.notes && (
            <p className="mt-1.5 text-xs text-[var(--dc-danger-text)]">{item.auto.notes}</p>
          )}

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{item.presetSnapshot.genre}</Badge>
            {item.presetSnapshot.energy && <Badge>ENERGY {item.presetSnapshot.energy}</Badge>}
            {item.presetSnapshot.time && <Badge>{item.presetSnapshot.time}</Badge>}
            {item.presetSnapshot.vibe && <Badge>{item.presetSnapshot.vibe}</Badge>}
          </div>
        </div>

        {/* Right: Status and Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Retry Button - for failed items */}
          {canRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)] hover:brightness-95 transition-all"
              title="Retry"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry
            </button>
          )}

          {/* Remove Button - always visible */}
          {canRemove && (
            <button
              onClick={onRemove}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--dc-muted)] hover:text-[var(--dc-danger-text)] hover:bg-[var(--dc-danger-bg)] transition-all"
              title="Remove from queue"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}

          {/* Status Pill */}
          <StatusPill status={pillStatus} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * EmptyQueueState - Premium empty state with icon
 * ───────────────────────────────────────────────────────────────────────────── */
function EmptyQueueState(): JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--dc-border)] bg-[var(--dc-card2)]/50 p-12 text-center">
      {/* Icon */}
      <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--dc-chip)] flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-[var(--dc-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
      </div>

      {/* Text */}
      <h3 className="text-base font-semibold text-[var(--dc-text)]">No tracks in queue</h3>
      <p className="mt-2 text-sm text-[var(--dc-muted)] max-w-xs mx-auto leading-relaxed">
        Paste YouTube links above to start building your crate. Each link will be automatically tagged and processed.
      </p>

      {/* Hints */}
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[var(--dc-muted2)]">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Auto-tagged
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          DJ-Safe defaults
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Rekordbox-ready
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Utilities
 * ───────────────────────────────────────────────────────────────────────────── */
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+/g) ?? [];
  return matches.map((m) => m.trim()).filter(Boolean);
}
