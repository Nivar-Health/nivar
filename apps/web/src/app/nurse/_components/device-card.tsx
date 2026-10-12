"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Activity, Bluetooth, CircleCheck, LoaderCircle, Plug, RotateCcw, Stethoscope, Timer } from "lucide-react";
import { toast } from "sonner";
import { EcgMonitor, StethMonitor } from "@/components/live";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import {
  STETH_SAMPLE_RATE,
  createEcgSimulator,
  createStethSimulator,
  simulatorFeed,
  type EcgChunk,
  type StethChunk,
} from "@/lib/device-sim";
import { formatTime } from "@/lib/format";
import { emit } from "@/lib/socket";
import type { Booking, DeviceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAIR_MS = 2000;
const CAPTURE_S = 10;
const STETH_MAX_POINTS = 2000;

export const STETH_FINDINGS = [
  "Normal S1 S2, no murmur",
  "S1 S2 heard, soft systolic murmur",
  "Irregular rhythm noted",
  "S3 gallop heard",
  "Muffled heart sounds",
] as const;

type Phase = "idle" | "connecting" | "streaming";

const DEVICE = {
  ecg: {
    title: "Smart ECG",
    model: "Nivar ECG-1",
    icon: Activity,
    connect: "Connect Smart ECG",
  },
  stethoscope: {
    title: "Smart Stethoscope",
    model: "Nivar Steth-1",
    icon: Stethoscope,
    connect: "Connect Smart Stethoscope",
  },
} as const;

function randomHr() {
  return 72 + Math.floor(Math.random() * 17);
}

/** Envelope downsample: max of each block, so S1 / S2 peaks survive. */
function downsampleEnvelope(samples: number[], maxPoints: number): number[] {
  if (samples.length <= maxPoints) return samples;
  const block = Math.ceil(samples.length / maxPoints);
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += block) {
    let m = 0;
    for (let j = i; j < Math.min(samples.length, i + block); j++) m = Math.max(m, samples[j]);
    out.push(Math.round(m * 1000) / 1000);
  }
  return out;
}

function ProgressRing({ progressRef }: { progressRef: React.RefObject<number> }) {
  const circleRef = useRef<SVGCircleElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const r = 15;
  const c = 2 * Math.PI * r;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, Math.max(0, progressRef.current ?? 0));
      if (circleRef.current) circleRef.current.style.strokeDashoffset = String(c * (1 - p));
      if (textRef.current) textRef.current.textContent = `${Math.max(0, Math.ceil(CAPTURE_S * (1 - p)))}s`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressRef, c]);
  return (
    <span className="relative inline-flex size-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <circle
          ref={circleRef}
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c}
        />
      </svg>
      <span ref={textRef} className="text-[10px] font-semibold tabular-nums">
        {CAPTURE_S}s
      </span>
    </span>
  );
}

function PairingAnimation({ model }: { model: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-[#071B18] px-4 py-8 text-center">
      <span className="relative flex size-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#3BE3B4]/25" />
        <span
          className="absolute inset-2 animate-ping rounded-full bg-[#3BE3B4]/20"
          style={{ animationDelay: "400ms" }}
        />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-[#3BE3B4] text-[#071B18]">
          <Bluetooth className="size-6" />
        </span>
      </span>
      <div>
        <p className="text-sm font-semibold text-[#CFEFE6]">Pairing with {model}</p>
        <p className="mt-0.5 text-xs text-[#6E8F87]">Keep the device close to your phone</p>
      </div>
    </div>
  );
}

export interface DeviceCardProps {
  kind: DeviceKind;
  booking: Booking;
  booked: boolean;
  doctorName?: string | null;
  /** Heart rate from the vitals form, used to match the simulated signal. */
  heartRateHint?: number | null;
  onSaved: (booking: Booking) => void;
}

export function DeviceCard({ kind, booking, booked, doctorName, heartRateHint, onSaved }: DeviceCardProps) {
  const meta = DEVICE[kind];
  const Icon = meta.icon;
  const bookingId = booking.id;

  const [ecgSim] = useState(() => (kind === "ecg" ? createEcgSimulator({ heartRate: randomHr() }) : null));
  const [stethSim] = useState(() => (kind === "stethoscope" ? createStethSimulator({ heartRate: randomHr() }) : null));
  const ecgFeed = useMemo(() => (ecgSim ? simulatorFeed(ecgSim) : null), [ecgSim]);
  const stethFeed = useMemo(() => (stethSim ? simulatorFeed(stethSim) : null), [stethSim]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [findings, setFindings] = useState<string>(booking.stethoscope?.findings || STETH_FINDINGS[0]);

  const phaseRef = useRef<Phase>("idle");
  const pairTimer = useRef<number | null>(null);
  const captureRef = useRef<{
    samples: number[];
    target: number;
    hr: number[];
  } | null>(null);
  const progressRef = useRef(0);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const sendStatus = useCallback(
    (state: "connecting" | "streaming" | "stopped") => emit("device:status", { bookingId, device: kind, state }),
    [bookingId, kind],
  );

  // Match the simulated heart to the nurse's recorded heart rate.
  useEffect(() => {
    if (!heartRateHint || heartRateHint < 30 || heartRateHint > 220) return;
    ecgSim?.setHeartRate(heartRateHint);
    stethSim?.setHeartRate(heartRateHint);
  }, [heartRateHint, ecgSim, stethSim]);

  const finishCapture = useCallback(
    async (samples: number[], hrs: number[]) => {
      const heartRate = Math.round(hrs.reduce((a, b) => a + b, 0) / Math.max(1, hrs.length));
      setCapturing(false);
      setSaving(true);
      try {
        const res =
          kind === "ecg"
            ? await api.put<{ booking: Booking }>(`/bookings/${bookingId}/ecg`, {
                samples,
                sampleRate: 250,
                heartRate,
              })
            : await api.put<{ booking: Booking }>(`/bookings/${bookingId}/stethoscope`, {
                heartRate,
                findings,
                samples: downsampleEnvelope(samples, STETH_MAX_POINTS),
              });
        onSaved(res.booking);
        toast.success(kind === "ecg" ? "ECG reading saved" : "Stethoscope reading saved", {
          description: doctorName ? `${doctorName} can review it now.` : undefined,
        });
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't save the reading."));
      } finally {
        setSaving(false);
      }
    },
    [bookingId, doctorName, findings, kind, onSaved],
  );

  // While streaming: forward every chunk to the doctor and fill any capture in progress.
  const onChunk = useEffectEvent((chunk: EcgChunk | StethChunk, event: "device:ecg" | "device:steth") => {
    if (event === "device:ecg") {
      const c = chunk as EcgChunk;
      emit(event, {
        bookingId,
        samples: c.samples,
        sampleRate: c.sampleRate,
        heartRate: c.heartRate,
        t: c.t,
      });
    } else {
      emit(event, {
        bookingId,
        samples: chunk.samples,
        heartRate: chunk.heartRate,
        t: chunk.t,
      });
    }
    const cap = captureRef.current;
    if (cap) {
      for (const v of chunk.samples) cap.samples.push(v);
      cap.hr.push(chunk.heartRate);
      progressRef.current = Math.min(1, cap.samples.length / cap.target);
      if (cap.samples.length >= cap.target) {
        captureRef.current = null;
        void finishCapture(cap.samples.slice(0, cap.target), cap.hr);
      }
    }
  });

  useEffect(() => {
    if (phase !== "streaming") return;
    const unsub = ecgFeed
      ? ecgFeed((c) => onChunk(c, "device:ecg"))
      : stethFeed
        ? stethFeed((c) => onChunk(c, "device:steth"))
        : null;
    // Re-announce periodically so a doctor who opens the consult later sees the device as live.
    const beacon = window.setInterval(() => sendStatus("streaming"), 5000);
    return () => {
      window.clearInterval(beacon);
      unsub?.();
    };
  }, [phase, ecgFeed, stethFeed, sendStatus]);

  // Stop everything on unmount (status left testing / consult, or navigation).
  useEffect(
    () => () => {
      if (pairTimer.current) window.clearTimeout(pairTimer.current);
      captureRef.current = null;
      if (phaseRef.current !== "idle") {
        emit("device:status", { bookingId, device: kind, state: "stopped" });
        phaseRef.current = "idle";
      }
    },
    [bookingId, kind],
  );

  const connect = () => {
    setPhaseBoth("connecting");
    sendStatus("connecting");
    pairTimer.current = window.setTimeout(() => {
      pairTimer.current = null;
      setPhaseBoth("streaming");
      sendStatus("streaming");
    }, PAIR_MS);
  };

  const disconnect = () => {
    if (pairTimer.current) window.clearTimeout(pairTimer.current);
    pairTimer.current = null;
    captureRef.current = null;
    setCapturing(false);
    setPhaseBoth("idle");
    sendStatus("stopped");
  };

  const startCapture = () => {
    const rate = kind === "ecg" ? 250 : STETH_SAMPLE_RATE;
    progressRef.current = 0;
    captureRef.current = { samples: [], target: rate * CAPTURE_S, hr: [] };
    setCapturing(true);
  };

  const saveFindings = async (next: string) => {
    setFindings(next);
    const s = booking.stethoscope;
    if (!s?.capturedAt || capturing) return;
    try {
      const res = await api.put<{ booking: Booking }>(`/bookings/${bookingId}/stethoscope`, {
        heartRate: s.heartRate,
        findings: next,
        ...(s.samples?.length ? { samples: s.samples } : {}),
      });
      onSaved(res.booking);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update findings."));
    }
  };

  const saved = kind === "ecg" ? booking.ecg : booking.stethoscope;
  const savedAt = saved?.capturedAt;
  const savedSummary =
    kind === "ecg"
      ? booking.ecg
        ? `${Math.round(booking.ecg.heartRate)} bpm · ${booking.ecg.rhythm}`
        : ""
      : booking.stethoscope
        ? `${Math.round(booking.stethoscope.heartRate)} bpm · ${booking.stethoscope.findings}`
        : "";

  const live = phase === "streaming";
  const subtitle =
    phase === "connecting"
      ? "Pairing..."
      : live
        ? capturing
          ? "Capturing 10 second reading"
          : `Streaming live${doctorName ? ` to ${doctorName}` : ""}`
        : savedAt
          ? "Reading saved"
          : "Not connected";

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-colors",
        live ? "border-primary/30" : "border-border",
      )}
      aria-label={meta.title}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            live ? "bg-[#071B18] text-[#3BE3B4]" : "bg-mint text-primary",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="font-semibold whitespace-nowrap">{meta.title}</h3>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
                booked ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {booked ? "Booked" : "Optional"}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            {live && <span className="live-dot size-1.5 text-danger" aria-hidden />}
            {subtitle}
          </p>
        </div>
      </div>

      {phase === "connecting" && <PairingAnimation model={meta.model} />}

      {live &&
        (kind === "ecg" ? (
          <EcgMonitor feed={ecgFeed} status="streaming" height={190} />
        ) : (
          <StethMonitor feed={stethFeed} status="streaming" height={180} hideListen />
        ))}

      {kind === "stethoscope" && live && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Findings</legend>
          <div className="flex flex-wrap gap-2">
            {STETH_FINDINGS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={findings === f}
                onClick={() => void saveFindings(f)}
                className={cn(
                  "min-h-10 rounded-full border px-3.5 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  findings === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {savedAt && (
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200 ring-inset">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">10s reading saved at {formatTime(savedAt)}</p>
            <p className="text-emerald-800/80">{savedSummary}</p>
          </div>
        </div>
      )}

      {phase === "idle" && (
        <Button
          size="lg"
          variant={savedAt ? "outline" : "default"}
          className="h-12 w-full rounded-xl text-base font-semibold"
          onClick={connect}
        >
          <Bluetooth className="size-5" />
          {savedAt ? "Reconnect device" : meta.connect}
        </Button>
      )}

      {live && (
        <div className="flex gap-2.5">
          {capturing || saving ? (
            <div
              role="status"
              className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl bg-[#071B18] text-base font-semibold text-[#3BE3B4]"
            >
              {capturing ? (
                <ProgressRing progressRef={progressRef} />
              ) : (
                <LoaderCircle className="size-5 animate-spin" />
              )}
              {capturing ? "Capturing reading" : "Saving reading"}
            </div>
          ) : (
            <Button
              size="lg"
              variant={savedAt ? "outline" : "default"}
              className="h-12 flex-1 rounded-xl text-base font-semibold"
              onClick={startCapture}
            >
              {savedAt ? <RotateCcw className="size-5" /> : <Timer className="size-5" />}
              {savedAt ? "Retake 10s reading" : "Capture 10s reading"}
            </Button>
          )}
          <Button size="lg" variant="outline" className="h-12 rounded-xl px-4 text-base" onClick={disconnect}>
            <Plug className="size-5" />
            Stop
          </Button>
        </div>
      )}
    </section>
  );
}
