"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bedside monitor palette (canvas needs literal colours). */
export const MONITOR = {
  bg: "#071B18",
  bgEdge: "#0B2622",
  trace: "#3BE3B4",
  traceRgb: "59, 227, 180",
  steth: "#F2C14E",
  stethRgb: "242, 193, 78",
  text: "#CFEFE6",
  dim: "#6E8F87",
  danger: "#FF6B5E",
} as const;

export type MonitorStatus = "connecting" | "streaming" | "stopped";

export type CanvasSize = { width: number; height: number; dpr: number };

/**
 * Keeps a canvas sized to its container at device pixel ratio.
 * Calls `onResize` (from a ResizeObserver callback, never during render).
 */
export function useHiDpiCanvas(onResize: (size: CanvasSize, canvas: HTMLCanvasElement) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(onResize);
  useEffect(() => {
    cbRef.current = onResize;
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let last = "";
    const apply = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const key = `${width}x${height}@${dpr}`;
      if (key === last) return;
      last = key;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      cbRef.current({ width, height, dpr }, canvas);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(container);
    // DPR changes when a window moves between displays.
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.("change", apply);
    return () => {
      ro.disconnect();
      mq.removeEventListener?.("change", apply);
    };
  }, []);

  return { containerRef, canvasRef };
}

/** Draws a millimetre grid (1 mm minor, 5 mm major) onto an offscreen canvas. */
export function renderGrid(size: CanvasSize, pxPerMm: number, rgb: string, origin = 0) {
  const c = document.createElement("canvas");
  c.width = Math.round(size.width * size.dpr);
  c.height = Math.round(size.height * size.dpr);
  const g = c.getContext("2d");
  if (!g) return c;
  g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  const crisp = (v: number) => Math.round(v * size.dpr) / size.dpr + 0.5 / size.dpr;
  const line = (alpha: number, step: number, width: number) => {
    g.strokeStyle = `rgba(${rgb}, ${alpha})`;
    g.lineWidth = width / size.dpr;
    g.beginPath();
    for (let x = 0; x <= size.width; x += step) {
      g.moveTo(crisp(x), 0);
      g.lineTo(crisp(x), size.height);
    }
    for (let y = origin % step; y <= size.height; y += step) {
      g.moveTo(0, crisp(y));
      g.lineTo(size.width, crisp(y));
    }
    g.stroke();
  };
  line(0.055, pxPerMm, 1);
  line(0.13, pxPerMm * 5, 1);
  // Major dots at intersections, like printed monitor graticules.
  g.fillStyle = `rgba(${rgb}, 0.28)`;
  for (let x = 0; x <= size.width; x += pxPerMm * 5) {
    for (let y = origin % (pxPerMm * 5); y <= size.height; y += pxPerMm * 5) {
      g.fillRect(crisp(x) - 0.75, crisp(y) - 0.75, 1.5, 1.5);
    }
  }
  return c;
}

export function LiveBadge({ live, label = "LIVE" }: { live: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] transition-colors",
        live ? "bg-[#FF6B5E]/15 text-[#FF8A7F]" : "bg-white/5 text-[#6E8F87]",
      )}
    >
      <span className="relative flex size-1.5">
        {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#FF6B5E] opacity-75" />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", live ? "bg-[#FF6B5E]" : "bg-[#6E8F87]")} />
      </span>
      {live ? label : "OFFLINE"}
    </span>
  );
}

export function MonitorOverlay({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex animate-in items-center justify-center duration-300 fade-in">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#071B18]/90 px-3.5 py-1.5 text-xs font-medium text-[#CFEFE6]">
        {children}
      </div>
    </div>
  );
}

export function WaitingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 animate-pulse rounded-full bg-[#3BE3B4]"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Jitter buffer that plays queued samples back at real-time rate, smoothing
 * 100 ms network chunks into continuous motion.
 */
export class SamplePlayer {
  private queue: number[] = [];
  private head = 0;
  private acc = 0;
  private buffering = true;
  sampleRate: number;
  lastDataAt = 0;

  constructor(
    sampleRate: number,
    private latency = 0.25,
  ) {
    this.sampleRate = sampleRate;
  }

  get queuedSeconds() {
    return (this.queue.length - this.head) / this.sampleRate;
  }

  push(samples: ArrayLike<number>, sampleRate?: number) {
    if (sampleRate && sampleRate !== this.sampleRate) {
      this.reset();
      this.sampleRate = sampleRate;
    }
    for (let i = 0; i < samples.length; i++) {
      const v = Number(samples[i]);
      this.queue.push(Number.isFinite(v) ? v : 0);
    }
    this.lastDataAt = performance.now();
    // Drop stale backlog (e.g. after the tab was hidden).
    const max = this.sampleRate * 2;
    if (this.queue.length - this.head > max) {
      this.head = this.queue.length - Math.round(this.sampleRate * this.latency);
    }
    if (this.head > 4096) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
  }

  reset() {
    this.queue = [];
    this.head = 0;
    this.acc = 0;
    this.buffering = true;
  }

  /** Pull the samples due for an elapsed `dtMs`. */
  take(dtMs: number, out: (v: number) => void) {
    const queued = this.queuedSeconds;
    if (this.buffering) {
      if (queued < this.latency) return 0;
      this.buffering = false;
    }
    // Speed up slightly when the backlog grows, slow down when it runs low.
    const rate = queued > this.latency * 2.5 ? 1.15 : queued < this.latency * 0.3 ? 0.92 : 1;
    this.acc += (Math.min(dtMs, 250) / 1000) * this.sampleRate * rate;
    let n = Math.floor(this.acc);
    this.acc -= n;
    let taken = 0;
    while (n-- > 0) {
      if (this.head >= this.queue.length) {
        this.buffering = true;
        this.acc = 0;
        break;
      }
      out(this.queue[this.head++]);
      taken++;
    }
    return taken;
  }
}
