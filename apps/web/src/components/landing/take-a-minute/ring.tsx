import type { RefCallback } from "react";

/* The time-left ring (spec §5.7): 1.157 D across, a 2.5px white/85 arc over a white/14 track, from
   12 o'clock clockwise. The tools write the fraction left every frame through the api; the shell
   adds the opening draw-in, the refill tween ("Keep going") and, under reduced motion, a step
   once a second instead of a sweep. Writes go straight to the DOM, never through React state. */

export type RingController = {
  attachSvg: RefCallback<SVGSVGElement>;
  attachArc: RefCallback<SVGCircleElement>;
  setRemaining(f: number): void;
  refill(f: number, ms?: number): void;
  /** The opening draw-in, 0 → 1, multiplies what is shown. */
  setDraw(v: number): void;
  setStepped(on: boolean): void;
  /** Re-measures the stroke width (the ring scales with the viewport). */
  measure(): void;
  dispose(): void;
};

const R = 48.5;
const STROKE_PX = 2.5;
const TRACK_PX = 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Ease-out quint, a close stand-in for --curve-calm over a short tween. */
const calm = (p: number) => 1 - (1 - p) ** 5;

export function createRing(): RingController {
  let svg: SVGSVGElement | null = null;
  let arc: SVGCircleElement | null = null;
  /** What the tool asked for last. */
  let target = 1;
  /** What is drawn, before the draw-in factor. */
  let shown = 1;
  let draw = 1;
  let stepped = false;
  let lastStep = 0;
  let tween: { from: number; start: number; ms: number } | null = null;
  let raf = 0;

  const paint = () => {
    if (!arc) return;
    const f = clamp01(shown) * draw;
    arc.style.strokeDashoffset = String(1 - f);
    // A zero-length dash still draws its round cap: hide the dot at 12 o'clock.
    arc.style.opacity = f > 0.002 ? "" : "0";
  };

  const measure = () => {
    if (!svg) return;
    const px = svg.getBoundingClientRect().width;
    if (!px) return;
    // The viewBox is 100 wide, so user units per pixel = 100 / px.
    svg.style.setProperty("--nv-ring-w", String((STROKE_PX * 100) / px));
    svg.style.setProperty("--nv-track-w", String((TRACK_PX * 100) / px));
  };

  const frame = (now: number) => {
    raf = 0;
    if (!tween) return;
    const p = Math.min(1, (now - tween.start) / tween.ms);
    // Heads for the live target, so a refill during a running session never breaks its rhythm.
    shown = tween.from + (target - tween.from) * calm(p);
    paint();
    if (p < 1) raf = requestAnimationFrame(frame);
    else tween = null;
  };

  return {
    attachSvg: (node) => {
      svg = node;
      measure();
    },
    attachArc: (node) => {
      arc = node;
      paint();
    },
    setRemaining(f) {
      target = clamp01(f);
      if (tween) return;
      if (stepped) {
        const now = performance.now();
        // Once a second, unless it reached the end or jumped (a stop or a fresh start).
        if (target > 0 && Math.abs(target - shown) < 0.25 && now - lastStep < 1000) return;
        lastStep = now;
      }
      shown = target;
      paint();
    },
    refill(f, ms = 600) {
      target = clamp01(f);
      if (stepped || ms <= 0) {
        tween = null;
        shown = target;
        paint();
        return;
      }
      tween = { from: shown, start: performance.now(), ms };
      if (!raf) raf = requestAnimationFrame(frame);
    },
    setDraw(v) {
      draw = clamp01(v);
      paint();
    },
    setStepped(on) {
      stepped = on;
    },
    measure,
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
      tween = null;
      svg = null;
      arc = null;
    },
  };
}

export function Ring({ attachSvg, attachArc }: Pick<RingController, "attachSvg" | "attachArc">) {
  return (
    <svg ref={attachSvg} aria-hidden className="nv-minute-ring" viewBox="0 0 100 100">
      <circle className="nv-minute-ring-track" cx="50" cy="50" r={R} />
      <circle ref={attachArc} className="nv-minute-ring-fill" cx="50" cy="50" r={R} pathLength={1} />
    </svg>
  );
}
