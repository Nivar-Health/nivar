"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotionPaused } from "./motion";
import { buttonClass } from "./primitives";

/** Same URL as S.nhsBreathing in health-content.ts (kept literal so the facts data stays out of the client bundle). */
const NHS_BREATHING_URL =
  "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/";

/** 5s in, 5s out (the NHS "count 1 to 5 each way"), 6 breaths = one minute. */
const PHASE_S = 5;
const BREATHS = 6;
const TOTAL_S = PHASE_S * 2 * BREATHS;

type BreathState = "idle" | "running" | "done";

/**
 * One calm minute. The orb breathes on its own at the same 5s-in, 5s-out pace (landing.css §9);
 * "Start" restarts it in step with a guided count of six breaths. Under reduced motion the orb
 * rests and the label and count pace the breathing on their own.
 */
export function BreathingCard() {
  const titleId = useId();
  const [state, setState] = useState<BreathState>("idle");
  const [t, setT] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const still = useMotionPaused();

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setState("idle");
  }, [clearTimer]);

  const start = () => {
    clearTimer();
    startedAt.current = performance.now();
    setT(0);
    setRunKey((k) => k + 1); // remounts the orb so its animation starts on "in" with the count
    setState("running");
    timer.current = window.setInterval(() => {
      // Wall-clock based, so a late tick never lets the count drift from the orb.
      const elapsed = Math.round((performance.now() - startedAt.current) / 1000);
      if (elapsed >= TOTAL_S) {
        clearTimer();
        setT(TOTAL_S);
        setState("done");
      } else {
        setT(elapsed);
      }
    }, 1000);
  };

  useEffect(() => clearTimer, [clearTimer]);

  // Leaving the tab stops the exercise.
  useEffect(() => {
    if (state !== "running") return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state, stop]);

  // If motion resumes mid-run the orb remounts; start its animation at the elapsed time to stay in step.
  const syncOrb = useCallback(
    (el: HTMLSpanElement | null) => {
      if (!el || state !== "running") return;
      el.style.animationDelay = `${-(performance.now() - startedAt.current) / 1000}s`;
    },
    [state],
  );

  const running = state === "running";
  const phase = Math.floor(t / PHASE_S) % 2 === 0 ? "in" : "out";
  const count = (t % PHASE_S) + 1;
  const breath = Math.min(BREATHS, Math.floor(t / (PHASE_S * 2)) + 1);
  const label = running ? (phase === "in" ? "Breathe in" : "Breathe out") : state === "done" ? "Well done" : "Breathe";
  const loop = still ? "" : "motion-loop";

  return (
    <section
      aria-labelledby={titleId}
      className="theme-pine relative isolate flex h-full flex-col items-center overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,var(--jade)_0%,var(--pond-2)_55%,var(--pond)_100%)] px-6 py-9 text-center sm:px-10"
    >
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 -z-10 size-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(127_224_196/0.25),transparent)]"
      />
      <p className="text-[0.9375rem] font-semibold text-mint-glow">One calm minute</p>
      <h3 id={titleId} className="mt-2 text-h3 text-white">
        Breathe with the circle
      </h3>
      <p className="mt-3 max-w-[40ch] text-small text-pretty text-on-pine-2">
        Before a blood pressure reading, your nurse will ask you to sit quietly for five minutes. A{" "}few slow
        breaths can help you feel settled.
      </p>

      <div aria-hidden className="relative my-10 grid size-52 place-items-center sm:size-60">
        <span className="absolute inset-0 rounded-full border border-white/12" />
        <span className="absolute inset-[12%] rounded-full border border-white/10" />
        <span
          key={`halo-${runKey}-${still}`}
          ref={syncOrb}
          className={cn(
            "breath-halo absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(127_224_196/0.55),transparent)] blur-md",
            loop,
          )}
        />
        <span
          key={`disc-${runKey}-${still}`}
          ref={syncOrb}
          className={cn(
            "breath-disc absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_50%_35%,#dff8ef,var(--mint-glow)_45%,var(--jade)_100%)] shadow-[0_0_60px_rgb(127_224_196/0.45)]",
            loop,
          )}
        />
        <span className="relative flex flex-col items-center">
          <span className="text-[1.375rem] font-semibold tracking-tight text-pond">{label}</span>
          {running && <span className="mt-0.5 text-[1.0625rem] font-semibold text-pond/70 tabular-nums">{count}</span>}
        </span>
      </div>

      <p aria-live="polite" className="sr-only">
        {running ? (phase === "in" ? "Breathe in" : "Breathe out") : state === "done" ? "Done." : ""}
      </p>

      {/* Two lines reserved so the running caption never pushes the button down. */}
      <p className="flex min-h-[2.9em] items-center justify-center text-caption text-balance text-on-pine-2 tabular-nums">
        {running
          ? `Breath ${breath} of ${BREATHS}: in through your nose, out through your mouth`
          : state === "done"
            ? "Done. Notice how you feel."
            : "Six slow breaths, about one minute."}
      </p>

      <button
        type="button"
        onClick={running ? stop : start}
        className={buttonClass(running ? "secondary" : "inverse", cn("mt-4", running && "border-white/25 bg-white/10 text-white hover:bg-white/15"), "lg")}
      >
        {running ? "Stop" : state === "done" ? "Start again" : "Start one calm minute"}
      </button>

      <p className="mt-6 text-caption text-balance text-on-pine-3">
        If you feel dizzy, stop and breathe normally. Technique from the{" "}
        <a
          href={NHS_BREATHING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm underline decoration-white/30 underline-offset-[3px] hover:text-white focus-ring"
        >
          NHS
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
    </section>
  );
}
