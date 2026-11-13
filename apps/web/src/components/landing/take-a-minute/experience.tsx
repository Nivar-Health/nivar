"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { Vibrate, VibrateOff, Volume2, VolumeX, X } from "lucide-react";
import { motionValue, styleEffect, transformValue, type MotionValue } from "motion";
import {
  createContext,
  memo,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FC,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Disclosure } from "../disclosure";
import { useMotionPaused, usePrefersReducedMotion } from "../motion";
import { bindStyle, settle, spring, stopAll, tween, type Ease } from "./anim";
import { ENABLED_TOOLS, READING_TOOLS, TOOL_ENABLED, TOOL_LABEL, TOOL_SPOKEN, TOOL_TONE, isToolId } from "./config";
import { onSessionDone } from "./engine";
import { Field } from "./field";
import { canVibrate, vibrate } from "./haptics";
import { isMinuteEntry, pushMinuteEntry } from "./history";
import { Stage, TONES } from "./orb";
import { loadPrefs, savePrefs } from "./prefs";
import { createRing } from "./ring";
import { sound } from "./sound";
import { attachSwipe } from "./swipe";
import { TOOLS } from "./tools";
import { COMMON } from "./tools/copy";
import type { ExperienceApi, LayoutSlots, Prefs, Tone, ToolId, ToolProps } from "./types";
import "./experience.css";

/* Take a minute, the lazy chunk. A Base UI modal dialog portaled into [data-landing] and drawn by
   motion values: the launcher's pearl blooms into a pond, flies up into the orb and lands with one
   ripple; closing plays it back into the pearl. Every spring retargets from its current value and
   velocity, so Esc mid-flight simply turns the motion around. The tools (tools/) render through Layout
   and drive the stage through the ExperienceApi; nothing they do goes through React state per frame.
   One quiet room: the title, Sound and Close share one sticky row, the tabs are one slim line of
   names, and the dock under a tool holds its buttons and at most one quiet line. A session shows only
   itself, and its ending is given a few quiet seconds before the tabs return.
   On phones the title, switcher and Start are in by 480 ms while the flight finishes, repeat opens
   play at ×0.8, a close hands off within 350 ms, and the controls dock at the bottom of the sheet. */

export type ExperienceProps = {
  open: boolean;
  /** The tool to show, already resolved by the cluster (enabled; the general entry is Breathe). */
  tool: ToolId;
  onToolChange(tool: ToolId): void;
  /** false: the close has started (its timeline then hands off within 280ms, ×0.85 on phones). */
  onOpenChange(open: boolean): void;
  /** Where focus goes on close, never <body>: the launcher, the corner button, the bar's Menu tab or the h1. */
  returnFocus(): HTMLElement | null;
  /** The element the orb flies from and back to: a pearl, or a launcher. Read at open and close. */
  origin?(): HTMLElement | null;
  /** The close timeline has finished, the dialog has left, and focus is back (the §5.9 handoff). */
  onClosed?(info: { completed: boolean }): void;
};

type CloseStyle = { kind: "orb" } | { kind: "swipe"; speed: number };
type Phase = "closed" | "opening" | "open" | "closing";
type Origin = { x: number; y: number; size: number; pearl: HTMLElement | null };

const DESCRIPTION = `Short guided pauses: a breathing guide, a 20-second eye break${
  TOOL_ENABLED.pulse ? ", a five-minute rest before a blood pressure reading and a pulse count" : " and a five-minute rest before a blood pressure reading"
}.`;

/** Shown by the Sound control for 4 s after it is switched on, and announced. */
const SOUND_HINT = "No sound? Check your volume and your phone's silent switch.";
const SOUND_HINT_MS = 4000;

/** Curves from globals.css. */
const CALM: Ease = [0.22, 1, 0.36, 1];
const EXIT: Ease = [0.4, 0, 1, 1];
const STANDARD: Ease = [0.2, 0, 0, 1];

/** The orb at rest, as a share of D (its full breath). */
const REST_SCALE = 0.62;
/** The bloom is a 56px disc. */
const BLOOM = 56;
/** Resting opacity of the tool's tone light over the orb. */
const TONE_LIGHT = 0.24;
/** The same phase word is announced at most once per 5 seconds. */
const ANNOUNCE_GAP_MS = 5000;
/** After a session ends by itself the tabs and the fine print stay away this long, so the ending has the screen to itself. */
const SETTLE_MS = 2500;
/** How far the resting orb dims at an empty breath when its light, not its size, paces Breathe (reduced motion). */
const ORB_DIM = 0.72;
/** The orb gives a little under a press on it (the idle tap that starts a session). */
const PRESS_SCALE = 0.97;
/** Closing (×0.85 on phones): the orb is checked against its pearl from LAND_MS, handed off by CLOSE_MS. */
const LAND_MS = 220;
const CLOSE_MS = 280;
/** Every open after the first in a page view plays at this pace, flight and all. */
const REPEAT_PACE = 0.8;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones play every duration at ×0.85 (spec §5.8). */
const pace = () => (window.innerWidth < 640 ? 0.85 : 1);

/** Opens so far in this page view (the module lives as long as the page). */
let opens = 0;

/** The bloom's opaque core: its outer 14% is a feather (experience.css). */
const BLOOM_CORE = 0.86;

/** Scale at which the bloom, centred on (x, y), covers the farthest corner with its opaque core. */
function coverScale(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  return (r + 24) / ((BLOOM / 2) * BLOOM_CORE);
}

function readOrigin(el: HTMLElement | null | undefined): Origin | null {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return null;
  const pearl = el.classList.contains("nv-minute-pearl") ? el : null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: pearl ? r.width : 34, pearl };
}

/** Every animated value of the scene and the ref callbacks that draw them, created once per mount. */
function createScene() {
  const mv = (v: number) => motionValue(v);
  const values = {
    root: mv(1),
    dim: mv(0),
    surfaceY: mv(0),
    bloom: mv(1),
    bloomFade: mv(0),
    /** The bloom scale that covers the viewport from its centre. */
    cover: mv(1),
    fieldIn: mv(0),
    breath: mv(0.12),
    fieldDim: mv(0),
    haloIn: mv(0),
    haloScale: mv(0.6),
    glow: mv(1),
    rippleOpacity: mv(0),
    rippleScale: mv(REST_SCALE),
    flyX: mv(0),
    flyY: mv(0),
    flyScale: mv(1),
    skin: mv(0),
    /** The tools' scale: .62 at rest. */
    scale: mv(REST_SCALE),
    /** Eyes: the orb recedes upward. */
    lift: mv(0),
    orbIn: mv(1),
    orbDim: mv(1),
    textIn: mv(0),
    textRecede: mv(1),
    mint: mv(TONE_LIGHT),
    sky: mv(0),
    rose: mv(0),
    pearl: mv(0),
  };
  const v = values;
  const tones: Record<Tone, MotionValue<number>> = { mint: v.mint, sky: v.sky, rose: v.rose, pearl: v.pearl };
  // The field only shows inside the bloom: hidden until the pond covers the screen, and gone
  // before it starts to contract.
  const fieldFade = transformValue(() => v.fieldIn.get() * clamp01((v.bloom.get() / v.cover.get() - 0.9) / 0.1));
  const binds = {
    root: bindStyle({ opacity: v.root }),
    dim: bindStyle({ opacity: v.dim }),
    surface: bindStyle({ y: v.surfaceY }),
    bloom: bindStyle({ scale: v.bloom, opacity: v.bloomFade }),
    field: {
      fade: bindStyle({ opacity: fieldFade }),
      dim: bindStyle({ opacity: v.fieldDim }),
    },
    stage: {
      // The mint pool sits in the stage but belongs to the field: it comes and goes with it, and the
      // eye break's dimmer takes it down too.
      pool: bindStyle({ opacity: transformValue(() => v.breath.get() * fieldFade.get() * (1 - v.fieldDim.get())) }),
      halo: bindStyle({ opacity: transformValue(() => v.haloIn.get() * 0.6 * (0.15 + 0.85 * v.glow.get())), scale: v.haloScale }),
      ripple: bindStyle({ opacity: v.rippleOpacity, scale: v.rippleScale }),
      fly: bindStyle({ x: v.flyX, y: v.flyY, scale: v.flyScale }),
      glow: bindStyle({ opacity: v.skin }),
      light: bindStyle({ opacity: transformValue(() => 0.25 + 0.75 * v.glow.get()) }),
      // The rim darkens as the light goes: the lit part of the orb seems to draw in without anything moving.
      shade: bindStyle({ opacity: transformValue(() => 1 - v.glow.get()) }),
      skin: bindStyle({ opacity: v.skin }),
      mint: bindStyle({ opacity: v.mint }),
      sky: bindStyle({ opacity: v.sky }),
      rose: bindStyle({ opacity: v.rose }),
      pearl: bindStyle({ opacity: v.pearl }),
    },
    orb: {
      scale: v.scale,
      y: v.lift,
      opacity: transformValue(() => v.orbIn.get() * v.orbDim.get() * (ORB_DIM + (1 - ORB_DIM) * v.glow.get())),
    },
    // The word appears as the orb arrives under it, whatever the timeline: within 28px of home.
    text: {
      opacity: transformValue(
        () => v.textIn.get() * v.textRecede.get() * clamp01(1 - Math.hypot(v.flyX.get(), v.flyY.get()) / 28),
      ),
    },
  };
  return { values, tones, binds, all: Object.values(values) };
}

/** The first tab of the pair for just before a reading: a hairline sets it apart from the calm pair. */
const FIRST_READING = ENABLED_TOOLS.find((id) => READING_TOOLS.includes(id));

/** Sound left on starts with the first press inside the sheet (a touch grants it at the click). */
const wakeSound = () => sound.wake();

/** The tools re-render only when the api or the shell changes, not when the dialog opens. */
const TOOL_VIEWS: Partial<Record<ToolId, FC<ToolProps>>> = Object.fromEntries(
  ENABLED_TOOLS.map((id) => [id, memo(TOOLS[id])]),
);

/** What Layout needs from the shell. */
type Shell = {
  textHost: HTMLDivElement | null;
  compactHeight: boolean;
  /** Below 640px: "About this exercise" stays a closed disclosure at every height. */
  phone: boolean;
  setArmed(on: boolean): void;
  /** A finger or the mouse is down on the resting orb: it gives a little, and comes back on release. */
  pressOrb(down: boolean): void;
};
const ShellContext = createContext<Shell>({
  textHost: null,
  compactHeight: false,
  phone: false,
  setArmed: () => {},
  pressOrb: () => {},
});

/**
 * The dock's two measures, both event-driven (no frame loop): its height, as --nv-dock-h on the sheet, so a
 * control focused under it scrolls clear; and data-stuck, set while the dock floats over the content (or
 * is within 32px of it), so its pond backdrop shows only when something can pass under it and never draws
 * a band across the field. The sentinel after it marks where it would sit unstuck.
 */
function attachDock(el: HTMLDivElement | null) {
  const sheet = el?.closest<HTMLElement>(".nv-minute-sheet");
  const end = el?.nextElementSibling;
  if (!el || !sheet || !end) return;
  const sizes = new ResizeObserver(() => sheet.style.setProperty("--nv-dock-h", `${Math.ceil(el.offsetHeight)}px`));
  sizes.observe(el);
  const stuck = new IntersectionObserver(
    ([e]) => el.toggleAttribute("data-stuck", !e.isIntersecting && e.boundingClientRect.top >= (e.rootBounds?.bottom ?? 0)),
    { root: sheet, rootMargin: "0px 0px -32px 0px" },
  );
  stuck.observe(end);
  return () => {
    sizes.disconnect();
    stuck.disconnect();
  };
}

/**
 * The tools' slot layout: readout, prompt, options, safety guidance in full where a state calls for it,
 * then the dock (the controls and at most one quiet line), then what sits under it. The orb slot is
 * portaled into the shell's stage.
 */
function Layout({
  orb,
  orbButton,
  onOrbTap,
  readout,
  prompt,
  options,
  safety,
  controls,
  quiet,
  dock = "sticky",
  after,
  fine,
  fineTitle = COMMON.about,
}: LayoutSlots) {
  const { textHost, compactHeight, phone, setArmed, pressOrb } = useContext(ShellContext);
  const aboutId = useId();
  const padRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef(orbButton?.onPress);
  const armed = Boolean(orbButton);

  useLayoutEffect(() => {
    pressRef.current = orbButton?.onPress;
  });

  useEffect(() => {
    setArmed(armed);
    if (armed) padRef.current?.focus({ preventScroll: true });
    return () => setArmed(false);
  }, [armed, setArmed]);

  const face = orbButton ? (
    <button
      ref={padRef}
      type="button"
      aria-label={orbButton.label}
      className="nv-minute-pad"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus({ preventScroll: true });
        pressRef.current?.();
      }}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          pressRef.current?.();
        }
      }}
    >
      {orb}
    </button>
  ) : onOrbTap ? (
    <>
      {orb}
      {/* The resting orb looks pressable, so a tap on it starts too. A pointer shortcut only: it has no
          name and takes no focus, and Start stays the control for everyone else. It fires on the click,
          never on touch-down. */}
      <span
        aria-hidden
        className="nv-minute-orbtap"
        onClick={onOrbTap}
        onPointerDown={(e) => {
          if (e.button === 0) pressOrb(true);
        }}
        onPointerUp={() => pressOrb(false)}
        onPointerLeave={() => pressOrb(false)}
        onPointerCancel={() => pressOrb(false)}
      />
    </>
  ) : (
    orb
  );

  return (
    <div className="nv-minute-layout" data-dock={dock}>
      {textHost ? createPortal(face, textHost) : null}
      {/* Everything down to the controls. On portrait phones it reaches the screen's bottom edge while the
          controls dock, so they rest there in the thumb zone and what follows starts below the fold. */}
      <div className="nv-minute-main">
        {readout ? (
          <div data-nv-in="readout" className="nv-minute-readout">
            {readout}
          </div>
        ) : null}
        {prompt ? (
          <div data-nv-in="prompt" className="nv-minute-prompt">
            {prompt}
          </div>
        ) : null}
        {options ? (
          <div data-nv-in="options" className="nv-minute-options">
            {options}
          </div>
        ) : null}
        {safety ? (
          <div data-nv-in="safety" className="nv-minute-safety">
            {safety}
          </div>
        ) : null}
        {/* The dock: the controls and one quiet line, never a box. It sticks to the bottom of the sheet
            whenever the content runs past it (portrait phones rest it there); in "flow" it simply follows
            the content (experience.css). */}
        <div ref={attachDock} data-nv-in="controls" className="nv-minute-controls">
          {controls}
          {quiet ? <div className="nv-minute-quietline">{quiet}</div> : null}
        </div>
        <span aria-hidden className="nv-minute-dock-end" />
      </div>
      {after ? (
        <div data-nv-in="after" className="nv-minute-after">
          {after}
        </div>
      ) : null}
      {fine ? (
        phone || compactHeight ? (
          <div data-nv-in="fine" className="nv-minute-about">
            <Disclosure id={`nv-minute-about${aboutId}`} variant="dark" title={fineTitle}>
              {fine}
            </Disclosure>
          </div>
        ) : (
          <div data-nv-in="fine" className="nv-minute-fine">
            {fine}
          </div>
        )
      ) : null}
    </div>
  );
}

type SheetProps = {
  open: boolean;
  tool: ToolId;
  onToolChange(tool: ToolId): void;
  origin?(): HTMLElement | null;
  titleRef: RefObject<HTMLHeadingElement | null>;
  requestClose(style: CloseStyle): void;
  closeStyle(): CloseStyle;
  onHandoff(completed: boolean): void;
  /** Bumped after every close: the tools remount fresh for the next open. */
  generation: number;
  /** Hands the dialog the running session's answer to Back (true: it paused instead), or null. */
  setBack(ask: (() => boolean) | null): void;
};

/**
 * Everything inside the popup. It stays mounted while closed (the portal keeps it, hidden), so a
 * tap only plays the opening; the tools remount after each close, so every open starts fresh.
 */
function Sheet({
  open,
  tool,
  onToolChange,
  origin,
  titleRef,
  requestClose,
  closeStyle,
  onHandoff,
  generation,
  setBack,
}: SheetProps) {
  const reducedMotion = usePrefersReducedMotion();
  // The OS setting or the visitor's pause: opening and closing are the 160 ms crossfade (§1.15). Everything
  // else (the ring, tones, scrolling, the tools) keeps the OS setting only, so a session still runs under the pause.
  const quietOpen = useMotionPaused();
  const coarse = useMedia("(pointer: coarse)");
  const compactHeight = useMedia("(height < 700px)");
  const phone = useMedia("(width < 40rem)");
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [textHost, setTextHost] = useState<HTMLDivElement | null>(null);
  const [vibrationOk] = useState(canVibrate);
  const [ring] = useState(createRing);
  const [scene] = useState(createScene);
  const { values: v, tones, binds } = scene;
  const sessionActive = activeTool === tool;
  // The top bar's Sound belongs to the tool on screen: Breathe's pacing chimes, or the others' end chime.
  const soundOn = prefs.toolSound[tool];
  const [soundHint, setSoundHint] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const phaseRef = useRef<Phase>("closed");
  const toneRef = useRef<Tone>(TOOL_TONE[tool]);
  const armedRef = useRef(false);
  const sessionRef = useRef(false);
  const completedRef = useRef(false);
  /** When the last session ended by itself (performance.now()), 0 once its quiet seconds are spent. */
  const doneAtRef = useRef(0);
  const hintTimerRef = useRef(0);
  const hiddenPearlRef = useRef<{ el: HTMLElement; visibility: string } | null>(null);
  const lastAnnounceRef = useRef({ text: "", at: 0 });
  const timersRef = useRef<number[]>([]);
  const closeTokenRef = useRef(0);

  useLayoutEffect(() => {
    sessionRef.current = sessionActive;
  });

  const later = useCallback((ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const showPearl = useCallback(() => {
    const hidden = hiddenPearlRef.current;
    if (!hidden) return;
    hidden.el.style.visibility = hidden.visibility;
    hiddenPearlRef.current = null;
  }, []);

  const toneTo = useCallback(
    (next: Tone, instant = false) => {
      toneRef.current = next;
      for (const t of TONES) {
        const to = t === next ? TONE_LIGHT : 0;
        if (instant || reducedMotion) tones[t].jump(to);
        else tween(tones[t], to, 0.6, STANDARD);
      }
    },
    [reducedMotion, tones],
  );

  // One mint ripple from the orb's edge: when it lands at the opening, and at a session's end. Once
  // faded, the ring shrinks back so its 2.4 D box stops reaching past the sheet.
  const ripple = useCallback(
    (k: number) => {
      v.rippleScale.jump(REST_SCALE);
      v.rippleOpacity.jump(0.45);
      tween(v.rippleScale, 2.4, 1.4 * k, CALM).finished.then(() => v.rippleScale.jump(REST_SCALE));
      tween(v.rippleOpacity, 0, 1.4 * k, CALM);
    },
    [v],
  );

  /* ---- Opening --------------------------------------------------------------------------- */
  const playOpen = useCallback(
    (retarget: boolean) => {
      const stage = stageRef.current;
      const orbEl = orbRef.current;
      const bloomEl = bloomRef.current;
      const ui = uiRef.current;
      if (!stage || !orbEl || !bloomEl || !ui) return;
      // Base UI shows the kept-mounted popup in the layout pass after this one; show it now so
      // the stage can be measured. The first frame is painted after both, so nothing flashes.
      const popup = rootRef.current?.parentElement;
      if (popup?.hidden) popup.hidden = false;
      // Focus is inside from the first frame (Base UI would move it a frame later).
      titleRef.current?.focus({ preventScroll: true });
      clearTimers();
      phaseRef.current = "opening";
      ring.setStepped(reducedMotion);
      ring.measure();
      // Not needed for the first frame: the history entry (Back closes).
      requestAnimationFrame(() => {
        if (phaseRef.current === "opening" || phaseRef.current === "open") pushMinuteEntry();
      });
      // The sheet stays mounted between opens and would keep its scroll: every open starts at the top,
      // before the stage is measured, with nothing left over from the last ending.
      ui.scrollTop = 0;
      ui.scrollLeft = 0;
      ui.removeAttribute("data-scrolled");
      ui.removeAttribute("data-settling");
      doneAtRef.current = 0;

      // The same choreography on every open, a little quicker after the first (the CSS stagger reads --nv-k).
      if (!retarget) opens += 1;
      const k = pace() * (opens > 1 ? REPEAT_PACE : 1);
      ui.style.setProperty("--nv-k", String(k));
      const box = stage.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const d = orbEl.offsetWidth || 1;
      const from = retarget ? null : readOrigin(origin?.());

      if (!retarget) {
        const bx = from?.x ?? cx;
        const by = from?.y ?? cy;
        bloomEl.style.left = `${bx}px`;
        bloomEl.style.top = `${by}px`;
        v.cover.jump(coverScale(bx, by));
      }

      if (quietOpen) {
        // A 160ms crossfade of the finished scene: no bloom, flight, ripple or stagger.
        stopAll(scene.all);
        if (!retarget) {
          ring.refill(0, 0);
          v.glow.jump(1);
          v.breath.jump(0.12);
          v.fieldDim.jump(0);
          v.textRecede.jump(1);
          v.orbDim.jump(1);
          v.lift.jump(0);
          v.scale.jump(REST_SCALE);
        }
        v.dim.jump(1);
        v.bloomFade.jump(1);
        v.bloom.jump(v.cover.get());
        v.surfaceY.jump(0);
        v.fieldIn.jump(1);
        v.haloIn.jump(1);
        v.haloScale.jump(1);
        v.rippleOpacity.jump(0);
        v.flyX.jump(0);
        v.flyY.jump(0);
        v.flyScale.jump(1);
        v.skin.jump(0);
        v.orbIn.jump(1);
        v.textIn.jump(1);
        if (!retarget) v.root.jump(0);
        tween(v.root, 1, 0.16, "linear");
        ui.dataset.ui = "in";
        ui.dataset.ready = "";
        phaseRef.current = "open";
        return;
      }

      v.root.jump(1);
      // A swipe-close leaves the sheet below the screen.
      if (retarget) spring(v.surfaceY, 0, 0.42 * k, 0);
      else v.surfaceY.jump(0);
      if (!retarget) {
        // A fresh stage: whatever the last session left (a part-drawn ring, a receded orb, a dimmed
        // field) is reset before the first frame.
        ring.refill(0, 0);
        v.glow.jump(1);
        v.breath.jump(0.12);
        v.fieldDim.jump(0);
        v.textRecede.jump(1);
        v.orbDim.jump(1);
        v.lift.jump(0);
        v.scale.jump(REST_SCALE);
        v.dim.jump(0);
        v.bloomFade.jump(0);
        v.bloom.jump(from ? 1 : 0.4);
        v.fieldIn.jump(0);
        v.haloIn.jump(0);
        v.haloScale.jump(0.6);
        v.rippleOpacity.jump(0);
        v.textIn.jump(0);
        if (from) {
          // The clone sits exactly on the launcher's pearl, so the first frame changes nothing.
          v.flyX.jump(from.x - cx);
          v.flyY.jump(from.y - cy);
          v.flyScale.jump(from.size / (d * v.scale.get()));
          v.skin.jump(1);
          v.orbIn.jump(1);
          if (from.pearl) {
            const pearl = from.pearl;
            requestAnimationFrame(() => {
              if (phaseRef.current === "closing" || hiddenPearlRef.current) return;
              hiddenPearlRef.current = { el: pearl, visibility: pearl.style.visibility };
              pearl.style.visibility = "hidden";
            });
          }
        } else {
          v.flyX.jump(0);
          v.flyY.jump(0);
          v.flyScale.jump(0.86);
          v.skin.jump(0);
          v.orbIn.jump(0);
        }
      }

      const springK = (value: MotionValue<number>, to: number, vd: number, bounce: number, delay = 0) =>
        spring(value, to, vd * k, bounce, { delay: delay * k });
      const tweenK = (value: MotionValue<number>, to: number, s: number, ease: Ease, delay = 0) =>
        tween(value, to, s * k, ease, { delay: delay * k });

      tweenK(v.dim, 1, 0.32, CALM);
      tweenK(v.bloomFade, 1, 0.14, "linear");
      springK(v.bloom, v.cover.get(), 0.62, 0);
      const flies = Boolean(from) || (retarget && Math.hypot(v.flyX.get(), v.flyY.get()) > 2);
      const lead = retarget ? 0 : 0.08;
      if (flies) {
        // It slides, then rises: x settles sooner than y, so the path is an arc.
        springK(v.flyX, 0, 0.72, 0.06, lead);
        springK(v.flyY, 0, 0.96, 0.12, lead);
        springK(v.flyScale, 1, 1, 0.14, lead);
        tweenK(v.skin, 0, 0.7, "easeInOut", retarget ? 0 : 0.18);
        tweenK(v.orbIn, 1, 0.2, "linear");
      } else {
        tweenK(v.orbIn, 1, 0.6, CALM, 0.18);
        springK(v.flyScale, 1, 0.9, 0.1, 0.18);
        springK(v.flyX, 0, 0.5, 0);
        springK(v.flyY, 0, 0.5, 0);
        tweenK(v.skin, 0, 0.3, "linear");
      }
      springK(v.scale, REST_SCALE, 0.6, 0);
      springK(v.lift, 0, 0.6, 0);
      tweenK(v.haloIn, 1, 0.8, CALM, retarget ? 0 : 0.26);
      tweenK(v.haloScale, 1, 0.8, CALM, retarget ? 0 : 0.26);
      tweenK(v.fieldIn, 1, 1.2, "easeOut", retarget ? 0 : 0.4);
      tweenK(v.textIn, 1, 0.45, CALM, retarget ? 0.2 : 0.72);

      // The stagger runs on CSS transitions (experience.css), so a close reverses each in place. Measuring the
      // stage above, with the popup shown, gave every part its hidden style, so the transitions start now
      // rather than a frame later.
      ui.dataset.ui = "in";

      // One mint ripple when the orb lands (its rise settles within 2px at about 950ms).
      if (!retarget) {
        later((flies ? 950 : 640) * k, () => {
          if (phaseRef.current !== "closing") ripple(k);
        });
      }
      later(1600 * k, () => {
        if (phaseRef.current !== "opening") return;
        phaseRef.current = "open";
        ui.dataset.ready = "";
      });
    },
    [clearTimers, later, origin, quietOpen, reducedMotion, ring, ripple, scene, titleRef, v],
  );

  /* ---- Closing (the handoff within 350ms) -------------------------------------------------- */
  const playClose = useCallback(() => {
    const stage = stageRef.current;
    const orbEl = orbRef.current;
    const bloomEl = bloomRef.current;
    const ui = uiRef.current;
    // Esc mid-opening turns everything around from where it is: no step waits on a delay.
    clearTimers();
    phaseRef.current = "closing";
    const token = ++closeTokenRef.current;
    window.clearTimeout(hintTimerRef.current);
    setSoundHint(false);
    const k = pace();
    if (ui) {
      ui.style.setProperty("--nv-k", String(k));
      ui.dataset.ui = "out";
      delete ui.dataset.ready;
    }
    sound.fadeOut(CLOSE_MS * k);
    const handoff = (land?: () => void) => {
      if (phaseRef.current !== "closing" || token !== closeTokenRef.current) return;
      phaseRef.current = "closed";
      stopAll(scene.all);
      land?.();
      showPearl();
      setActiveTool(null);
      onHandoff(completedRef.current);
      completedRef.current = false;
    };

    if (quietOpen || !stage || !orbEl || !bloomEl) {
      tween(v.root, 0, 0.16, "linear");
      later(170, () => handoff());
      return;
    }
    const springK = (value: MotionValue<number>, to: number, vd: number, bounce: number, delay = 0) =>
      spring(value, to, vd * k, bounce, { delay: delay * k });
    const tweenK = (value: MotionValue<number>, to: number, s: number, ease: Ease, delay = 0) =>
      tween(value, to, s * k, ease, { delay: delay * k });

    const style = closeStyle();
    if (style.kind === "swipe") {
      // The sheet keeps the finger's speed on its way down; the page brightens behind it.
      spring(v.surfaceY, window.innerHeight, 0.28 * k, 0, { velocity: Math.max(0, style.speed) });
      tweenK(v.dim, 0, 0.26, EXIT);
      later(CLOSE_MS * k, () => handoff());
      return;
    }

    tweenK(v.textIn, 0, 0.12, EXIT);
    tweenK(v.haloIn, 0, 0.2, EXIT);
    tweenK(v.fieldIn, 0, 0.2, EXIT);
    tweenK(v.rippleOpacity, 0, 0.12, EXIT);

    const box = stage.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const d = orbEl.offsetWidth || 1;
    const to = readOrigin(origin?.());
    if (!to?.pearl) {
      // Nowhere to land (no pearl on screen): the orb fades where it is and the pond drains to its origin.
      tweenK(v.orbIn, 0, 0.2, EXIT);
      tweenK(v.flyScale, v.flyScale.get() * 0.9, 0.2, EXIT);
      springK(v.bloom, 0.4, 0.24, 0, 0.04);
      tweenK(v.bloomFade, 0, 0.14, EXIT, 0.14);
      tweenK(v.dim, 0, 0.18, EXIT, 0.1);
      later(CLOSE_MS * k, () => handoff());
      return;
    }
    // Re-centre the pond on the landing point while it still covers the screen, so it contracts
    // into the pearl the orb is heading for.
    if (v.bloom.get() >= v.cover.get() * 0.99) {
      bloomEl.style.left = `${to.x}px`;
      bloomEl.style.top = `${to.y}px`;
      v.cover.jump(coverScale(to.x, to.y));
      v.bloom.jump(v.cover.get());
    }
    const target = { x: to.x - cx, y: to.y - cy, scale: to.size / (d * REST_SCALE) };
    // Short, critically damped springs: the orb is home in about 200ms, and a retarget keeps its velocity.
    // Everything else ends with the handoff (CLOSE_MS), so nothing is cut short when the popup hides.
    springK(v.flyX, target.x, 0.2, 0);
    springK(v.flyY, target.y, 0.2, 0);
    springK(v.flyScale, target.scale, 0.2, 0);
    springK(v.scale, REST_SCALE, 0.2, 0);
    springK(v.lift, 0, 0.2, 0);
    tweenK(v.skin, 1, 0.2, "easeInOut", 0.04);
    tweenK(v.orbIn, 1, 0.1, "linear");
    springK(v.bloom, to.size / BLOOM, 0.24, 0, 0.04);
    tweenK(v.bloomFade, 0, 0.14, EXIT, 0.14);
    tweenK(v.dim, 0, 0.18, EXIT, 0.1);
    // The handoff waits until the orb sits on the pearl (within a pixel; at most until CLOSE_MS), then
    // sets it exactly there, so the real pearl takes over without a jump.
    const land = () => {
      v.flyX.jump(target.x);
      v.flyY.jump(target.y);
      v.flyScale.jump(target.scale);
      v.scale.jump(REST_SCALE);
      v.lift.jump(0);
      v.skin.jump(1);
    };
    const landed = () =>
      Math.abs(v.flyX.get() - target.x) < 1 &&
      Math.abs(v.flyY.get() - target.y) < 1 &&
      Math.abs(v.flyScale.get() - target.scale) * d * REST_SCALE < 1;
    later(LAND_MS * k, () => {
      const deadline = performance.now() + (CLOSE_MS - LAND_MS) * k;
      const wait = () => {
        if (landed() || performance.now() >= deadline) handoff(land);
        else requestAnimationFrame(wait);
      };
      wait();
    });
  }, [clearTimers, closeStyle, later, onHandoff, origin, quietOpen, scene, showPearl, v]);

  // Only a change of `open` plays a timeline; the latest closures are read through a ref.
  const playRef = useRef({ open: playOpen, close: playClose });
  useLayoutEffect(() => {
    playRef.current = { open: playOpen, close: playClose };
  });
  useLayoutEffect(() => {
    if (open) playRef.current.open(phaseRef.current === "closing");
    else if (phaseRef.current !== "closed") playRef.current.close();
  }, [open]);

  // Unmount (after the handoff): stop everything, and never leave a launcher's pearl hidden.
  useEffect(
    () => () => {
      clearTimers();
      window.clearTimeout(hintTimerRef.current);
      stopAll(scene.all);
      ring.dispose();
      showPearl();
    },
    [clearTimers, ring, scene, showPearl],
  );

  useEffect(
    () =>
      onSessionDone(() => {
        completedRef.current = true;
        doneAtRef.current = performance.now();
      }),
    [],
  );

  // The page's one audio context follows the Sound of the tool on screen while the sheet is open. A
  // launcher's press still counts as a gesture, so sound left on starts with the opening; after a deep
  // link or Back it waits for the first press inside (the captures on the sheet).
  useEffect(() => {
    if (!open) return;
    if (soundOn) sound.enable();
    else sound.disable();
  }, [open, soundOn]);

  // A modal keeps focus: if something outside takes it while the scene is open (another
  // dialog's focus return, the nav sheet's for one), it comes back to the title.
  useEffect(() => {
    if (!open) return;
    const onFocusIn = (e: FocusEvent) => {
      const popup = rootRef.current?.parentElement;
      const target = e.target;
      if (!popup || !(target instanceof Element) || popup.contains(target)) return;
      if (target.hasAttribute("data-base-ui-focus-guard")) return;
      if (phaseRef.current === "opening" || phaseRef.current === "open") titleRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open, titleRef]);

  // The header's backdrop appears once the sheet scrolls (experience.css). The docked controls carry
  // their own static backdrop, so nothing here runs per frame.
  useEffect(() => {
    const sheet = uiRef.current;
    if (!sheet) return;
    const onScroll = () => sheet.toggleAttribute("data-scrolled", sheet.scrollTop > 4);
    sheet.addEventListener("scroll", onScroll, { passive: true });
    return () => sheet.removeEventListener("scroll", onScroll);
  }, []);

  // The sheet scrolls by itself only to return to the top (a session's start and end, a change of tool):
  // smoothly, or at once under reduced motion.
  const scrollSheet = useCallback(
    (top: number) => {
      const sheet = uiRef.current;
      if (!sheet) return;
      const to = Math.round(Math.max(0, Math.min(sheet.scrollHeight - sheet.clientHeight, top)));
      if (Math.abs(to - sheet.scrollTop) >= 1) sheet.scrollTo({ top: to, behavior: reducedMotion ? "instant" : "smooth" });
    },
    [reducedMotion],
  );

  // A session's start and its end both bring the sheet back to the top: the session view is the stage and
  // its controls, and a result is read from its first line. After a session that ended by itself (not
  // Stop), the tabs, the fine print and the sign-off stay away for SETTLE_MS from that end, so the ending
  // has the screen to itself; data-settling carries that (experience.css). A layout effect, so the tabs
  // never show for a frame between the two attributes.
  const sessionWasRef = useRef(false);
  useLayoutEffect(() => {
    const was = sessionWasRef.current;
    sessionWasRef.current = sessionActive;
    const sheet = uiRef.current;
    if (!sheet || was === sessionActive || (phaseRef.current !== "opening" && phaseRef.current !== "open")) return;
    scrollSheet(0);
    if (sessionActive) {
      sheet.removeAttribute("data-settling");
      return;
    }
    const wait = doneAtRef.current ? SETTLE_MS - (performance.now() - doneAtRef.current) : 0;
    doneAtRef.current = 0;
    if (wait <= 0) return;
    sheet.setAttribute("data-settling", "");
    later(wait, () => sheet.removeAttribute("data-settling"));
  }, [sessionActive, scrollSheet, later]);

  // A new tool gets a fresh stage: its tone, the bare ring and the orb at rest, from the top of the
  // sheet. Before the scene is open (a launcher that names another tool), the tone simply starts as
  // the tool's.
  useEffect(() => {
    const instant = phaseRef.current !== "open";
    toneTo(TOOL_TONE[tool], instant);
    if (instant) return;
    if (!sessionRef.current) scrollSheet(0);
    ring.refill(0, 600);
    if (!reducedMotion) spring(v.scale, REST_SCALE, 0.6, 0);
    spring(v.lift, 0, 0.6, 0);
    tween(v.textRecede, 1, 0.3);
    tween(v.orbDim, 1, 0.3);
    tween(v.glow, 1, 0.3);
    tween(v.fieldDim, 0, 0.4);
    tween(v.breath, 0.12, 0.4);
  }, [tool, toneTo, ring, reducedMotion, scrollSheet, v]);

  useEffect(() => {
    const onResize = () => {
      ring.measure();
      const bloomEl = bloomRef.current;
      if (!bloomEl || phaseRef.current === "closing") return;
      const x = parseFloat(bloomEl.style.left) || 0;
      const y = parseFloat(bloomEl.style.top) || 0;
      const atCover = v.bloom.get() >= v.cover.get() * 0.99;
      v.cover.jump(coverScale(x, y));
      if (atCover) v.bloom.jump(v.cover.get());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ring, v]);

  // Swipe down to close, on touch: the handle and the header.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || !coarse) return;
    return attachSwipe(zone, {
      enabled: () => phaseRef.current !== "closing" && !sessionRef.current && !armedRef.current,
      move(offset) {
        stopAll([v.surfaceY, v.dim]);
        v.surfaceY.set(offset);
        v.dim.set(1 - clamp01(offset / (window.innerHeight * 0.75)));
      },
      end(offset, speed) {
        if (offset > 120 || speed > 800) {
          requestClose({ kind: "swipe", speed });
          return;
        }
        spring(v.surfaceY, 0, 0.3, 0.2, { velocity: speed });
        tween(v.dim, 1, 0.3, CALM);
      },
    });
  }, [coarse, requestClose, v]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => setPrefsState(savePrefs(patch)), []);

  const announce = useCallback((text: string, o?: { force?: boolean }) => {
    const el = liveRef.current;
    if (!el) return;
    const now = performance.now();
    const last = lastAnnounceRef.current;
    if (!o?.force && text === last.text && now - last.at < ANNOUNCE_GAP_MS) return;
    lastAnnounceRef.current = { text, at: now };
    el.textContent = "";
    requestAnimationFrame(() => {
      if (liveRef.current) liveRef.current.textContent = text;
    });
  }, []);

  const api = useMemo<ExperienceApi>(() => {
    // Only an opening or open scene takes writes: a session still running in a closing (or closed,
    // not yet remounted) tool never moves the orb, chimes or announces.
    const live = () => phaseRef.current === "opening" || phaseRef.current === "open";
    return {
      orb: {
        setScale(x) {
          if (!live() || reducedMotion) return;
          // A frame's own value wins over a spring still easing the orb toward rest.
          settle(v.scale);
          v.scale.set(x);
        },
        spring(x, o) {
          if (live() && !reducedMotion) spring(v.scale, x, o?.visualDuration ?? 0.5, o?.bounce ?? 0);
        },
        setTone(t) {
          if (t !== toneRef.current) toneTo(t);
        },
        setGlow(x) {
          if (live()) v.glow.set(clamp01(x));
        },
        recede(on) {
          if (!live()) return;
          tween(v.textRecede, on ? 0 : 1, on ? 0.5 : 0.6, CALM);
          if (reducedMotion) {
            // Dims without receding.
            tween(v.orbDim, on ? 0.35 : 1, 0.4, CALM);
          } else if (on) {
            tween(v.scale, 0.14, 1.4, CALM);
            tween(v.lift, -40, 1.4, CALM);
          } else {
            spring(v.scale, REST_SCALE, 0.9, 0.1);
            spring(v.lift, 0, 0.9, 0.1);
          }
        },
        flash() {
          if (live()) tween(tones[toneRef.current], [TONE_LIGHT, 0.9, TONE_LIGHT], 0.26, "easeOut", { times: [0, 0.3, 1] });
        },
        ripple() {
          if (live() && !reducedMotion) ripple(1);
        },
      },
      ring: {
        setRemaining(f, glideMs) {
          if (live()) ring.setRemaining(f, glideMs);
        },
        refill(f, ms) {
          if (live()) ring.refill(f, ms);
        },
      },
      field: {
        setBreath(x) {
          if (live()) v.breath.set(0.12 + 0.12 * clamp01(x));
        },
        setDim(x) {
          if (live()) tween(v.fieldDim, clamp01(x), reducedMotion ? 0.4 : 1.4, CALM);
        },
        brighten() {
          if (!live()) return;
          tween(v.fieldDim, 0, 0.6, CALM);
          tween(v.breath, [v.breath.get(), 0.3, 0.12], 0.6, "easeOut", { times: [0, 0.4, 1] });
        },
      },
      sound: {
        enabled: soundOn,
        chime(kind) {
          if (live()) sound.chime(kind);
        },
        tick() {
          if (live()) sound.tick();
        },
      },
      haptics: {
        supported: vibrationOk,
        enabled: vibrationOk && prefs.vibration,
        buzz(kind) {
          if (vibrationOk && prefs.vibration && live()) vibrate(kind);
        },
      },
      announce(text, o) {
        if (live()) announce(text, o);
      },
      setSessionActive(active, o) {
        setBack(active ? (o?.onBack ?? null) : null);
        setActiveTool(active ? tool : null);
      },
      reducedMotion,
      coarse,
      compactHeight,
      prefs,
      setPrefs,
      switchTool(id) {
        if (!TOOL_ENABLED[id] || sessionRef.current) return;
        onToolChange(id);
        // The link that asked leaves with its panel: focus goes to the new tool's tab, never the page
        // (the sheet returns to the top with the new tool).
        requestAnimationFrame(() => {
          uiRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
        });
      },
      close() {
        requestClose({ kind: "orb" });
      },
    };
  }, [
    announce,
    coarse,
    compactHeight,
    onToolChange,
    prefs,
    reducedMotion,
    requestClose,
    ring,
    ripple,
    setBack,
    setPrefs,
    soundOn,
    tones,
    tool,
    toneTo,
    v,
    vibrationOk,
  ]);

  const setArmed = useCallback((on: boolean) => {
    armedRef.current = on;
  }, []);

  // The resting orb gives under a press and comes back on release. Once a session has the orb, its own
  // scale is the only one.
  const pressOrb = useCallback(
    (down: boolean) => {
      if (reducedMotion || sessionRef.current || (phaseRef.current !== "opening" && phaseRef.current !== "open")) return;
      spring(v.scale, REST_SCALE * (down ? PRESS_SCALE : 1), down ? 0.09 : 0.18, 0);
    },
    [reducedMotion, v],
  );

  // Sound, switched on: the "in" chime plays at once, and for a few seconds a line by the control says
  // where to look if nothing was heard. Never a sound or a buzz while a pulse is being counted; the
  // control itself still switches.
  const toggleSound = useCallback(() => {
    const on = !soundOn;
    const counting = tool === "pulse" && sessionRef.current;
    window.clearTimeout(hintTimerRef.current);
    if (on) {
      if (counting) sound.enable();
      else sound.preview();
      setSoundHint(true);
      hintTimerRef.current = window.setTimeout(() => setSoundHint(false), SOUND_HINT_MS);
      announce(SOUND_HINT, { force: true });
    } else {
      sound.disable();
      setSoundHint(false);
    }
    setPrefs({ toolSound: { ...prefs.toolSound, [tool]: on } });
  }, [announce, prefs.toolSound, setPrefs, soundOn, tool]);
  const toggleVibration = useCallback(() => {
    const on = !prefs.vibration;
    if (on && !(tool === "pulse" && sessionRef.current)) vibrate("tap");
    setPrefs({ vibration: on });
  }, [prefs.vibration, setPrefs, tool]);

  const shell = useMemo<Shell>(
    () => ({ textHost, compactHeight, phone, setArmed, pressOrb }),
    [textHost, compactHeight, phone, setArmed, pressOrb],
  );

  const {
    root: rootBind,
    dim: dimBind,
    surface: surfaceBind,
    field: fieldBinds,
    stage: stageBinds,
    orb: orbStyle,
    text: textStyle,
    bloom: bloomStyle,
  } = binds;
  const attachStage = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el;
  }, []);
  const attachRoot = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      return rootBind(el);
    },
    [rootBind],
  );
  const attachOrb = useCallback(
    (el: HTMLDivElement | null) => {
      orbRef.current = el;
      return el ? styleEffect(el, orbStyle) : undefined;
    },
    [orbStyle],
  );
  const attachText = useCallback(
    (el: HTMLDivElement | null) => {
      setTextHost(el);
      return el ? styleEffect(el, textStyle) : undefined;
    },
    [textStyle],
  );
  const attachBloom = useCallback(
    (el: HTMLDivElement | null) => {
      bloomRef.current = el;
      return bloomStyle(el);
    },
    [bloomStyle],
  );

  return (
    <div ref={attachRoot} className="nv-minute-root">
      <div ref={dimBind} aria-hidden className="nv-minute-dim" />
      <div ref={surfaceBind} className="nv-minute-surface">
        <div ref={attachBloom} aria-hidden className="nv-minute-bloom" />
        <div className="nv-minute-fieldbox">
          <Field binds={fieldBinds} />
        </div>
        <div
          ref={uiRef}
          className="theme-pine nv-minute-sheet"
          data-session={sessionActive ? "" : undefined}
          onPointerDownCapture={wakeSound}
          onClickCapture={wakeSound}
          onKeyDownCapture={wakeSound}
        >
          <div ref={zoneRef} data-nv-in="top" className="nv-minute-top">
            <span aria-hidden className="nv-minute-handle" />
            {/* One sticky row: the title (first in the markup, as the dialog's heading), then Sound and
                Vibration, then Close. Icon buttons on phones, labelled from 640px (experience.css). */}
            <div className="nv-minute-bar">
              <Dialog.Title ref={titleRef} tabIndex={-1} data-nv-in="title" className="nv-minute-title">
                Take a minute.
              </Dialog.Title>
              {/* Toggle buttons: a constant name with aria-pressed; the icon shows the state. */}
              <div className="nv-minute-toggles">
                <button type="button" aria-pressed={soundOn} className="nv-minute-toggle" onClick={toggleSound}>
                  {soundOn ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
                  <span className="nv-minute-toggle-name">Sound</span>
                </button>
                {vibrationOk ? (
                  <button type="button" aria-pressed={prefs.vibration} className="nv-minute-toggle" onClick={toggleVibration}>
                    {prefs.vibration ? <Vibrate aria-hidden /> : <VibrateOff aria-hidden />}
                    <span className="nv-minute-toggle-name">Vibration</span>
                  </button>
                ) : null}
              </div>
              <Dialog.Close aria-label="Close" className="nv-minute-close">
                <X aria-hidden />
              </Dialog.Close>
            </div>
            {/* The live region says it once; this is its visible twin, beside the control. */}
            <p aria-hidden className="nv-minute-hint" data-on={soundHint ? "" : undefined}>
              {SOUND_HINT}
            </p>
          </div>
          <div className="nv-minute-col">
            <Dialog.Description className="sr-only">{DESCRIPTION}</Dialog.Description>
            <ShellContext.Provider value={shell}>
              <Tabs.Root
                value={tool}
                onValueChange={(value) => {
                  if (isToolId(value) && !sessionRef.current) onToolChange(value);
                }}
                className="nv-minute-tabs-root"
              >
                <div data-nv-in="tabs" className="nv-minute-tabsbox">
                  <Tabs.List aria-label="Timers" className="nv-minute-tabs" inert={sessionActive}>
                    {/* Names only. Each tab's accessible name starts with that name and adds the length
                        (TOOL_SPOKEN); the panel takes its own name from the tab. */}
                    {ENABLED_TOOLS.map((id) => (
                      <Tabs.Tab
                        key={id}
                        value={id}
                        aria-label={TOOL_SPOKEN[id]}
                        data-gap={id === FIRST_READING ? "" : undefined}
                        className="nv-minute-tab"
                      >
                        {TOOL_LABEL[id]}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </div>
                <Stage
                  binds={stageBinds}
                  attachStage={attachStage}
                  attachOrb={attachOrb}
                  attachText={attachText}
                  attachRingSvg={ring.attachSvg}
                  attachRingArc={ring.attachArc}
                />
                {ENABLED_TOOLS.map((id) => {
                  const Tool = TOOL_VIEWS[id] ?? TOOLS[id];
                  return (
                    <Tabs.Panel key={id} value={id} className="nv-minute-panel">
                      <Tool key={generation} api={api} Layout={Layout} />
                    </Tabs.Panel>
                  );
                })}
              </Tabs.Root>
            </ShellContext.Provider>
            <p data-nv-in="signoff" className="nv-minute-signoff">
              From Nivar&apos;s nurses.
            </p>
          </div>
        </div>
      </div>
      <p ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}

/** The lazy chunk's entry (open.ts prefetchTakeAMinute; the corner cluster renders it). */
export function Experience({
  open,
  tool,
  onToolChange,
  onOpenChange,
  returnFocus,
  origin,
  onClosed,
}: ExperienceProps) {
  const [container] = useState(() => document.querySelector<HTMLElement>("[data-landing]"));
  const actionsRef = useRef<Dialog.Root.Actions | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const styleRef = useRef<CloseStyle>({ kind: "orb" });
  const backRef = useRef<(() => boolean) | null>(null);
  const [generation, setGeneration] = useState(0);

  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  });

  // ✕, Esc, Done and swipe close at once and step back over our history entry; Back closes from
  // popstate, unless a session that can pause takes it first. Every close goes through Base UI's
  // onOpenChange below.
  const requestClose = useCallback((style: CloseStyle) => {
    styleRef.current = style;
    actionsRef.current?.close();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      if (!openRef.current || isMinuteEntry()) return;
      // A stray Back gesture mid-session pauses it rather than throwing it away: the entry Back just
      // consumed goes back on, and the next Back closes.
      if (backRef.current?.()) pushMinuteEntry();
      else actionsRef.current?.close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  const closeStyle = useCallback(() => styleRef.current, []);
  const setBack = useCallback((ask: (() => boolean) | null) => {
    backRef.current = ask;
  }, []);
  const onHandoff = useCallback(
    (completed: boolean) => {
      styleRef.current = { kind: "orb" };
      actionsRef.current?.unmount();
      onClosed?.({ completed });
      // Fresh tools for the next open, rendered in the background.
      startTransition(() => setGeneration((g) => g + 1));
    },
    [onClosed],
  );

  return (
    <Dialog.Root
      open={open}
      modal
      disablePointerDismissal
      actionsRef={actionsRef}
      onOpenChange={(next, details) => {
        if (next) return;
        // The close timeline runs first; Sheet calls actionsRef.unmount() when it ends.
        details.preventUnmountOnClose();
        if (details.reason !== "imperative-action") styleRef.current = { kind: "orb" };
        onOpenChange(false);
        // A close from the UI consumes the entry the opening pushed; from Back it is already gone.
        if (isMinuteEntry()) window.history.back();
      }}
    >
      <Dialog.Portal container={container} keepMounted>
        <Dialog.Popup
          data-landing=""
          aria-modal="true"
          className="nv-minute-popup"
          initialFocus={titleRef}
          finalFocus={() => returnFocus() ?? true}
        >
          <Sheet
            open={open}
            tool={tool}
            onToolChange={onToolChange}
            origin={origin}
            titleRef={titleRef}
            requestClose={requestClose}
            closeStyle={closeStyle}
            onHandoff={onHandoff}
            generation={generation}
            setBack={setBack}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Experience;
