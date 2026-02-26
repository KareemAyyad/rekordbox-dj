"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface WaveformProps {
  audioUrl: string;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  height?: number;
  color?: string;
  progressColor?: string;
}

export function Waveform({
  audioUrl,
  currentTime = 0,
  duration = 0,
  onSeek,
  height = 48,
  color = "var(--dc-muted2)",
  progressColor = "var(--dc-accent)",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<Float32Array | null>(null);
  const durationRef = useRef(duration);
  const [loading, setLoading] = useState(true);

  durationRef.current = duration;

  // Decode audio and extract waveform peaks
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    dataRef.current = null;

    async function loadWaveform() {
      try {
        const res = await fetch(audioUrl);
        const buffer = await res.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(buffer);

        if (cancelled) { ctx.close(); return; }

        const raw = decoded.getChannelData(0);
        const samples = 200;
        const blockSize = Math.floor(raw.length / samples);
        const peaks = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(raw[start + j]);
          }
          peaks[i] = sum / blockSize;
        }

        // Normalize peaks to 0-1
        const max = Math.max(...peaks) || 1;
        for (let i = 0; i < peaks.length; i++) {
          peaks[i] /= max;
        }

        dataRef.current = peaks;
        durationRef.current = decoded.duration;
        setLoading(false);

        ctx.close();
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    loadWaveform();
    return () => { cancelled = true; };
  }, [audioUrl]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const peaks = dataRef.current;
    if (!canvas || !peaks) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const barWidth = Math.max(1, (w / peaks.length) - 1);
    const mid = h / 2;
    const progress = durationRef.current > 0 ? currentTime / durationRef.current : 0;
    const progressX = progress * w;

    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const barH = Math.max(2, peaks[i] * (h * 0.8));

      ctx.fillStyle = x < progressX ? progressColor : color;
      ctx.fillRect(x, mid - barH / 2, barWidth, barH);
    }
  }, [currentTime, color, progressColor]);

  // Redraw on currentTime change
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Redraw on window resize
  useEffect(() => {
    const handleResize = () => drawWaveform();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWaveform]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !durationRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(ratio * durationRef.current);
  };

  if (loading) {
    return (
      <div
        className="w-full rounded-lg dc-animate-shimmer"
        style={{ height }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full rounded-lg"
      style={{ height, cursor: onSeek ? "pointer" : "default" }}
    />
  );
}
