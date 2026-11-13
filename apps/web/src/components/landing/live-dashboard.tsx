"use client";

import { useEffect, useMemo, useState } from "react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import type { StethMonitor } from "@/components/live/steth-monitor";
import { generateEcgSamples, generateStethSamples } from "@/lib/device-sim";
import { useEcgFeed, useStethFeed } from "./live-feeds";

/**
 * The demo's signal. The still frames the server draws (live-panel.tsx) and the frames these monitors
 * start from come from the same generator with the same numbers, so one takes over from the other
 * without a visible change.
 */
export type DemoSignal = {
  bpm: number;
  /** Seconds of signal in a still frame. */
  seconds: number;
};

export type DemoMonitorProps = {
  signal: DemoSignal;
  /** On screen and playing: the feed runs and the trace draws. Otherwise the monitor keeps its frame. */
  running: boolean;
  /** Held by the visitor, or resting with the page's animations: the badge reads "PAUSED". */
  paused: boolean;
  height: number;
  className?: string;
};

/** What every monitor of the demo shares: it says DEMO, never a device state, and it draws lightly. */
const DEMO = {
  status: "streaming",
  badgeLabel: "DEMO",
  growWithText: true,
  labelScale: "landing",
  // The sweep moves about 3px a frame at 30fps, which reads the same as 60 and halves the painting.
  maxFps: 30,
  maxDpr: 2,
} as const;

/**
 * The moving monitors of the readings demo: the same components the doctor's console uses, fed by the
 * local device simulators. A chunk of their own, fetched only when the demo is about to play
 * (live-slot.tsx); the stethoscope's monitor and its heart sound are a second chunk, fetched only
 * where that monitor shows.
 */
export function LiveEcg({ signal, running, paused, height, className }: DemoMonitorProps) {
  const feed = useEcgFeed(signal.bpm);
  const frame = useMemo(() => generateEcgSamples(signal.seconds, signal.bpm), [signal.seconds, signal.bpm]);
  return (
    <EcgMonitor
      {...DEMO}
      feed={running ? feed : null}
      heartRate={signal.bpm}
      paused={paused}
      idle={!running}
      demoFrame={frame}
      canvasLabel="ECG waveform, demo"
      height={height}
      className={className}
    />
  );
}

/** Heart and lung sounds: the doctor listens as the nurse moves the digital stethoscope. */
export function LiveSteth({ signal, running, paused, height, className }: DemoMonitorProps) {
  const feed = useStethFeed(signal.bpm);
  const frame = useMemo(() => generateStethSamples(signal.seconds, signal.bpm), [signal.seconds, signal.bpm]);
  const [Monitor, setMonitor] = useState<typeof StethMonitor | null>(null);

  useEffect(() => {
    let alive = true;
    // A failed load leaves the still frame in place.
    import("@/components/live/steth-monitor").then(
      (m) => alive && setMonitor(() => m.StethMonitor),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!Monitor) return null;
  return (
    <Monitor
      {...DEMO}
      feed={running ? feed : null}
      heartRate={signal.bpm}
      paused={paused}
      idle={!running}
      demoFrame={frame}
      canvasLabel="Heart sound waveform, demo"
      // Nothing to hear while the trace rests.
      listenDisabled={!running}
      height={height}
      className={className}
    />
  );
}
