"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { Sparkles, Trash2, ShieldAlert, MonitorUp, Zap, RadioTower, CheckCircle2, Loader2, AlertCircle, Play, Music, Clock, Disc3 } from "lucide-react";
import { useQueueStore } from "@/stores/queue-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSSE } from "@/hooks/use-sse";
import { api } from "@/lib/api-client";
import { extractYouTubeUrls } from "@/lib/url-parser";
import { STAGE_LABELS } from "@/lib/constants";
import type { QueueItem, DJTags } from "@/lib/types";

function StatusPill({ status }: { status: QueueItem["status"] }) {
  const styles = {
    queued: "bg-[var(--dc-chip)] text-[var(--dc-muted)] border-[var(--dc-border)]",
    running: "bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)] border-[color:var(--dc-accent-border)] shadow-[0_0_15px_var(--dc-accent-ring)]",
    done: "bg-[var(--dc-success-bg)] text-[var(--dc-success-text)] border-[color:var(--dc-success-border)] shadow-[0_0_10px_var(--dc-success-bg)]",
    error: "bg-[var(--dc-danger-bg)] text-[var(--dc-danger-text)] border-[color:var(--dc-danger-border)]",
  };
  const labels = { queued: "Queued", running: "Processing", done: "Ready", error: "Error" };
  const icons = {
    queued: <Clock className="w-3 h-3" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    done: <CheckCircle2 className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />
  };

  return (
    <div className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md transition-all duration-300", styles[status])}>
      {icons[status]}
      {labels[status]}
    </div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 30, rotateX: -10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    transition: { type: "spring", stiffness: 450, damping: 25, mass: 1 }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -20,
    filter: "blur(10px)",
    transition: { duration: 0.3, ease: "anticipate" }
  }
};

function QueueItemRow({ item, onRemove, onRetry }: {
  item: QueueItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const stage = item.auto?.stage;
  const isRunning = item.status === "running";

  return (
    <motion.li
      variants={itemVariants}
      layout="position"
      className="relative group list-none"
    >
      {/* Animated Gradient Border for Running State */}
      {isRunning && (
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--dc-accent)] via-[#c084fc] to-[var(--dc-accent)] opacity-50 blur-[4px] animate-[dc-shimmer_2s_linear_infinite] z-0" />
      )}

      <div className={clsx(
        "relative flex items-start justify-between gap-4 p-5 rounded-2xl transition-all duration-300 z-10",
        isRunning ? "dc-glass-strong border-transparent" : "dc-glass hover:dc-glass-strong"
      )}>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <h4 className="truncate text-sm font-semibold text-[var(--dc-text)] leading-tight">{item.url}</h4>
            {item.auto?.status === "done" && item.auto.confidence && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--dc-chip)] border border-[var(--dc-border)]">
                <Sparkles className="w-3 h-3 text-[var(--dc-warning)]" />
                <span className="text-[10px] font-bold text-[var(--dc-muted)]">{Math.round(item.auto.confidence * 100)}%</span>
              </div>
            )}
          </div>

          {stage && isRunning && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 w-full max-w-[120px] bg-[var(--dc-chip-strong)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--dc-accent)] w-full w-full animate-[dc-shimmer_1s_ease-in-out_infinite]"
                  style={{ backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--dc-accent) 0%, #c084fc 50%, var(--dc-accent) 100%)' }} />
              </div>
              <p className="text-[10px] font-bold text-[var(--dc-accent-text)] uppercase tracking-widest">
                {STAGE_LABELS[stage] || stage}
              </p>
            </div>
          )}

          {item.message && item.status === "error" && (
            <p className="mt-2 text-xs text-[var(--dc-danger-text)] flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-4 h-4" /> {item.message}
            </p>
          )}

          {/* Tag badges - V2 Style */}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.presetSnapshot.genre && item.presetSnapshot.genre !== "Other" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--dc-chip)] px-2.5 py-1 text-[10px] font-bold text-[var(--dc-text)] border border-[var(--dc-border)]">
                <Disc3 className="w-3 h-3 text-[var(--dc-accent-text)]" /> {item.presetSnapshot.genre}
              </span>
            )}
            {item.presetSnapshot.energy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--dc-chip)] px-2.5 py-1 text-[10px] font-bold text-[var(--dc-text)] border border-[var(--dc-border)]">
                <Zap className="w-3 h-3 text-[var(--dc-warning-text)]" /> {item.presetSnapshot.energy}
              </span>
            )}
            {item.presetSnapshot.time && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--dc-chip)] px-2.5 py-1 text-[10px] font-bold text-[var(--dc-text)] border border-[var(--dc-border)]">
                <Clock className="w-3 h-3 text-[var(--dc-success-text)]" /> {item.presetSnapshot.time}
              </span>
            )}
            {item.presetSnapshot.vibe && (
              <span className="inline-flex items-center gap-1 bg-transparent px-2 py-1 text-[10px] font-medium text-[var(--dc-muted)] uppercase tracking-wider">
                {item.presetSnapshot.vibe}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 justify-between h-full">
          <StatusPill status={item.status} />
          <div className="flex items-center gap-2 mt-auto">
            {item.status === "error" && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRetry}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--dc-accent-text)] bg-[var(--dc-accent-bg)] border border-[var(--dc-accent-border)] transition-colors hover:bg-[var(--dc-accent)] hover:text-white"
              >
                Retry
              </motion.button>
            )}
            {(item.status === "queued" || item.status === "error") && (
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onRemove}
                className="rounded-full p-1.5 text-[var(--dc-muted)] hover:text-[var(--dc-danger)] hover:bg-[var(--dc-danger-bg)] transition-colors"
                title="Remove"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.li>
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
    api.getSettings().then((s) => useSettingsStore.getState().setSettings(s)).catch(() => { });
  }, []);

  // SSE connection
  useSSE(jobId);

  const detectedUrls = extractYouTubeUrls(inputText);

  // Auto-start pipeline when URLs are detected
  useEffect(() => {
    if (detectedUrls.length === 0 || running) return;

    const autoStart = async () => {
      console.log("[Queue] Auto-start triggered. Detected URLs:", detectedUrls);
      // 1. Add to Queue
      const defaults: DJTags = { genre: "Other", energy: "", time: "", vibe: "" };
      addItems(detectedUrls, defaults);
      setInputText("");
      console.log("[Queue] Items added to store. Clearing input.");

      // 2. Auto-classify
      const state = useQueueStore.getState();
      const newItems = state.items.slice(-detectedUrls.length);
      const classifyItems = newItems.map((i) => ({ id: i.id, url: i.url }));
      console.log("[Queue] Starting AI classification for", classifyItems.length, "items");

      for (const ci of classifyItems) {
        updateItemAuto(ci.id, { status: "running" });
      }

      // Fire and forget classification
      api.classify(classifyItems).then((res) => {
        console.log("[Queue] Classification response:", res);
        for (const r of res.results) {
          updateItemAuto(r.id, {
            status: "done",
            confidence: r.confidence,
            notes: r.notes,
            kind: r.kind,
          });
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
      }).catch((err) => {
        console.error("[Queue] Classification failed:", err);
        for (const ci of classifyItems) {
          updateItemAuto(ci.id, { status: "error" });
        }
      });

      // 3. Immediately Start Engine
      const currentState = useQueueStore.getState();
      const queued = currentState.items.filter((i) => i.status === "queued" || i.status === "error");
      console.log("[Queue] Starting engine with", queued.length, "queued items");

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
        console.log("[Queue] Engine started! Job ID:", res.job_id);
        toast.success("Extraction engine started");
      } catch (e) {
        console.error("[Queue] Engine start FAILED:", e);
        toast.error("Failed to start engine automatically");
      }
    };

    autoStart();

  }, [detectedUrls, running, addItems, updateItemAuto, settings, setJobId, setRunning]);


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
      await api.stopQueue(jobId).catch(() => { });
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

  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">

        {/* Massive Glowing Input Area */}
        {!running && (
          <motion.div
            layout
            className="relative w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className={clsx(
              "absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-[var(--dc-accent)] via-[#c084fc] to-[var(--dc-accent)] opacity-20 blur-xl transition-all duration-700",
              isFocused ? "opacity-40 blur-2xl animate-[dc-shimmer_3s_linear_infinite]" : "opacity-20"
            )} />

            <div className={clsx(
              "relative dc-glass-strong rounded-[2rem] overflow-hidden transition-all duration-500",
              isFocused ? "border-[var(--dc-accent-light)] shadow-[0_0_30px_var(--dc-accent-bg)]" : ""
            )}>
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Paste YouTube URLs here..."
                rows={Math.max(3, Math.min(6, inputText.split('\n').length))}
                className="w-full resize-none bg-transparent px-8 py-8 text-lg text-[var(--dc-text)] placeholder-[var(--dc-muted2)] focus:outline-none transition-all placeholder:text-xl font-medium"
              />

              <div className="px-6 py-4 border-t border-[var(--dc-border)] bg-[rgba(0,0,0,0.2)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {detectedUrls.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-[var(--dc-accent)] animate-spin" />
                      <span className="text-sm font-semibold text-[var(--dc-accent-text)] tracking-wider uppercase">Auto-Starting Engine...</span>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-[var(--dc-muted)] uppercase tracking-widest flex items-center gap-1.5"><Music className="w-4 h-4" /> Drop tracks to begin</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Bar (When items exist) */}
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center justify-between px-2"
          >
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--dc-text)] flex items-center gap-2">
                Queue <span className="text-[var(--dc-muted)] text-lg">({items.length})</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {!running && items.some((i) => i.status === "queued" || i.status === "error") && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStart}
                  className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 px-8 py-3 text-sm font-extrabold text-[#022c22] uppercase tracking-widest hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" /> Resume Engine
                </motion.button>
              )}
              {running && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStop}
                  className="rounded-full bg-[var(--dc-danger-bg)] border border-[var(--dc-danger-border)] px-6 py-3 text-sm font-bold text-[var(--dc-danger-text)] uppercase tracking-wider hover:bg-[var(--dc-danger)] hover:text-white transition-all"
                >
                  Emergency Stop
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Global Progress */}
        <AnimatePresence>
          {running && totalCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="dc-glass-strong rounded-2xl p-5 overflow-hidden relative"
            >
              <div className="flex items-center justify-between text-xs text-[var(--dc-muted)] mb-2 font-bold tracking-widest uppercase">
                <span>System Processing {doneCount} of {totalCount}</span>
                <span className="text-[var(--dc-accent-light)]">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[rgba(0,0,0,0.5)] overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[var(--dc-accent)] to-[#c084fc]"
                  initial={{ width: 0 }}
                  animate={{ width: progress + "%" }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Queue Items List */}
        <motion.ul
          className="flex flex-col gap-4 pb-12"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } }
          }}
        >
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-[var(--dc-border-strong)] bg-[rgba(0,0,0,0.1)] py-20 px-8 text-center"
              >
                <div className="relative mb-6">
                  <div className="absolute -inset-4 bg-[var(--dc-accent)] opacity-20 blur-2xl rounded-full" />
                  <div className="h-16 w-16 rounded-full dc-glass-strong flex items-center justify-center relative">
                    <Disc3 className="h-8 w-8 text-[var(--dc-accent-light)] animate-[dc-spin_4s_linear_infinite]" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-[var(--dc-text)]">Engine Idle</h3>
                <p className="mt-2 text-sm text-[var(--dc-muted)] max-w-sm">Paste YouTube links in the portal above. The engine will automatically classify, normalize, and export DJ-ready tracks.</p>
              </motion.div>
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
          </AnimatePresence>
        </motion.ul>
      </div>

      {/* Fixed Sidebar */}
      <div className="hidden lg:block w-[320px] shrink-0">
        <div className="sticky top-28 space-y-4">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="dc-glass rounded-2xl p-5 hover:dc-glass-strong transition-all">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[var(--dc-accent)]" />
              <h3 className="text-xs font-black tracking-widest text-[var(--dc-text)] uppercase">AI Tagging Active</h3>
            </div>
            <p className="text-xs text-[var(--dc-muted)] leading-relaxed">
              DropCrate Engine intercepts URLs and uses cloud inference to classify <span className="text-[var(--dc-text)] font-semibold">genre, energy, and vibe</span> before downloading.
            </p>
          </motion.div>

          {/* ... keeping other sidebar items clean & minimal */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="dc-glass rounded-2xl p-5 hover:dc-glass-strong transition-all">
            <h3 className="text-xs font-black tracking-widest text-[var(--dc-text)] uppercase mb-2">Output Dir</h3>
            <p className="truncate text-xs text-[var(--dc-accent-light)] font-mono bg-[rgba(0,0,0,0.3)] px-2 py-1 rounded inline-block">
              {settings.inbox_dir}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="dc-glass rounded-2xl p-5 hover:dc-glass-strong transition-all">
            <h3 className="text-xs font-black tracking-widest text-[var(--dc-text)] uppercase mb-2">Mode</h3>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--dc-chip)] border border-[var(--dc-border)]">
              <div className="w-2 h-2 rounded-full bg-[var(--dc-success-text)] shadow-[0_0_8px_var(--dc-success-text)] animate-pulse" />
              <span className="text-[10px] font-bold text-[var(--dc-text)] uppercase">{settings.mode === "dj-safe" ? "DJ-Safe (Full Engine)" : "Fast DL"}</span>
            </div>
          </motion.div>

          {jobId && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="dc-glass rounded-2xl p-4 border border-[var(--dc-accent-border)] bg-[rgba(0,0,0,0.4)]">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-[var(--dc-muted)]">Active Job ID</h3>
              <p className="mt-1 font-mono text-[10px] text-[var(--dc-accent-light)] break-all">{jobId}</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
