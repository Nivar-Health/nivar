"use client";

import { useRef } from "react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { StethMonitor } from "@/components/live/steth-monitor";
import { cn } from "@/lib/utils";
import { useEcgFeed, useInView, usePairing, useStethFeed } from "./live-feeds";
import { useMotionPaused } from "./motion";
import { LiveDot, Pill } from "./primitives";

/** Demo vitals. 126/78 is "Elevated" under both AHA 2025 (120-129/<80) and ESC 2024 (120-139/70-89). */
const VITALS = [
  { label: "Blood pressure", value: "126/78", unit: "mmHg", flag: "Elevated" },
  { label: "Oxygen saturation", value: "98", unit: "%", flag: "Normal" },
  { label: "Blood sugar", value: "112", unit: "mg/dL", flag: "Normal" },
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
 * They stream only while on screen, and hold still under prefers-reduced-motion.
 */
export function LiveDashboard({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const motionPaused = useMotionPaused();
  const running = inView && !motionPaused;
  const paired = usePairing(running, 1200);
  const feed = useEcgFeed(76);
  const stethFeed = useStethFeed(76);

  return (
    <div
      ref={ref}
      className={cn(
        // inset-shadow-2xs + inset-shadow-white/6: the spec's 1px top highlight (white at 6%) without a colour literal.
        "rounded-[1.75rem] border border-border bg-card p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)] inset-shadow-2xs inset-shadow-white/6 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-medium text-foreground">Rahul Mehta, 58</p>
          <p className="text-caption text-muted-foreground">Heart Check, HSR Layout</p>
        </div>
        <Pill tone="inverse" size="md" className="h-9">
          <LiveDot pulse className="size-1.5" />
          <span>
            Doctor<span className="hidden sm:inline"> reviewing</span>
          </span>
        </Pill>
      </div>

      <EcgMonitor
        feed={running ? feed : null}
        heartRate={76}
        status={paired ? "streaming" : "connecting"}
        paused={motionPaused}
        pausedLabel={PAUSED_LABEL}
        height={200}
        className="rounded-2xl"
      />

      {/* Heart and lung sounds: the doctor listens as the nurse moves the digital stethoscope. */}
      <StethMonitor
        feed={running ? stethFeed : null}
        heartRate={76}
        status={paired ? "streaming" : "connecting"}
        paused={motionPaused}
        pausedLabel={PAUSED_LABEL}
        height={170}
        className="mt-3 rounded-2xl"
      />

      <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-border min-[420px]:grid-cols-2">
        {VITALS.map((v) => (
          <div key={v.label} className="flex flex-col gap-3 bg-card p-4">
            <dt className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
              <span>{v.label}</span>
              {v.flag === "Normal" ? (
                <Pill tone="inverse">Normal</Pill>
              ) : (
                <Pill className="bg-amber-on-dark/14 text-amber-on-dark ring-1 ring-amber-on-dark/35">Elevated</Pill>
              )}
            </dt>
            <dd className="text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-foreground tabular-nums">
              {v.value} <span className="text-xs font-normal tracking-normal text-muted-foreground">{v.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
