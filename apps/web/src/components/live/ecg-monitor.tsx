"use client";

import { useEffect, useRef, useState } from "react";
import { HeartPulse } from "lucide-react";
import type { EcgChunk, Feed } from "@/lib/device-sim";
import { cn } from "@/lib/utils";
import {
  LiveBadge,
  MONITOR,
  MonitorOverlay,
  SamplePlayer,
  WaitingDots,
  renderGrid,
  useHiDpiCanvas,
  type CanvasSize,
  type MonitorStatus,
} from "./monitor-shared";

export type EcgFeed = Feed<EcgChunk>;

export type EcgMonitorProps = {
  /** Subscribe to ECG chunks; return an unsubscribe function. Memoize it. */
  feed?: EcgFeed | null;
  /** Heart rate to display. Falls back to the chunk's heartRate, then to detected R-R. */
  heartRate?: number | null;
  /** Device state. When omitted, inferred from incoming data. */
  status?: MonitorStatus;
  /** Total monitor height in px (default 240). */
  height?: number;
  lead?: string;
  className?: string;
};

const SPEED_MM_S = 25;
const NO_SIGNAL_MS = 1800;

export function EcgMonitor({
  feed,
  heartRate,
  status,
  height = 240,
  lead = "Lead II",
  className,
}: EcgMonitorProps) {
  const [hasSignal, setHasSignal] = useState(false);
  const [gainLabel, setGainLabel] = useState("10 mm/mV");

  const hrPropRef = useRef<number | null | undefined>(heartRate);
  useEffect(() => {
    hrPropRef.current = heartRate;
  }, [heartRate]);

  const hrTextRef = useRef<HTMLSpanElement>(null);
  const rrTextRef = useRef<HTMLSpanElement>(null);
  const heartRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<SamplePlayer>(new SamplePlayer(250, 0.25));
  const chunkHrRef = useRef<number | null>(null);

  // Drawing state lives in a ref; the rAF loop mutates it without re-rendering.
  const view = useRef({
    size: null as CanvasSize | null,
    grid: null as HTMLCanvasElement | null,
    buf: new Float32Array(0),
    wi: 0,
    pxPerMm: 5,
    pxPerMv: 50,
    baseline: 0,
    gap: 0,
    // beat detector
    peakEnv: 0.8,
    armed: true,
    sinceBeat: 1e9,
    rrs: [] as number[],
    lastBeatHr: null as number | null,
  });

  const setup = (size: CanvasSize) => {
    const v = view.current;
    v.size = size;
    v.pxPerMm = size.width < 480 ? 4 : 5;
    const plotMm = size.height / v.pxPerMm;
    const gainMm = plotMm >= 38 ? 20 : 10;
    v.pxPerMv = gainMm * v.pxPerMm;
    // Fit a -0.45..1.3 mV span with comfortable margins.
    if (v.pxPerMv * 1.85 > size.height) v.pxPerMv = size.height / 1.85;
    v.baseline = Math.round(size.height * 0.1 + 1.3 * v.pxPerMv);
    v.grid = renderGrid(size, v.pxPerMm, MONITOR.traceRgb, v.baseline);
    const sr = playerRef.current.sampleRate;
    const cap = Math.max(10, Math.ceil((size.width / (SPEED_MM_S * v.pxPerMm)) * sr));
    v.buf = new Float32Array(cap).fill(NaN);
    v.wi = 0;
    v.gap = Math.round(sr * 0.12);
    setGainLabel(`${Math.round(v.pxPerMv / v.pxPerMm)} mm/mV`);
  };

  const { containerRef, canvasRef } = useHiDpiCanvas((size) => setup(size));

  // Subscribe to the feed.
  useEffect(() => {
    if (!feed) return;
    const player = playerRef.current;
    const unsub = feed((chunk) => {
      if (!chunk || !Array.isArray(chunk.samples)) return;
      const sr = chunk.sampleRate > 0 ? chunk.sampleRate : 250;
      if (sr !== player.sampleRate) {
        player.push([], sr);
        const size = view.current.size;
        if (size) setup(size);
      }
      player.push(chunk.samples);
      if (Number.isFinite(chunk.heartRate) && chunk.heartRate > 0) chunkHrRef.current = chunk.heartRate;
    });
    return () => {
      unsub?.();
      player.reset();
    };
  }, [feed]);

  // Animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let signal = false;
    let lastHrText = "";

    const onBeat = () => {
      const v = view.current;
      const sr = playerRef.current.sampleRate;
      const rr = v.sinceBeat / sr;
      if (rr > 0.25 && rr < 2.5) {
        v.rrs.push(rr);
        if (v.rrs.length > 6) v.rrs.shift();
        const avg = v.rrs.reduce((a, b) => a + b, 0) / v.rrs.length;
        v.lastBeatHr = Math.round(60 / avg);
        if (rrTextRef.current) rrTextRef.current.textContent = `${Math.round(rr * 1000)}`;
      }
      v.sinceBeat = 0;
      heartRef.current?.animate(
        [
          { transform: "scale(1)", opacity: 0.85 },
          { transform: "scale(1.32)", opacity: 1, offset: 0.18 },
          { transform: "scale(1)", opacity: 0.85 },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    };

    // Light 3-tap low-pass, like the monitor's display filter.
    let p1 = 0;
    let p2 = 0;
    const write = (raw: number) => {
      const val = 0.25 * p2 + 0.5 * p1 + 0.25 * raw;
      p2 = p1;
      p1 = raw;
      const v = view.current;
      const cap = v.buf.length;
      v.buf[v.wi] = val;
      v.wi = (v.wi + 1) % cap;
      for (let k = 0; k < 2; k++) v.buf[(v.wi + v.gap + k) % cap] = NaN;
      // R-peak detector with adaptive threshold and refractory period.
      v.sinceBeat++;
      v.peakEnv = Math.max(val, v.peakEnv * 0.9993, 0.35);
      const sr = playerRef.current.sampleRate;
      if (v.armed && val > v.peakEnv * 0.62 && v.sinceBeat > sr * 0.24) {
        v.armed = false;
        onBeat();
      } else if (!v.armed && val < v.peakEnv * 0.35) {
        v.armed = true;
      }
    };

    const draw = () => {
      const v = view.current;
      const size = v.size;
      if (!size) return;
      const { width, dpr } = size;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = MONITOR.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (v.grid) ctx.drawImage(v.grid, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cap = v.buf.length;
      const sr = playerRef.current.sampleRate;
      const pxPerSample = (SPEED_MM_S * v.pxPerMm) / sr;
      const yOf = (mv: number) => v.baseline - mv * v.pxPerMv;

      if (!signal) {
        // Flat dashed isoelectric line, like a monitor with leads off.
        ctx.strokeStyle = `rgba(${MONITOR.traceRgb}, 0.35)`;
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(0, v.baseline);
        ctx.lineTo(width, v.baseline);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const path = () => {
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i < cap; i++) {
          const val = v.buf[i];
          if (Number.isNaN(val) || i === v.wi) {
            pen = false;
            if (Number.isNaN(val)) continue;
          }
          const x = i * pxPerSample;
          const y = yOf(val);
          if (!pen) {
            ctx.moveTo(x, y);
            pen = true;
          } else ctx.lineTo(x, y);
        }
      };
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      path();
      ctx.strokeStyle = `rgba(${MONITOR.traceRgb}, 0.16)`;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = MONITOR.trace;
      ctx.lineWidth = 1.9;
      ctx.stroke();

      // Write head glow.
      const headIdx = (v.wi - 1 + cap) % cap;
      const headVal = v.buf[headIdx];
      if (signal && !Number.isNaN(headVal)) {
        const hx = headIdx * pxPerSample;
        const hy = yOf(headVal);
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10);
        g.addColorStop(0, `rgba(${MONITOR.traceRgb}, 0.9)`);
        g.addColorStop(1, `rgba(${MONITOR.traceRgb}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(hx - 10, hy - 10, 20, 20);
        ctx.fillStyle = "#E9FFF8";
        ctx.beginPath();
        ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const player = playerRef.current;
      if (view.current.buf.length > 0) player.take(dt, write);

      const nowSignal = player.lastDataAt > 0 && now - player.lastDataAt < NO_SIGNAL_MS;
      if (nowSignal !== signal) {
        signal = nowSignal;
        setHasSignal(nowSignal);
        if (!nowSignal) {
          view.current.rrs = [];
          view.current.lastBeatHr = null;
          chunkHrRef.current = null;
        }
      }

      const hr = signal ? (hrPropRef.current ?? chunkHrRef.current ?? view.current.lastBeatHr) : null;
      const text = hr && hr > 0 ? String(Math.round(hr)) : "--";
      if (text !== lastHrText && hrTextRef.current) {
        hrTextRef.current.textContent = text;
        lastHrText = text;
      }
      if (!signal && rrTextRef.current && rrTextRef.current.textContent !== "--") rrTextRef.current.textContent = "--";

      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  const live = hasSignal && status !== "stopped" && status !== "connecting";
  const overlay =
    status === "connecting" ? (
      <>
        <WaitingDots /> Connecting to Smart ECG
      </>
    ) : !hasSignal ? (
      <>
        <WaitingDots /> Waiting for device...
      </>
    ) : null;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border border-[#14332E] bg-[#071B18] text-[#CFEFE6] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_-12px_rgba(7,27,24,0.55)]",
        className,
      )}
      style={{ height }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2.5 text-[11px] tracking-wide">
          <span className="font-semibold text-[#3BE3B4]">ECG</span>
          <span className="rounded border border-[#3BE3B4]/25 px-1.5 py-px font-medium text-[#9FE9D2]">{lead}</span>
          <span className="hidden text-[#6E8F87] tabular-nums sm:inline">{SPEED_MM_S} mm/s</span>
          <span className="hidden text-[#6E8F87] tabular-nums sm:inline">{gainLabel}</span>
          <span className="hidden text-[#6E8F87] md:inline">0.5 to 40 Hz</span>
        </div>
        <LiveBadge live={live} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div ref={containerRef} className="relative min-w-0 flex-1">
          <canvas ref={canvasRef} className="absolute inset-0 block" aria-label="Live ECG waveform" role="img" />
          <MonitorOverlay show={overlay !== null}>{overlay}</MonitorOverlay>
        </div>

        <div className="flex w-[92px] shrink-0 flex-col justify-between border-l border-white/5 bg-[#0A221E] px-3 py-2.5 sm:w-[124px]">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] text-[#3BE3B4]">
            <span>HR</span>
            <span ref={heartRef} className="inline-flex origin-center text-[#FF6B5E] opacity-85">
              <HeartPulse className="size-4" strokeWidth={2.25} />
            </span>
          </div>
          <div className="-mt-1 flex flex-col">
            <span
              ref={hrTextRef}
              className="font-mono text-[44px] leading-none font-semibold tracking-tight text-[#3BE3B4] tabular-nums sm:text-[52px]"
              style={{ textShadow: "0 0 18px rgba(59,227,180,0.35)" }}
            >
              --
            </span>
            <span className="mt-1 text-[10px] tracking-wider text-[#6E8F87]">bpm</span>
          </div>
          <div className="flex items-baseline justify-between text-[10px] text-[#6E8F87]">
            <span className="tracking-wider">RR</span>
            <span className="font-mono text-xs text-[#9FE9D2] tabular-nums">
              <span ref={rrTextRef}>--</span> ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
