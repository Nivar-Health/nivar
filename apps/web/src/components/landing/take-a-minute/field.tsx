import { memo, type RefCallback } from "react";

/* The field behind the orb (spec §5.7): a static jade pool, a mint pool that breathes with
   Breathe (.12 → .24), a dimmer for Eyes, and canvas motes. Motes: 24 on a fine pointer, 12 on a
   coarse one, none under reduced motion, Save-Data or ≤ 4 cores; 0.8–2.4px, alpha .10–.45, rising
   4–12 px/s, at most 2× resolution. They are painted once, and move only while a session runs
   and the tab is visible. No backdrop-filter, no blur filters. */

export type MotesController = {
  attach: RefCallback<HTMLCanvasElement>;
  /** Sizes the canvas and scatters the motes, at the first open (the scene is kept mounted). */
  prepare(): void;
  setMoving(on: boolean): void;
};

type Mote = { x: number; y: number; r: number; a: number; v: number; s: number };

type DeviceNavigator = Navigator & { connection?: { saveData?: boolean } };

export function moteCount(coarse: boolean, reducedMotion: boolean): number {
  if (reducedMotion || typeof navigator === "undefined") return 0;
  const nav = navigator as DeviceNavigator;
  if (nav.connection?.saveData || (nav.hardwareConcurrency ?? 8) <= 4) return 0;
  return coarse ? 12 : 24;
}

export function createMotes(count: number): MotesController {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let motes: Mote[] = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let moving = false;

  const spawn = (anywhere: boolean): Mote => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 4,
    r: 0.8 + Math.random() * 1.6,
    a: 0.1 + Math.random() * 0.35,
    v: 4 + Math.random() * 8,
    s: Math.random() * Math.PI * 2,
  });

  const size = () => {
    if (!canvas || !ctx) return;
    const pw = w;
    const ph = h;
    w = window.innerWidth;
    h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#eaf6f9";
    if (pw && ph) {
      for (const mote of motes) {
        mote.x *= w / pw;
        mote.y *= h / ph;
      }
    }
  };

  const paint = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (const mote of motes) {
      ctx.globalAlpha = mote.a;
      ctx.beginPath();
      // A slow sideways sway, so the rise reads as drifting rather than scrolling.
      ctx.arc(mote.x + Math.sin(clock * 0.35 + mote.s) * 1.5, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    for (let i = 0; i < motes.length; i++) {
      motes[i].y -= motes[i].v * dt;
      if (motes[i].y < -4) motes[i] = spawn(false);
    }
    paint();
    if (moving && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const run = () => {
    if (raf || !moving || document.hidden || !ctx) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onVisibility = () => (document.hidden ? halt() : run());
  const onResize = () => {
    size();
    paint();
  };

  return {
    attach(node) {
      if (!node) {
        halt();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onResize);
        canvas = null;
        ctx = null;
        return;
      }
      canvas = node;
    },
    prepare() {
      if (!count || !canvas || ctx) return;
      ctx = canvas.getContext("2d");
      size();
      motes = Array.from({ length: count }, () => spawn(true));
      paint();
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", onResize);
      run();
    },
    setMoving(on) {
      moving = on && count > 0;
      if (moving) run();
      else halt();
    },
  };
}

type Bind = (el: HTMLElement | SVGElement | null) => (() => void) | undefined;

/** The field's bound layers (anim.ts bindStyle): its fade, the breathing mint pool, the dimmer. */
export type FieldBinds = { fade: Bind; breath: Bind; dim: Bind };

export const Field = memo(function Field({
  binds: { fade, breath, dim },
  attachCanvas,
}: {
  binds: FieldBinds;
  attachCanvas: MotesController["attach"];
}) {
  return (
    <div ref={fade} aria-hidden className="nv-minute-field">
      <span className="nv-minute-pool" />
      <span ref={breath} className="nv-minute-pool-mint" />
      <canvas ref={attachCanvas} className="nv-minute-motes" />
      <span ref={dim} className="nv-minute-field-dim" />
    </div>
  );
});
