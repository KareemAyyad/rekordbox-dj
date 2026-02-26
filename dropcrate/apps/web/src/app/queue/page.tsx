"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import { useQueueStore } from "@/stores/queue-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSSE } from "@/hooks/use-sse";
import { api } from "@/lib/api-client";
import { extractYouTubeUrls } from "@/lib/url-parser";
import { STAGE_LABELS } from "@/lib/constants";
import type { QueueItem, DJTags } from "@/lib/types";

function StatusPill({ status }: { status: QueueItem["status"] }) {
  const styles = {
    queued: "bg-[var(--dc-chip)] text-[var(--dc-muted)]",
    running: "bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)] border border-[color:var(--dc-accent-border)]",
    done: "bg-[var(--dc-success-bg)] text-[var(--dc-success-text)] border border-[color:var(--dc-success-border)]",
    error: "bg-[var(--dc-danger-bg)] text-[var(--dc-danger-text)] border border-[color:var(--dc-danger-border)]",
  };
  const labels = { queued: "Queued", running: "Processing", done: "Done", error: "Error" };
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", styles[status])}>
      {status === "running" && (
        <svg className="h-3 w-3 dc-animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      )}
      {labels[status]}
    </span>
  );
}

function QueueItemRow({ item, onRemove, onRetry }: {
  item: QueueItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const stage = item.auto?.stage;
  return (
    <div className="dc-animate-fadeIn rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--dc-text)]">{item.url}</p>
          {stage && item.status === "running" && (
            <p className="mt-1 text-xs font-medium text-[var(--dc-accent-text)] uppercase tracking-wider">
              {STAGE_LABELS[stage] || stage}
            </p>
          )}
          {item.message && item.status === "error" && (
            <p className="mt-1.5 rounded-lg bg-[var(--dc-danger-bg)] px-2.5 py-1.5 text-xs text-[var(--dc-danger-text)]">
              {item.message}
            </p>
          )}
          {/* Tag badges */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.presetSnapshot.genre && item.presetSnapshot.genre !== "Other" && (
              <span className="rounded-full bg-[var(--dc-accent-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-accent-text)]">
                {item.presetSnapshot.genre}
              </span>
            )}
            {item.presetSnapshot.energy && (
              <span className="rounded-full bg-[var(--dc-warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-warning-text)]">
                {item.presetSnapshot.energy}
              </span>
            )}
            {item.presetSnapshot.time && (
              <span className="rounded-full bg-[var(--dc-success-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-success-text)]">
                {item.presetSnapshot.time}
              </span>
            )}
            {item.presetSnapshot.vibe && (
              <span className="rounded-full bg-[var(--dc-chip)] px-2 py-0.5 text-[10px] font-medium text-[var(--dc-muted)]">
                {item.presetSnapshot.vibe}
              </span>
            )}
          </div>
          {/* Auto-classification confidence */}
          {item.auto?.status === "done" && item.auto.confidence !== undefined && (
            <p className="mt-1 text-xs text-[var(--dc-muted)]">
              Confidence: {Math.round(item.auto.confidence * 100)}%
              {item.auto.notes && ` — ${item.auto.notes}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={item.status} />
          {item.status === "error" && (
            <button
              onClick={onRetry}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--dc-accent-text)] bg-[var(--dc-accent-bg)] hover:bg-[var(--dc-accent-border)] transition"
            >
              Retry
            </button>
          )}
          {(item.status === "queued" || item.status === "error") && (
            <button
              onClick={onRemove}
              className="rounded-lg p-1 text-[var(--dc-muted2)] hover:text-[var(--dc-danger)] hover:bg-[var(--dc-danger-bg)] transition"
              title="Remove"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QueuePage() {
  const [inputText, setInputText] = useState("");
  const items = useQueueStore((s) => s.items);
  const running = useQueueStore((s) => s.running);
  const jobId = useQueueStore((s) => s.jobId);
  const addItems = useQueueStore((s) => s.addItems);
  const removeItem = useQueueStore((s) => s.removeItem);
  const setRunning = useQueueStore((s) => s.setRunning);
  const setJobId = useQueueStore((s) => s.setJobId);
  const updateItemStatus = useQueueStore((s) => s.updateItemStatus);
  const updateItemAuto = useQueueStore((s) => s.updateItemAuto);
  const settings = useSettingsStore((s) => s.settings);

  // Load settings on mount
  useEffect(() => {
    api.getSettings().then((s) => useSettingsStore.getState().setSettings(s)).catch(() => {});
  }, []);

  // SSE connection
  useSSE(jobId);

  const detectedUrls = extractYouTubeUrls(inputText);

  const handleAdd = useCallback(() => {
    if (detectedUrls.length === 0) return;
    const defaults: DJTags = { genre: "Other", energy: "", time: "", vibe: "" };
    addItems(detectedUrls, defaults);
    setInputText("");

    // Auto-classify
    const newItems = useQueueStore.getState().items.slice(-detectedUrls.length);
    const classifyItems = newItems.map((i) => ({ id: i.id, url: i.url }));

    for (const ci of classifyItems) {
      updateItemAuto(ci.id, { status: "running" });
    }

    api
      .classify(classifyItems)
      .then((res) => {
        for (const r of res.results) {
          updateItemAuto(r.id, {
            status: "done",
            confidence: r.confidence,
            notes: r.notes,
            kind: r.kind,
          });
          // Apply auto-tags
          const store = useQueueStore.getState();
          const item = store.items.find((i) => i.id === r.id);
          if (item) {
            const tags: Partial<DJTags> = {};
            if (r.genre) tags.genre = r.genre;
            if (r.energy) tags.energy = r.energy;
            if (r.time) tags.time = r.time;
            if (r.vibe) tags.vibe = r.vibe;
            store.updateItemTags(r.id, tags);
          }
        }
      })
      .catch(() => {
        for (const ci of classifyItems) {
          updateItemAuto(ci.id, { status: "error" });
        }
      });
  }, [detectedUrls, addItems, updateItemAuto]);

  const handleStart = useCallback(async () => {
    const queued = items.filter((i) => i.status === "queued" || i.status === "error");
    if (queued.length === 0) {
      toast.warning("No items to process");
      return;
    }

    // Reset errored items
    for (const item of queued) {
      if (item.status === "error") {
        updateItemStatus(item.id, "queued");
      }
    }

    try {
      const res = await api.startQueue({
        inbox_dir: settings.inbox_dir,
        mode: settings.mode,
        audio_format: settings.audio_format,
        normalize_enabled: settings.normalize_enabled,
        loudness: settings.loudness,
        items: queued.map((i) => ({
          id: i.id,
          url: i.url,
          preset_snapshot: i.presetSnapshot,
        })),
      });
      setJobId(res.job_id);
      setRunning(true);
      toast.success("Queue started");
    } catch (e) {
      toast.error("Failed to start queue");
    }
  }, [items, settings, setJobId, setRunning, updateItemStatus]);

  const handleStop = useCallback(async () => {
    if (jobId) {
      await api.stopQueue(jobId).catch(() => {});
      setRunning(false);
      toast.info("Queue stopped");
    }
  }, [jobId, setRunning]);

  const handleRetry = useCallback(
    (id: string) => updateItemStatus(id, "queued"),
    [updateItemStatus]
  );

  // Progress stats
  const doneCount = items.filter((i) => i.status === "done").length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div className="flex gap-6">
      {/* Main column */}
      <div className="flex-1 min-w-0">
        <div className="rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-6 shadow-[var(--dc-shadow)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--dc-text)]">Queue</h1>
              <p className="mt-1 text-sm text-[var(--dc-muted)]">
                Paste YouTube links to download DJ-ready audio
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!running && (
                <button
                  onClick={handleAdd}
                  disabled={detectedUrls.length === 0}
                  className={clsx(
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    detectedUrls.length > 0
                      ? "bg-[var(--dc-accent)] text-white hover:opacity-90"
                      : "bg-[var(--dc-chip)] text-[var(--dc-muted2)] cursor-not-allowed"
                  )}
                >
                  Add ({detectedUrls.length})
                </button>
              )}
              {!running && items.some((i) => i.status === "queued" || i.status === "error") && (
                <button
                  onClick={handleStart}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
                >
                  Start
                </button>
              )}
              {running && (
                <button
                  onClick={handleStop}
                  className="rounded-xl bg-[var(--dc-danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                >
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* URL Input */}
          {!running && (
            <div className="mt-4">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste YouTube URLs here (one per line or space-separated)..."
                rows={3}
                className="w-full resize-none rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-4 py-3 text-sm text-[var(--dc-text)] placeholder-[var(--dc-muted2)] focus:border-[var(--dc-accent)] focus:ring-2 focus:ring-[var(--dc-accent-ring)] focus:outline-none transition"
              />
              {detectedUrls.length > 0 && (
                <p className="mt-1.5 text-xs text-[var(--dc-muted)]">
                  Detected: <span className="font-semibold text-[var(--dc-accent-text)]">{detectedUrls.length} URL{detectedUrls.length !== 1 ? "s" : ""}</span>
                </p>
              )}
            </div>
          )}

          {/* Global Progress */}
          {running && totalCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[var(--dc-muted)] mb-1.5">
                <span>Processing {doneCount} of {totalCount}</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--dc-chip)]">
                <div
                  className="h-full rounded-full bg-[var(--dc-accent)] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Queue Items */}
          <div className="mt-4 space-y-3">
            {items.length === 0 ? (
              <div className="dc-animate-fadeIn flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[color:var(--dc-border)] py-12">
                <svg className="h-12 w-12 text-[var(--dc-muted2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <h3 className="mt-4 text-sm font-semibold text-[var(--dc-text)]">No tracks in queue</h3>
                <p className="mt-1 text-xs text-[var(--dc-muted)]">Paste YouTube links above to get started</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <span className="rounded-full bg-[var(--dc-accent-bg)] px-3 py-1 text-[10px] font-medium text-[var(--dc-accent-text)]">Auto-tagged</span>
                  <span className="rounded-full bg-[var(--dc-success-bg)] px-3 py-1 text-[10px] font-medium text-[var(--dc-success-text)]">DJ-Safe defaults</span>
                  <span className="rounded-full bg-[var(--dc-chip)] px-3 py-1 text-[10px] font-medium text-[var(--dc-muted)]">Rekordbox-ready</span>
                </div>
              </div>
            ) : (
              items.map((item) => (
                <QueueItemRow
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onRetry={() => handleRetry(item.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block w-[320px] shrink-0">
        <div className="sticky top-24 space-y-4">
          {/* Auto Tagging */}
          <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--dc-text)]">Auto Tagging</h3>
              <span className="rounded-full bg-[var(--dc-accent-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-accent-text)]">
                Automatic
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--dc-muted)]">
              Each URL is auto-classified for genre, energy, time, and vibe from YouTube metadata.
            </p>
          </div>

          {/* Output */}
          <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--dc-text)]">Output</h3>
            <p className="mt-1.5 truncate text-xs text-[var(--dc-muted)] font-mono">
              {settings.inbox_dir}
            </p>
          </div>

          {/* Mode */}
          <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--dc-text)]">Mode</h3>
            <p className="mt-1.5 text-xs text-[var(--dc-muted)]">
              {settings.mode === "dj-safe" ? "DJ-Safe (full processing)" : "Fast (quick download)"}
            </p>
          </div>

          {/* Tip */}
          <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] p-4">
            <p className="text-xs text-[var(--dc-muted)]">
              <span className="font-semibold text-[var(--dc-text)]">Tip:</span> Paste up to 10 YouTube links at once.
              Files are auto-tagged, loudness-normalized, and ready for Rekordbox import.
            </p>
          </div>

          {/* Job ID */}
          {jobId && (
            <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--dc-text)]">Job ID</h3>
              <p className="mt-1 font-mono text-xs text-[var(--dc-muted)]">{jobId}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
