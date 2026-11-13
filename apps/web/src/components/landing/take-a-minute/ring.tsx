import type { RefCallback } from "react";

/* The time-left ring: 1.157 D across, a 2px mint arc over a faint track, from 12 o'clock clockwise. At
   rest only the track shows; the arc draws in when a session starts and drains with its time. The tools
   write the fraction left through the api: every frame for Breathe; a few times a second for the
   others, when the arc glides between writes on a CSS transition instead of a frame loop. The shell adds
   the refill tween and, under reduced motion, a step once a second instead of a sweep. Writes go
   straight to the DOM, never through React state. */

export type RingController = {
  attachSvg: RefCallback<SVGSVGElement>;
  attachArc: RefCallback<SVGCircleElement>;
  /** `glideMs`: ease to `f` over that long (the gap to the next write). 0 writes it at once. */
  setRemaining(f: number, glideMs?: number): void;
  refill(f: number, ms?: number): void;
  setStepped(on: boolean): void;
  /** Re-measures the stroke width (the ring scales with the viewport). */
  measure(): void;
  dispose(): void;
};

const R = 48.5;
const STROKE_PX = 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Ease-out quint, a close stand-in for --curve-calm over a short tween. */
const calm = (p: number) => 1 - (1 - p) ** 5;

export function createRing(): RingController {
  let svg: SVGSVGElement | null = null;
  let arc: SVGCircleElement | null = null;
  /** What the tool asked for last. */
  let target = 0;
  /** What is drawn. */
  let shown = 0;
  let stepped = false;
  let lastStep = 0;
  /** The arc's own CSS transition, as last written. */
  let glide = "";
  let tween: { from: number; start: number; ms: number } | null = null;
  let raf = 0;

  const paint = () => {
    if (!arc) return;
    const f = clamp01(shown);
    arc.style.strokeDashoffset = String(1 - f);
    // A zero-length dash still draws its round cap: hide the dot at 12 o'clock.
    arc.style.opacity = f > 0.002 ? "" : "0";
  };

  /** The arc glides only between a timer session's writes: a tween or a step writes every value itself. */
  const setGlide = (ms: number) => {
    const next = ms > 0 && !stepped ? `stroke-dashoffset ${Math.round(ms)}ms linear` : "";
    if (!arc || next === glide) return;
    glide = next;
    arc.style.transition = next;
  };

  const measure = () => {
    if (!svg) return;
    const px = svg.getBoundingClientRect().width;
    if (!px) return;
    // The viewBox is 100 wide, so user units per pixel = 100 / px.
    svg.style.setProperty("--nv-ring-w", String((STROKE_PX * 100) / px));
  };

  const frame = (now: number) => {
    raf = 0;
    if (!tween) return;
    // Timed from its own first frame, on the frames' clock.
    if (tween.start < 0) tween.start = now;
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
      glide = "";
      paint();
    },
    setRemaining(f, glideMs = 0) {
      target = clamp01(f);
      if (tween) return;
      if (stepped) {
        const now = performance.now();
        // Once a second, unless it reached the end or jumped (a stop or a fresh start).
        if (target > 0 && Math.abs(target - shown) < 0.25 && now - lastStep < 1000) return;
        lastStep = now;
      }
      setGlide(glideMs);
      shown = target;
      paint();
    },
    refill(f, ms = 600) {
      target = clamp01(f);
      setGlide(0);
      if (stepped || ms <= 0) {
        tween = null;
        shown = target;
        paint();
        return;
      }
      tween = { from: shown, start: -1, ms };
      if (!raf) raf = requestAnimationFrame(frame);
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
