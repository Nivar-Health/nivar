"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { StethMonitor } from "@/components/live/steth-monitor";
import { cn } from "@/lib/utils";
import { useEcgFeed, useInView, usePairing, useStethFeed } from "./live-feeds";
import { useMotionPaused } from "./motion";
import { LiveDot, Pill } from "./primitives";

/**
 * Demo vitals. 126/78 is "Elevated" under AHA/ACC 2025 (120-129/<80). 92 mg/dL is normal fasting and
 * random alike (MedlinePlus ency/003482: fasting 70-99, random usually 125 or lower), so it needs no qualifier.
 */
const VITALS = [
  { label: "Blood pressure", value: "126/78", unit: "mmHg", flag: "Elevated" },
  { label: "Blood oxygen", value: "98", unit: "%", flag: "Normal" },
  { label: "Blood sugar", value: "92", unit: "mg/dL", flag: "Normal" },
  { label: "Heart rate", value: "76", unit: "bpm", flag: "Normal" },
] as const;

/** Shown on both monitors under reduced motion, before any signal has arrived. */
const PAUSED_LABEL = (
  // Narrow canvases (under sm) get two centred lines with room to spare instead of an edge-to-edge pill.
  <span className="max-w-[18ch] text-center text-balance sm:max-w-none">Live trace paused while animations are off.</span>
);

/**
 * The doctor's view, built from the same monitor components the real console uses (smart ECG and
 * digital stethoscope) and fed by the local device simulators, so both traces are genuinely live.
 * They stream and draw only while on screen: off screen the monitors keep their last frame and run no
 * loop. The visitor's Pause holds them too (WCAG 2.2.2), and under reduced motion they rest.
 *
 * `compact` (phones): the ECG and the vitals only, with the vitals in two tighter columns. The root is
 * a column that fills its box, so a parent can reserve the exact space before this chunk loads; the
 * vitals take up any slack. `onReady` fires once, on mount.
 */
export function LiveDashboard({
  className,
  compact = false,
  ecgHeight = 200,
  stethHeight = 170,
  onReady,
}: {
  className?: string;
  compact?: boolean;
  ecgHeight?: number;
  stethHeight?: number;
  onReady?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const motionPaused = useMotionPaused();
  /** The visitor's own Pause. */
  const [held, setHeld] = useState(false);
  const running = inView && !motionPaused && !held;
  // Pairing starts as the chunk mounts, 600px ahead of the panel, so the monitors are live on arrival.
  const paired = usePairing(!motionPaused, 1200);
  const feed = useEcgFeed(76);
  const stethFeed = useStethFeed(76);
  const status = paired ? "streaming" : "connecting";
  const frozen = motionPaused || held;

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <div
      ref={ref}
      data-live-dashboard={compact ? "compact" : "full"}
      className={cn(
        // inset-shadow-2xs + inset-shadow-white/6: a 1px top highlight (white at 6%) without a colour literal.
        "flex flex-col rounded-[1.5rem] border border-border bg-card p-3 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)] inset-shadow-2xs inset-shadow-white/6 sm:p-4 lg:p-5",
        className,
      )}
    >
      <div className={cn("flex items-center justify-between gap-3 px-1", compact ? "pb-2.5" : "pb-4")}>
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-medium text-foreground">Rahul Mehta, 58</p>
          {!compact && <p className="truncate text-caption text-muted-foreground">Complete Home Check-up, HSR Layout</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Pill tone="inverse" size="md" className={compact ? "h-8" : "h-9"}>
            <LiveDot pulse={!held} className="size-1.5" />
            <span>Doctor{!compact && " reviewing"}</span>
          </Pill>
          {!motionPaused && (
            // A 44px target around a circle the pill's height (check-ups.css), so the header keeps its height.
            <button
              type="button"
              onClick={() => setHeld((h) => !h)}
              aria-label={held ? "Play the live demo" : "Pause the live demo"}
              className="nv-chk-hold"
            >
              <span aria-hidden>
                {held ? (
                  <Play className="size-3.5 translate-x-px" fill="currentColor" strokeWidth={0} />
                ) : (
                  <Pause className="size-3.5" fill="currentColor" strokeWidth={0} />
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      <EcgMonitor
        feed={running ? feed : null}
        heartRate={76}
        status={status}
        paused={frozen}
        idle={!running}
        pausedLabel={motionPaused ? PAUSED_LABEL : undefined}
        height={ecgHeight}
        growWithText
        labelScale="landing"
        className="shrink-0 rounded-2xl"
      />

      {/* Heart and lung sounds: the doctor listens as the nurse moves the digital stethoscope. */}
      {!compact && (
        <StethMonitor
          feed={running ? stethFeed : null}
          heartRate={76}
          status={status}
          paused={frozen}
          idle={!running}
          pausedLabel={motionPaused ? PAUSED_LABEL : undefined}
          height={stethHeight}
          growWithText
          labelScale="landing"
          className="mt-3 shrink-0 rounded-2xl"
        />
      )}

      <dl className={cn("grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border", compact ? "mt-2.5" : "mt-4")}>
        {VITALS.map((v) => (
          <div
            key={v.label}
            className={cn(
              "flex flex-col justify-center bg-card",
              compact ? "gap-1 px-3 py-2" : "gap-3 px-4 py-3",
            )}
          >
            <dt className="flex items-center justify-between gap-2 text-caption leading-[1.3] text-muted-foreground">
              <span className="min-w-0">{v.label}</span>
              {!compact && <Flag flag={v.flag} />}
            </dt>
            <dd className="flex items-baseline gap-1 tabular-nums">
              {/* Size first: tailwind-merge drops a line-height that precedes a font size. */}
              <span
                className={cn(
                  compact ? "text-[1.25rem]" : "text-[1.5rem]",
                  "leading-none font-medium tracking-[-0.02em] text-foreground",
                )}
              >
                {v.value}
              </span>
              <span className="text-[0.8125rem] leading-none text-muted-foreground">{v.unit}</span>
            </dd>
            {compact && (
              <dd className="flex">
                <Flag flag={v.flag} compact />
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A reading's flag: the "Normal" or "Elevated" pill, or on phones a dot and the word. */
function Flag({ flag, compact = false }: { flag: "Normal" | "Elevated"; compact?: boolean }) {
  const elevated = flag === "Elevated";
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-caption leading-[1.3] font-medium",
          elevated ? "text-amber-on-dark" : "text-foreground-2",
        )}
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", elevated ? "bg-amber-on-dark" : "bg-trace")} />
        {flag}
      </span>
    );
  }
  return elevated ? (
    <Pill className="bg-amber-on-dark/14 text-[0.8125rem] text-amber-on-dark ring-1 ring-amber-on-dark/35">Elevated</Pill>
  ) : (
    <Pill tone="inverse" className="text-[0.8125rem]">
      Normal
    </Pill>
  );
}
