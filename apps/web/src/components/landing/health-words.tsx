"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LANGUAGES, LIKE_FAMILY } from "./l10n";
import { useMotionPaused } from "./motion";
import { allowIndicFonts } from "./reveal";

const DWELL_MS = 3400;
/** The leaving line's fade (landing.css §4); the next line starts 20ms after it, so two scripts never overlap. */
const EXIT_MS = 300;
const FONTS_CAP_MS = 3000;
const NAMES: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.lang, l.english]));

/** Only the Indic code points: a space would also fetch Noto's Latin subset, which the line never uses. */
const indicText = (s: string) => s.replace(/[^ऀ-￿]/g, "");

/**
 * "Cared for like family" in English, Kannada and Hindi, changing on its own.
 * It holds still while off screen, in a hidden tab or paused with its button, and stays on English
 * under reduced motion or the page-wide pause. Screen readers get all three once, not every change.
 */
export function HealthWords({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLSpanElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);
  const [held, setHeld] = useState(false);
  const motionPaused = useMotionPaused();

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const el = ref.current;
    // Several entries for the one target can arrive in a single callback; the last one is current.
    const io = el ? new IntersectionObserver((entries) => setInView(entries[entries.length - 1].isIntersecting)) : null;
    if (el && io) io.observe(el);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  // The first time the line is seen, wait for its Noto faces (3s at most), so the first swap never
  // shows a fallback face. reveal.tsx has usually allowed them a screen and a half earlier.
  useEffect(() => {
    if (!inView || fontsReady) return;
    let alive = true;
    allowIndicFonts();
    const loads = Array.from(cellRef.current?.querySelectorAll<HTMLElement>("[lang]:not([lang|='en'])") ?? [], (el) => {
      const s = getComputedStyle(el);
      return document.fonts?.load(`${s.fontStyle} ${s.fontWeight} 1em ${s.fontFamily}`, indicText(el.textContent ?? "")).catch(() => []);
    });
    let cap = 0;
    const capped = new Promise<void>((resolve) => {
      cap = window.setTimeout(resolve, FONTS_CAP_MS);
    });
    Promise.race([Promise.all(loads), capped]).then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
      window.clearTimeout(cap);
    };
  }, [inView, fontsReady]);

  const running = !motionPaused && !held && inView && tabVisible && fontsReady;
  // Under reduced motion or the page-wide pause the line rests on English.
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
    <div ref={ref} className={cn("flex items-center gap-1 sm:gap-2", className)}>
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

      {/* One centre line for the badge, the words and Pause, whichever language is showing (Kannada
          wraps only on the narrowest phones). */}
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-3 text-rotator text-primary sm:gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(1_76_94/0.5)] ring-1 ring-aqua-2 sm:size-12">
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
        <span ref={cellRef} className="hw-cell min-w-0">
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

      {/* WCAG 2.2.2. Nothing moves under reduced motion or the page-wide pause, so it goes then. */}
      {!motionPaused && (
        <button
          type="button"
          onClick={() => setHeld((h) => !h)}
          aria-label={held ? "Play the languages" : "Pause the languages"}
          className="hw-toggle"
        >
          <span>{held ? <Play aria-hidden /> : <Pause aria-hidden />}</span>
        </button>
      )}
    </div>
  );
}
