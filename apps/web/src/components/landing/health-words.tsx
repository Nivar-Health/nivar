"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LANGUAGES, LIKE_FAMILY } from "./l10n";
import { useMotionPaused } from "./motion";

const DWELL_MS = 3400;
const EXIT_MS = 500;
const NAMES: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.lang, l.english]));

/**
 * "Cared for like family" in English, Kannada and Hindi, changing on its own.
 * It holds still while off screen or in a hidden tab, and stays on English under reduced motion.
 * Screen readers get all three once, not every change.
 */
export function HealthWords({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const motionPaused = useMotionPaused();

  useEffect(() => {
    let alive = true;
    // Wait for the Indic fonts (or 3s at most) so the first swap never shows a fallback face.
    const cap = new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
    Promise.race([document.fonts?.ready ?? Promise.resolve(), cap]).then(() => alive && setFontsReady(true));
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const el = ref.current;
    // Several entries for the one target can arrive in a single callback; the last one is current.
    const io = el ? new IntersectionObserver((entries) => setInView(entries[entries.length - 1].isIntersecting)) : null;
    if (el && io) io.observe(el);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  const running = !motionPaused && inView && tabVisible && fontsReady;
  // Under reduced motion the line rests on English.
  const shown = motionPaused ? 0 : index;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => {
      setLeaving(index);
      setIndex((index + 1) % LIKE_FAMILY.length);
      setDrawKey((k) => k + 1);
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(() => setLeaving(null), EXIT_MS + 50);
    }, DWELL_MS);
    return () => window.clearTimeout(t);
  }, [running, index]);

  const [en, ...indic] = LIKE_FAMILY;

  return (
    <div ref={ref} className={className}>
      <p className="sr-only">
        {en.text} Also in{" "}
        {indic.map((p, k) => (
          <span key={p.lang}>
            {k === indic.length - 1 ? "and " : ""}
            {NAMES[p.lang]}, <span lang={p.lang}>{p.text}</span>
            {k === indic.length - 1 ? "." : "; "}
          </span>
        ))}
      </p>

      <div aria-hidden="true" className="flex items-start gap-3 text-rotator text-primary sm:gap-4">
        {/* Centred on the first line, whichever language is showing. */}
        <span className="mt-[calc((1.45em-2.25rem)/2)] flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(1_76_94/0.5)] ring-1 ring-aqua-2 sm:mt-[calc((1.45em-3rem)/2)] sm:size-12">
          <svg
            key={drawKey}
            data-draw={drawKey > 0 ? "" : undefined}
            viewBox="0 0 28 16"
            fill="none"
            className="hw-beat h-4 w-6 text-rose sm:h-5 sm:w-7"
          >
            <path
              d="M1 9h7l2.5 0 2-6 2.5 11 2-5h10"
              pathLength={1}
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="hw-cell min-w-0">
          {LIKE_FAMILY.map((p, i) => (
            <span
              key={p.lang}
              lang={p.lang}
              className={cn("hw-item text-balance", p.lang === "en-IN" && "tracking-[-0.025em]")}
              data-state={i === shown ? "active" : i === leaving ? "leaving" : "idle"}
            >
              {p.text}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
