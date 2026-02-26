"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, Download, Minimize2, Maximize2 } from "lucide-react";
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
    <motion.div
      layout
      className={clsx(
        "dc-animate-fadeIn rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-card)] shadow-lg hover:shadow-xl hover:border-[var(--dc-border-strong)] transition-all duration-300 backdrop-blur-xl",
        compact ? "p-4" : "p-5"
      )}
    >
      <audio ref={audioRef} src={activeUrl} preload="metadata" />

      {/* Header: label + toggle + download */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={clsx("h-2 w-2 rounded-full", playing ? "bg-[var(--dc-accent-light)] shadow-[0_0_8px_var(--dc-accent-light)] animate-pulse" : "bg-[var(--dc-chip-strong)]")} />
          <h3 className={clsx("font-bold text-[var(--dc-text)] min-w-0 truncate tracking-tight", compact ? "text-xs" : "text-sm")}>
            {label}
          </h3>
          {showResidual && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[var(--dc-warning-bg)] border border-[var(--dc-warning-border)] text-[10px] font-bold text-[var(--dc-warning-text)] uppercase tracking-wider">
              Residual Layer
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {residualUrl && (
            <div className="flex items-center bg-[var(--dc-chip)] rounded-full p-0.5 border border-[var(--dc-border)]">
              <button
                onClick={() => setShowResidual(false)}
                className={clsx(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                  !showResidual ? "bg-[var(--dc-accent)] text-white shadow-sm" : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]"
                )}
              >
                Target
              </button>
              <button
                onClick={() => setShowResidual(true)}
                className={clsx(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                  showResidual ? "bg-[var(--dc-warning)] text-yellow-950 shadow-sm" : "text-[var(--dc-muted)] hover:text-[var(--dc-text)]"
                )}
              >
                Residual
              </button>
            </div>
          )}
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href={activeDownload}
            download
            className="flex items-center justify-center h-7 w-7 rounded-full bg-[var(--dc-chip-strong)] text-[var(--dc-text)] hover:bg-[var(--dc-accent)] hover:text-white transition-colors"
            title="Download Audio"
          >
            <Download className="w-3.5 h-3.5" />
          </motion.a>
        </div>
      </div>

      {/* Waveform */}
      <Waveform
        audioUrl={activeUrl}
        currentTime={currentTime}
        duration={duration}
        onSeek={seek}
      />

      {/* Controls Container */}
      <div className="flex items-center gap-4 mt-4 bg-[var(--dc-chip)] rounded-2xl p-2 pr-4 border border-[var(--dc-border)]">
        {/* Play/Pause */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggle}
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors",
            playing ? "bg-[var(--dc-accent)] text-white shadow-[0_0_15px_var(--dc-accent-ring)]" : "bg-white text-black hover:bg-gray-100"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={playing ? "pause" : "play"}
              initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-1 fill-current" />}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* Time Progress */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-mono text-[var(--dc-text)] tabular-nums min-w-[40px] text-right">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] font-bold text-[var(--dc-muted)]">/</span>
          <span className="text-xs font-bold font-mono text-[var(--dc-muted)] tabular-nums min-w-[40px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2.5 ml-auto">
          <Volume2 className="h-4 w-4 text-[var(--dc-muted)]" />
          <div className="group relative flex items-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-20 h-1.5 bg-[var(--dc-chip-strong)] rounded-full appearance-none outline-none accent-[var(--dc-accent-light)] cursor-pointer hover:accent-white transition-all"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
