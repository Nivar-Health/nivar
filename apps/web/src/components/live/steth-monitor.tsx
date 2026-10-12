"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, HeadphoneOff, Stethoscope } from "lucide-react";
import type { Feed, StethChunk } from "@/lib/device-sim";
import { createHeartSound, type HeartSound } from "@/lib/heart-sound";
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

export type StethFeed = Feed<StethChunk>;

export type StethMonitorProps = {
  /** Subscribe to stethoscope chunks; return an unsubscribe function. Memoize it. */
  feed?: StethFeed | null;
  heartRate?: number | null;
  status?: MonitorStatus;
  /** Total monitor height in px (default 220). */
  height?: number;
  /** Auscultation site label. */
  site?: string;
  /** Hide the Listen button (e.g. on the nurse's own device). */
  hideListen?: boolean;
  className?: string;
};

const NO_SIGNAL_MS = 1800;
const METER_BARS = 7;

type Marker = { at: number; kind: "S1" | "S2" };

export function StethMonitor({
  feed,
  heartRate,
  status,
  height = 220,
  site = "Mitral area",
  hideListen = false,
  className,
}: StethMonitorProps) {
  const [hasSignal, setHasSignal] = useState(false);
  const [listening, setListening] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const hrPropRef = useRef<number | null | undefined>(heartRate);
  useEffect(() => {
    hrPropRef.current = heartRate;
  }, [heartRate]);

  const playerRef = useRef(new SamplePlayer(1000, 0.25));
  const chunkHrRef = useRef<number | null>(null);
  const soundRef = useRef<HeartSound | null>(null);
  const hrTextRef = useRef<HTMLSpanElement>(null);
  const meterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const view = useRef({
    size: null as CanvasSize | null,
    grid: null as HTMLCanvasElement | null,
    buf: new Float32Array(0),
    total: 0, // samples written so far (absolute index)
    markers: [] as Marker[],
    // burst detector
    armed: true,
    lastOnset: -1e9,
    lastS1: -1e9,
    s1Intervals: [] as number[],
    detectedHr: null as number | null,
  });

  const setup = (size: CanvasSize) => {
    const v = view.current;
    v.size = size;
    v.grid = renderGrid(size, size.width < 480 ? 4 : 5, MONITOR.stethRgb, size.height / 2);
    // Roughly 140 px per second, between 2 and 4 seconds on screen.
    const seconds = Math.min(4, Math.max(2, size.width / 140));
    const cap = Math.round(seconds * playerRef.current.sampleRate);
    if (v.buf.length !== cap) {
      v.buf = new Float32Array(cap);
      v.total = 0;
      v.markers = [];
    }
  };

  const { containerRef, canvasRef } = useHiDpiCanvas((size) => setup(size));

  useEffect(() => {
    if (!feed) return;
    const player = playerRef.current;
    const unsub = feed((chunk) => {
      if (!chunk || !Array.isArray(chunk.samples)) return;
      const sr = chunk.sampleRate && chunk.sampleRate > 0 ? chunk.sampleRate : 1000;
      if (sr !== player.sampleRate) {
        player.push([], sr);
        view.current.buf = new Float32Array(0);
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

  // Stop audio on unmount.
  useEffect(() => {
    return () => {
      soundRef.current?.stop();
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let signal = false;
    let lastHrText = "";

    const currentHr = () => hrPropRef.current ?? chunkHrRef.current ?? view.current.detectedHr;

    const write = (val: number) => {
      const v = view.current;
      const cap = v.buf.length;
      if (cap === 0) return;
      v.buf[v.total % cap] = val;
      const idx = v.total;
      v.total++;
      const sr = playerRef.current.sampleRate;
      // Burst onset detector with hysteresis + refractory.
      if (v.armed && val > 0.3 && idx - v.lastOnset > sr * 0.14) {
        v.armed = false;
        const hr = currentHr();
        const rr = hr ? 60 / hr : null;
        const gap = (idx - v.lastOnset) / sr;
        const prev = v.markers[v.markers.length - 1];
        let kind: "S1" | "S2";
        if (rr) kind = gap < rr * 0.5 ? "S2" : "S1";
        else kind = prev?.kind === "S1" && gap < 0.5 ? "S2" : "S1";
        v.markers.push({ at: idx, kind });
        if (v.markers.length > 32) v.markers.shift();
        v.lastOnset = idx;
        if (kind === "S1") {
          const interval = (idx - v.lastS1) / sr;
          if (interval > 0.3 && interval < 2.2) {
            v.s1Intervals.push(interval);
            if (v.s1Intervals.length > 6) v.s1Intervals.shift();
            const avg = v.s1Intervals.reduce((a, b) => a + b, 0) / v.s1Intervals.length;
            v.detectedHr = Math.round(60 / avg);
          }
          v.lastS1 = idx;
          soundRef.current?.trigger();
        }
      } else if (!v.armed && val < 0.15) {
        v.armed = true;
      }
    };

    const draw = () => {
      const v = view.current;
      const size = v.size;
      if (!size) return;
      const { width, height: h, dpr } = size;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = MONITOR.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (v.grid) ctx.drawImage(v.grid, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const mid = h / 2;
      const amp = h * 0.42;
      const cap = v.buf.length;
      const filled = Math.min(v.total, cap);

      // Centre line.
      ctx.strokeStyle = `rgba(${MONITOR.stethRgb}, ${signal ? 0.25 : 0.35})`;
      ctx.lineWidth = 1;
      if (!signal) ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(mid) + 0.5);
      ctx.lineTo(width, Math.round(mid) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      if (cap === 0 || filled === 0) return;

      // Column-wise peak envelope, newest sample at the right edge.
      const cols = Math.max(1, Math.floor(width));
      const samplesPerCol = cap / cols;
      const startAbs = v.total - cap; // absolute index at x = 0
      const peaks = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        const a = Math.floor(startAbs + c * samplesPerCol);
        const b = Math.floor(startAbs + (c + 1) * samplesPerCol);
        let m = 0;
        for (let i = a; i < b; i++) {
          if (i < 0 || i < v.total - filled) continue;
          const s = v.buf[i % cap];
          if (s > m) m = s;
        }
        peaks[c] = m;
      }

      const grad = ctx.createLinearGradient(0, mid - amp, 0, mid + amp);
      grad.addColorStop(0, `rgba(${MONITOR.stethRgb}, 0.95)`);
      grad.addColorStop(0.5, `rgba(${MONITOR.stethRgb}, 0.55)`);
      grad.addColorStop(1, `rgba(${MONITOR.stethRgb}, 0.95)`);
      ctx.beginPath();
      ctx.moveTo(0, mid);
      for (let c = 0; c < cols; c++) ctx.lineTo(c, mid - peaks[c] * amp);
      for (let c = cols - 1; c >= 0; c--) ctx.lineTo(c, mid + peaks[c] * amp);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.globalAlpha = signal ? 1 : 0.45;
      ctx.fill();
      // Crisp outline on the upper edge for definition.
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        const y = mid - peaks[c] * amp;
        if (c === 0) ctx.moveTo(c, y);
        else ctx.lineTo(c, y);
      }
      ctx.strokeStyle = "#FFE3A3";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // S1 / S2 annotations.
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      for (const m of v.markers) {
        const x = ((m.at - startAbs) / cap) * width;
        if (x < 8 || x > width - 24) continue;
        const isS1 = m.kind === "S1";
        ctx.strokeStyle = `rgba(${MONITOR.stethRgb}, ${isS1 ? 0.35 : 0.22})`;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 18);
        ctx.lineTo(x + 0.5, h - 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = isS1 ? "#FFE3A3" : "rgba(255, 227, 163, 0.7)";
        ctx.fillText(m.kind, x + 12, 13);
      }

      // Fade-in on the left edge so old data scrolls out softly.
      const fade = ctx.createLinearGradient(0, 0, 36, 0);
      fade.addColorStop(0, "rgba(7,27,24,0.9)");
      fade.addColorStop(1, "rgba(7,27,24,0)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, 36, h);
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
          view.current.s1Intervals = [];
          view.current.detectedHr = null;
          chunkHrRef.current = null;
        }
        soundRef.current?.setVolume(nowSignal ? 0.9 : 0);
      }

      const hr = signal ? currentHr() : null;
      const text = hr && hr > 0 ? String(Math.round(hr)) : "--";
      if (text !== lastHrText && hrTextRef.current) {
        hrTextRef.current.textContent = text;
        lastHrText = text;
      }
      const sound = soundRef.current;
      if (sound && hr) sound.setHeartRate(hr);

      // Volume meter.
      const level = sound?.isPlaying ? sound.getLevel() : 0;
      const lit = Math.round(level * METER_BARS);
      meterRefs.current.forEach((el, i) => {
        if (el) el.dataset.on = i < lit ? "1" : "0";
      });

      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  const toggleListen = async () => {
    if (listening) {
      soundRef.current?.stop();
      soundRef.current = null;
      setListening(false);
      return;
    }
    try {
      const sound = createHeartSound();
      soundRef.current = sound;
      const hr = hrPropRef.current ?? chunkHrRef.current ?? view.current.detectedHr ?? 74;
      await sound.start(hr);
      if (!hasSignal) sound.setVolume(0);
      setAudioError(null);
      setListening(true);
    } catch {
      soundRef.current = null;
      setAudioError("Audio is not available in this browser");
    }
  };

  const live = hasSignal && status !== "stopped" && status !== "connecting";
  const overlay =
    status === "connecting" ? (
      <>
        <WaitingDots /> Connecting to Smart Stethoscope
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
        <div className="flex min-w-0 items-center gap-2.5 overflow-hidden text-[11px] tracking-wide whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#F2C14E]">
            <Stethoscope className="size-3.5" /> PCG
          </span>
          <span className="truncate rounded border border-[#F2C14E]/25 px-1.5 py-px font-medium text-[#F7D88E]">{site}</span>
          <span className="hidden text-[#6E8F87] sm:inline">20 to 400 Hz</span>
        </div>
        <LiveBadge live={live} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div ref={containerRef} className="relative min-w-0 flex-1">
          <canvas ref={canvasRef} className="absolute inset-0 block" aria-label="Live heart sound waveform" role="img" />
          <MonitorOverlay show={overlay !== null}>{overlay}</MonitorOverlay>
        </div>

        <div className="flex w-[92px] shrink-0 flex-col justify-between gap-2 border-l border-white/5 bg-[#0A221E] px-3 py-2.5 sm:w-[124px]">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-[#F2C14E]">HR</span>
            <span
              ref={hrTextRef}
              className="mt-0.5 font-mono text-[34px] leading-none font-semibold tracking-tight text-[#F2C14E] tabular-nums sm:text-[40px]"
              style={{ textShadow: "0 0 16px rgba(242,193,78,0.3)" }}
            >
              --
            </span>
            <span className="mt-1 text-[10px] tracking-wider text-[#6E8F87]">bpm</span>
          </div>

          {!hideListen && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={toggleListen}
                aria-pressed={listening}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#F2C14E]/60",
                  listening
                    ? "border-[#F2C14E] bg-[#F2C14E] text-[#132321] hover:bg-[#F5CD6A]"
                    : "border-[#F2C14E]/40 bg-transparent text-[#F7D88E] hover:bg-[#F2C14E]/10",
                )}
              >
                {listening ? <HeadphoneOff className="size-3.5" /> : <Headphones className="size-3.5" />}
                {listening ? "Mute" : "Listen"}
              </button>
              <div className="flex h-3 items-end justify-center gap-[3px]" aria-hidden>
                {Array.from({ length: METER_BARS }, (_, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      meterRefs.current[i] = el;
                    }}
                    data-on="0"
                    className={cn(
                      "w-[5px] rounded-[1px] bg-white/10 transition-colors duration-75",
                      i >= METER_BARS - 2
                        ? "data-[on=1]:bg-[#FF6B5E]"
                        : i >= METER_BARS - 4
                          ? "data-[on=1]:bg-[#F2C14E]"
                          : "data-[on=1]:bg-[#3BE3B4]",
                    )}
                    style={{ height: `${40 + (i / (METER_BARS - 1)) * 60}%` }}
                  />
                ))}
              </div>
              {audioError && <span className="text-[10px] leading-tight text-[#FF8A7F]">{audioError}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
