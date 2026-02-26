"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { useSegmentStore } from "@/stores/segment-store";
import { useSegmentSSE } from "@/hooks/use-segment-sse";
import { api } from "@/lib/api-client";
import { SEGMENT_CATEGORIES } from "@/lib/constants";
import { AudioPlayer } from "@/components/segment/audio-player";

/* ---------- Upload Zone ---------- */

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
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
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition cursor-pointer",
        dragging
          ? "border-[var(--dc-accent)] bg-[var(--dc-accent-bg)]"
          : "border-[var(--dc-border)] hover:border-[var(--dc-accent)] hover:bg-[var(--dc-accent-bg)]"
      )}
    >
      <svg className="h-12 w-12 text-[var(--dc-muted2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--dc-text)]">Drop your audio file here</p>
        <p className="text-xs text-[var(--dc-muted)] mt-1">WAV, MP3, FLAC, AIFF, OGG, M4A &bull; Max 200 MB</p>
      </div>
    </div>
  );
}

/* ---------- Progress Bar ---------- */

function ProgressBar() {
  const progress = useSegmentStore((s) => s.progress);
  const modelLoading = useSegmentStore((s) => s.modelLoading);

  if (!progress) return null;

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="dc-animate-fadeIn rounded-2xl border border-[color:var(--dc-accent-border)] bg-[var(--dc-accent-bg)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--dc-text)]">
          {modelLoading ? "Loading AI model..." : `Separating: ${progress.label}`}
        </span>
        {progress.total > 0 && (
          <span className="text-xs font-mono text-[var(--dc-muted)]">
            {progress.current}/{progress.total}
          </span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--dc-chip)]">
        <div
          className="h-2 rounded-full bg-[var(--dc-accent)] transition-all duration-500"
          style={{ width: modelLoading ? "10%" : `${pct}%` }}
        />
      </div>
      {modelLoading && (
        <p className="text-xs text-[var(--dc-muted)] mt-2">
          First run downloads the model (~2 GB). Subsequent runs are instant.
        </p>
      )}
    </div>
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
    <div className="rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-[var(--dc-muted)] hover:bg-[var(--dc-chip)] transition"
      >
        <span>Advanced Parameters</span>
        <svg className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="dc-animate-fadeIn grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pb-4">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--dc-muted)]">Guidance Scale</span>
            <input
              type="number"
              min={0} max={20} step={0.5}
              value={guidanceScale}
              onChange={(e) => onChange("guidanceScale", Number(e.target.value))}
              className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--dc-muted)]">Steps</span>
            <input
              type="number"
              min={1} max={100}
              value={numSteps}
              onChange={(e) => onChange("numSteps", Number(e.target.value))}
              className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--dc-muted)]">Reranking</span>
            <input
              type="number"
              min={1} max={8}
              value={rerankingCandidates}
              onChange={(e) => onChange("rerankingCandidates", Number(e.target.value))}
              className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-sm text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none"
            />
          </label>
        </div>
      )}
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

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const sess = await api.uploadAudio(file);
      setSession(sess);
      toast.success(`Uploaded: ${sess.filename}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }, [setSession, setError]);

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
      api.deleteSegmentSession(session.id).catch(() => {});
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
    <div className="space-y-6">
      <div className="rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-6 shadow-[var(--dc-shadow)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--dc-text)]">Segment</h1>
            <p className="mt-1 text-sm text-[var(--dc-muted)]">
              Isolate any sound from your track using AI
            </p>
          </div>
          {session && (
            <button
              onClick={handleNewFile}
              disabled={processing}
              className="rounded-xl bg-[var(--dc-chip)] px-3 py-1.5 text-xs font-medium text-[var(--dc-muted)] hover:bg-[var(--dc-chip-strong)] transition disabled:opacity-50"
            >
              New File
            </button>
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
              <UploadZone onUpload={handleUpload} />
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
                  {/* Selectable category badges */}
                  <div className="flex flex-wrap gap-2">
                    {SEGMENT_CATEGORIES.map((cat) => {
                      const selected = selectedCats.has(cat.label);
                      return (
                        <button
                          key={cat.label}
                          onClick={() => toggleCategory(cat.label)}
                          disabled={processing}
                          className={clsx(
                            "rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50",
                            selected
                              ? "bg-[var(--dc-accent)] text-white"
                              : "bg-[var(--dc-chip)] text-[var(--dc-muted)] hover:bg-[var(--dc-chip-strong)]"
                          )}
                          title={cat.desc}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleAutoSegment}
                    disabled={processing}
                    className="w-full rounded-xl bg-[var(--dc-accent)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 dc-animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Segmenting...
                      </span>
                    ) : (
                      `Auto-Segment into ${selectedCats.size} Sound${selectedCats.size !== 1 ? "s" : ""}`
                    )}
                  </button>
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

      {/* Separated Sounds */}
      {segments.length > 0 && (
        <div className="rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-6 shadow-[var(--dc-shadow)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--dc-text)]">Separated Sounds</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--dc-accent-bg)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--dc-accent-text)]">
                {segments.length} sound{segments.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="space-y-3">
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
        </div>
      )}
    </div>
  );
}
