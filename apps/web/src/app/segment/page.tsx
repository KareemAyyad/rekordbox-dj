"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Wand2, Sparkles, SlidersHorizontal, Layers, ChevronDown } from "lucide-react";
import { useSegmentStore } from "@/stores/segment-store";
import { useSegmentSSE } from "@/hooks/use-segment-sse";
import { api } from "@/lib/api-client";
import { SEGMENT_CATEGORIES } from "@/lib/constants";
import { AudioPlayer } from "@/components/segment/audio-player";

/* ---------- Upload Zone ---------- */

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onUpload(f); }}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.onchange = () => { if (input.files?.[0]) onUpload(input.files[0]); };
        input.click();
      }}
      className={clsx(
        "relative flex flex-col items-center justify-center gap-4 rounded-[2rem] border-2 border-dashed p-16 transition-all duration-300 cursor-pointer overflow-hidden",
        dragging
          ? "border-[var(--dc-accent-light)] shadow-[0_0_30px_var(--dc-accent-bg)] bg-[var(--dc-accent-bg)]"
          : "border-[var(--dc-border-strong)] bg-[rgba(0,0,0,0.2)] hover:border-[var(--dc-accent)] hover:bg-[rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_var(--dc-accent-bg)]"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--dc-accent)] opacity-[0.03] pointer-events-none" />
      <div className={clsx("p-4 rounded-full transition-colors duration-300 relative z-10", dragging ? "bg-[var(--dc-accent)] text-white" : "bg-[var(--dc-chip-strong)] text-[var(--dc-accent)] group-hover:bg-[var(--dc-accent)] group-hover:text-white")}>
        <UploadCloud className="w-8 h-8" />
      </div>
      <div className="text-center relative z-10">
        <p className="text-lg font-bold tracking-tight text-[var(--dc-text)]">Drop audio file here</p>
        <p className="text-xs font-medium text-[var(--dc-muted)] mt-2">WAV, MP3, FLAC, AIFF &bull; Max 200MB</p>
      </div>
    </motion.div>
  );
}

/* ---------- Progress Bar ---------- */

function ProgressBar() {
  const progress = useSegmentStore((s) => s.progress);
  const modelLoading = useSegmentStore((s) => s.modelLoading);

  if (!progress) return null;

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="dc-glass relative overflow-hidden rounded-2xl border border-[var(--dc-accent-border)] p-5"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--dc-accent)] to-[#c084fc] opacity-10 pointer-events-none" />
      <div className="relative z-10 flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--dc-accent-light)] flex items-center gap-2">
          {modelLoading ? <><Layers className="w-3.5 h-3.5 animate-pulse" /> Loading AI Model...</> : <><Sparkles className="w-3.5 h-3.5 animate-pulse" /> Separating: {progress.label}</>}
        </span>
        {progress.total > 0 && (
          <span className="text-xs font-bold font-mono text-[var(--dc-text)]">
            {progress.current} <span className="text-[var(--dc-muted)]">/ {progress.total}</span>
          </span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-[rgba(0,0,0,0.5)] overflow-hidden relative z-10">
        <motion.div
          className="h-full bg-gradient-to-r from-[var(--dc-accent)] to-[var(--dc-accent-light)] animate-[dc-shimmer_2s_linear_infinite]"
          initial={{ width: 0 }}
          animate={{ width: modelLoading ? "10%" : `${pct}%` }}
          style={{ backgroundSize: '200% 100%' }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      {modelLoading && (
        <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--dc-muted)] mt-3">
          First run downloads the inference weights (~2 GB). Subsequent runs are instant.
        </p>
      )}
    </motion.div>
  );
}

/* ---------- Advanced Parameters ---------- */

function AdvancedParams({
  guidanceScale,
  numSteps,
  rerankingCandidates,
  onChange,
}: {
  guidanceScale: number;
  numSteps: number;
  rerankingCandidates: number;
  onChange: (key: string, val: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--dc-border)] bg-[rgba(0,0,0,0.2)] overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[var(--dc-muted)] hover:text-[var(--dc-text)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <span className="flex items-center gap-2"><SlidersHorizontal className="w-3.5 h-3.5" /> Engine Parameters</span>
        <ChevronDown className={clsx("w-4 h-4 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-5 px-5 pb-5 border-t border-[rgba(255,255,255,0.05)] pt-4"
          >
            <label className="space-y-1.5 flex flex-col">
              <span className="text-[10px] font-black tracking-widest uppercase text-[var(--dc-muted)]">Guidance Scale</span>
              <input type="number" min={0} max={20} step={0.5} value={guidanceScale} onChange={(e) => onChange("guidanceScale", Number(e.target.value))} className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-input)] px-4 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--dc-accent)] transition-shadow" />
            </label>
            <label className="space-y-1.5 flex flex-col">
              <span className="text-[10px] font-black tracking-widest uppercase text-[var(--dc-muted)]">Inference Steps</span>
              <input type="number" min={1} max={100} value={numSteps} onChange={(e) => onChange("numSteps", Number(e.target.value))} className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-input)] px-4 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--dc-accent)] transition-shadow" />
            </label>
            <label className="space-y-1.5 flex flex-col">
              <span className="text-[10px] font-black tracking-widest uppercase text-[var(--dc-muted)]">Reranking</span>
              <input type="number" min={1} max={8} value={rerankingCandidates} onChange={(e) => onChange("rerankingCandidates", Number(e.target.value))} className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-input)] px-4 py-2 text-sm font-mono text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--dc-accent)] transition-shadow" />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function SegmentPage() {
  const session = useSegmentStore((s) => s.session);
  const segments = useSegmentStore((s) => s.segments);
  const mode = useSegmentStore((s) => s.mode);
  const processing = useSegmentStore((s) => s.processing);
  const error = useSegmentStore((s) => s.error);
  const jobId = useSegmentStore((s) => s.jobId);
  const setSession = useSegmentStore((s) => s.setSession);
  const setMode = useSegmentStore((s) => s.setMode);
  const setProcessing = useSegmentStore((s) => s.setProcessing);
  const setError = useSegmentStore((s) => s.setError);
  const setJobId = useSegmentStore((s) => s.setJobId);
  const addSegment = useSegmentStore((s) => s.addSegment);

  const [prompt, setPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [guidanceScale, setGuidanceScale] = useState(3.0);
  const [numSteps, setNumSteps] = useState(16);
  const [rerankingCandidates, setRerankingCandidates] = useState(1);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () => new Set(SEGMENT_CATEGORIES.map((c) => c.label))
  );

  // SSE for auto-segment progress
  useSegmentSSE(jobId);

  const handleUploadAndSegment = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    let sessionRes;

    // 1. Upload File
    try {
      sessionRes = await api.uploadAudio(file);
      setSession(sessionRes);
      toast.success(`Uploaded: ${sessionRes.filename}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      toast.error(msg);
      setUploading(false);
      return;
    }

    setUploading(false);

    // 2. Automatically Start Segmentation (Default to all categories)
    setProcessing(true);
    setError(null);
    try {
      const res = await api.autoSegment({
        session_id: sessionRes.id,
        categories: undefined, // undefined = use all defaults on backend
        guidance_scale: guidanceScale,
        num_steps: numSteps,
        reranking_candidates: rerankingCandidates,
      });
      setJobId(res.job_id);
      toast.success("Stem separation started");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Auto-segment failed";
      setError(msg);
      toast.error(msg);
      setProcessing(false);
    }
  }, [setSession, setError, guidanceScale, numSteps, rerankingCandidates, setJobId, setProcessing]);

  const handleDescribe = useCallback(async () => {
    if (!session || !prompt.trim()) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await api.separateAudio({
        session_id: session.id,
        prompt: prompt.trim(),
        guidance_scale: guidanceScale,
        num_steps: numSteps,
        reranking_candidates: rerankingCandidates,
      });
      addSegment(res.segment);
      toast.success(`Isolated: ${prompt.trim()}`);
      setPrompt("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Separation failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }, [session, prompt, guidanceScale, numSteps, rerankingCandidates, addSegment, setProcessing, setError]);

  const handleAutoSegment = useCallback(async () => {
    if (!session) return;
    setProcessing(true); // <-- immediately prevent double-click
    setError(null);
    try {
      const cats = selectedCats.size < SEGMENT_CATEGORIES.length
        ? Array.from(selectedCats)
        : undefined; // undefined = use all defaults on backend
      const res = await api.autoSegment({
        session_id: session.id,
        categories: cats,
        guidance_scale: guidanceScale,
        num_steps: numSteps,
        reranking_candidates: rerankingCandidates,
      });
      setJobId(res.job_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Auto-segment failed";
      setError(msg);
      toast.error(msg);
      setProcessing(false); // only reset on error since SSE handles success
    }
  }, [session, selectedCats, guidanceScale, numSteps, rerankingCandidates, setJobId, setError, setProcessing]);

  const handleNewFile = useCallback(() => {
    if (session) {
      api.deleteSegmentSession(session.id).catch(() => { });
    }
    useSegmentStore.getState().reset();
  }, [session]);

  const handleParamChange = (key: string, val: number) => {
    if (key === "guidanceScale") setGuidanceScale(val);
    if (key === "numSteps") setNumSteps(val);
    if (key === "rerankingCandidates") setRerankingCandidates(val);
  };

  const toggleCategory = (label: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        if (next.size > 1) next.delete(label); // keep at least one
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 relative overflow-hidden shadow-2xl">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--dc-accent)] opacity-[0.05] blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--dc-text)] flex items-center gap-3">
              <Wand2 className="w-6 h-6 text-[var(--dc-accent)]" />
              Stem Splitter
            </h1>
            <p className="mt-2 text-sm font-medium text-[var(--dc-muted)]">
              Isolate vocals, instrumental, or any specific sound using AI inference.
            </p>
          </div>
          {session && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNewFile}
              disabled={processing}
              className="rounded-xl border border-[var(--dc-border)] bg-[var(--dc-chip)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--dc-text)] hover:bg-[var(--dc-chip-strong)] transition-colors disabled:opacity-50 shadow-sm"
            >
              New Source
            </motion.button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="dc-animate-fadeIn mt-4 rounded-2xl border border-[color:var(--dc-danger-border)] bg-[var(--dc-danger-bg)] px-4 py-3">
            <p className="text-sm text-[var(--dc-danger-text)]">{error}</p>
          </div>
        )}

        {/* Upload or Session */}
        <div className="mt-6">
          {!session ? (
            uploading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 dc-animate-spin rounded-full border-2 border-[var(--dc-accent)] border-t-transparent" />
                <p className="mt-3 text-sm text-[var(--dc-muted)]">Uploading...</p>
              </div>
            ) : (
              <UploadZone onUpload={handleUploadAndSegment} />
            )
          ) : (
            <div className="space-y-4">
              {/* Original track — full AudioPlayer so user can listen */}
              <AudioPlayer
                label={`Original: ${session.filename}`}
                audioUrl={`/api/segment/original/${session.id}`}
                downloadUrl={`/api/segment/original/${session.id}`}
                durationSeconds={session.durationSeconds}
              />

              {/* Mode toggle */}
              <div className="flex gap-2 rounded-2xl bg-[var(--dc-card2)] p-1">
                <button
                  onClick={() => setMode("describe")}
                  className={clsx(
                    "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    mode === "describe"
                      ? "bg-[var(--dc-chip-strong)] text-[var(--dc-text)] shadow-sm"
                      : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]"
                  )}
                >
                  Describe &amp; Extract
                </button>
                <button
                  onClick={() => setMode("auto")}
                  className={clsx(
                    "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    mode === "auto"
                      ? "bg-[var(--dc-chip-strong)] text-[var(--dc-text)] shadow-sm"
                      : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]"
                  )}
                >
                  Auto-Segment All
                </button>
              </div>

              {/* Mode content */}
              {mode === "describe" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder='Describe the sound: "vocals", "bass line", "hi-hats"...'
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDescribe()}
                    disabled={processing}
                    className="flex-1 rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-4 py-2.5 text-sm text-[var(--dc-text)] placeholder-[var(--dc-muted2)] focus:border-[var(--dc-accent)] focus:ring-2 focus:ring-[var(--dc-accent-ring)] focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleDescribe}
                    disabled={processing || !prompt.trim()}
                    className="shrink-0 rounded-xl bg-[var(--dc-accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 dc-animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Separating...
                      </span>
                    ) : (
                      "Extract"
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 opacity-50 pointer-events-none">
                    {SEGMENT_CATEGORIES.map((cat) => (
                      <div
                        key={cat.label}
                        className="rounded-full px-3 py-1 text-xs font-medium bg-[var(--dc-accent)] text-white"
                      >
                        {cat.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              <ProgressBar />

              {/* Advanced params */}
              <AdvancedParams
                guidanceScale={guidanceScale}
                numSteps={numSteps}
                rerankingCandidates={rerankingCandidates}
                onChange={handleParamChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Separated Sounds Vault */}
      <AnimatePresence>
        {segments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="dc-glass rounded-[2rem] p-6 lg:p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--dc-text)] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--dc-accent-light)]" />
                Isolated Stems
              </h2>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[var(--dc-border)]">
                <span className="flex h-2 w-2 rounded-full bg-[var(--dc-accent-light)] shadow-[0_0_8px_var(--dc-accent-light)] animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--dc-accent-light)]">
                  {segments.length} Ready
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {segments.map((seg) => (
                <AudioPlayer
                  key={seg.id}
                  label={seg.label}
                  audioUrl={seg.targetUrl}
                  residualUrl={seg.residualUrl}
                  downloadUrl={seg.targetUrl.replace("/stream/", "/download/")}
                  durationSeconds={seg.durationSeconds}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
