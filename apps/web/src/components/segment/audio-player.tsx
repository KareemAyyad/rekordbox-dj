"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { Waveform } from "./waveform";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Custom event to stop all other audio players when one starts. */
const STOP_EVENT = "dc-stop-audio";

interface AudioPlayerProps {
  label: string;
  audioUrl: string;
  residualUrl?: string;
  downloadUrl: string;
  durationSeconds: number;
  compact?: boolean;
}

export function AudioPlayer({
  label,
  audioUrl,
  residualUrl,
  downloadUrl,
  durationSeconds,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [volume, setVolume] = useState(0.8);
  const [showResidual, setShowResidual] = useState(false);

  const activeUrl = showResidual && residualUrl ? residualUrl : audioUrl;
  const activeDownload = showResidual && residualUrl
    ? residualUrl.replace("/stream/", "/download/")
    : downloadUrl;

  // Listen for stop events from other players
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (audioRef.current && audioRef.current !== detail.except) {
        audioRef.current.pause();
        setPlaying(false);
      }
    };
    window.addEventListener(STOP_EVENT, handler);
    return () => window.removeEventListener(STOP_EVENT, handler);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  // When switching between target/residual, reset playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlaying(false);
    setCurrentTime(0);
    audio.load();
  }, [activeUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      // Stop all other players first
      window.dispatchEvent(new CustomEvent(STOP_EVENT, { detail: { except: audio } }));
      audio.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const changeVolume = useCallback((val: number) => {
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  }, []);

  return (
    <div className={clsx(
      "dc-animate-fadeIn rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] shadow-sm hover:shadow-md transition",
      compact ? "p-3" : "p-4",
    )}>
      <audio ref={audioRef} src={activeUrl} preload="metadata" />

      {/* Header: label + toggle + download */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className={clsx("font-semibold text-[var(--dc-text)] min-w-0 truncate", compact ? "text-xs" : "text-sm")}>
          {label}
          {showResidual && <span className="ml-1.5 text-[10px] font-normal text-[var(--dc-muted)]">(residual)</span>}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {residualUrl && (
            <button
              onClick={() => setShowResidual(!showResidual)}
              className={clsx(
                "rounded-lg px-2 py-1 text-[10px] font-medium transition",
                showResidual
                  ? "bg-[var(--dc-accent-bg)] text-[var(--dc-accent-text)]"
                  : "bg-[var(--dc-chip)] text-[var(--dc-muted)] hover:bg-[var(--dc-chip-strong)]",
              )}
              title={showResidual ? "Listening to everything EXCEPT this sound" : "Switch to hear everything EXCEPT this sound"}
            >
              {showResidual ? "Target" : "Residual"}
            </button>
          )}
          <a
            href={activeDownload}
            download
            className="rounded-lg bg-[var(--dc-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition"
          >
            Download
          </a>
        </div>
      </div>

      {/* Waveform */}
      <Waveform
        audioUrl={activeUrl}
        currentTime={currentTime}
        duration={duration}
        onSeek={seek}
      />

      {/* Controls */}
      <div className="flex items-center gap-3 mt-3">
        {/* Play/Pause */}
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dc-accent)] text-white hover:opacity-90 transition"
        >
          {playing ? (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time */}
        <span className="text-xs font-mono text-[var(--dc-muted)] tabular-nums min-w-[70px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Volume */}
        <div className="flex items-center gap-1.5 ml-auto">
          <svg className="h-3.5 w-3.5 text-[var(--dc-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494m0-11.494a1 1 0 00-1.414 0L7.172 9.668H4a1 1 0 00-1 1v2.664a1 1 0 001 1h3.172l3.414 3.414A1 1 0 0012 17.747V6.253z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="w-16 h-1 accent-[var(--dc-accent)]"
          />
        </div>
      </div>
    </div>
  );
}
