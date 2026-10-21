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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FC,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "../motion";
import { bindStyle, spring, stopAll, tween, type Ease } from "./anim";
import { ENABLED_TOOLS, TOOL_ENABLED, TOOL_LABEL, TOOL_TONE, isToolId } from "./config";
import { onSessionDone } from "./engine";
import { Field, createMotes, moteCount } from "./field";
import { canVibrate, vibrate } from "./haptics";
import { isMinuteEntry, pushMinuteEntry } from "./history";
import { Stage, TONES } from "./orb";
import { loadPrefs, savePrefs } from "./prefs";
import { createRing } from "./ring";
import { sound } from "./sound";
import { attachSwipe } from "./swipe";
import { TOOLS } from "./tools";
import type { ExperienceApi, LayoutSlots, Prefs, Tone, ToolId, ToolProps } from "./types";
import "./experience.css";

/* Take a minute, the lazy chunk (spec §5). A Base UI modal dialog portaled into [data-landing] and
   drawn by motion values: the launcher's pearl blooms into a pond, flies up into the orb, lands
   with one ripple, and the time-left ring draws in (§5.8); closing plays it back into the pearl
   (§5.9). Every spring retargets from its current value and velocity, so Esc mid-flight simply
   turns the motion around. The tools (tools/, U8) render through Layout and drive the stage
   through the ExperienceApi; nothing they do goes through React state per frame. */

export type ExperienceProps = {
  open: boolean;
  /** The tool to show, already resolved by the cluster (enabled; "" mapped to the last used). */
  tool: ToolId;
  onToolChange(tool: ToolId): void;
  /** false: the close has started (its timeline then runs for about 680ms). */
  onOpenChange(open: boolean): void;
  /** Where focus goes on close: the launcher while it is still in the page, else the corner button. */
  returnFocus(): HTMLElement | null;
  /** The element the orb flies from and back to: a pearl, or a launcher. Read at open and close. */
  origin?(): HTMLElement | null;
  /** The close timeline has finished, the dialog has left, and focus is back (the §5.9 handoff). */
  onClosed?(info: { completed: boolean }): void;
};

type CloseStyle = { kind: "orb" } | { kind: "swipe"; speed: number };
type Phase = "closed" | "opening" | "open" | "closing";
type Origin = { x: number; y: number; size: number; pearl: HTMLElement | null };

const DESCRIPTION = `Timers for your body: ${[
  "a breathing guide",
  "a five-minute rest before a blood pressure reading",
  ...(TOOL_ENABLED.pulse ? ["a pulse count"] : []),
].join(", ")} and a 20-second eye break.`;

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
/** Room kept between what a scroll brings into view and the top bar or the screen's bottom edge. */
const CLEAR = 12;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The part of the sheet that shows: below the sticky top bar, above the screen's bottom edge. */
type View = { top: number; bottom: number };

/**
 * Where the sheet scrolls when a session starts (K3): the stage (the orb on its ring), the time left and
 * the first control (Pause) fully in view, by the shortest move; null when they already are. Rest's ticks
 * or a short screen can leave them scrolled away. A sticky stage (short landscape) is in view already.
 */
function stageScroll(sheet: HTMLElement, view: View): number | null {
  const stage = sheet.querySelector<HTMLElement>(".nv-minute-stage");
  const panel = sheet.querySelector<HTMLElement>(".nv-minute-panel");
  const controls = panel?.querySelector<HTMLElement>(".nv-minute-controls");
  const parts = [
    stage && getComputedStyle(stage).position !== "sticky" ? stage : null,
    panel?.querySelector<HTMLElement>(".nv-minute-readout"),
    controls?.querySelector<HTMLElement>(".nv-minute-primary") ?? controls?.querySelector<HTMLElement>("button"),
  ].flatMap((el) => (el ? [el.getBoundingClientRect()] : []));
  if (!parts.length) return null;
  const top = Math.min(...parts.map((r) => r.top)) - (view.top + CLEAR);
  const bottom = Math.max(...parts.map((r) => r.bottom)) - (view.bottom - CLEAR);
  if (top < 0) return sheet.scrollTop + top;
  if (bottom > 0) return sheet.scrollTop + Math.min(bottom, top);
  return null;
}

/**
 * Where the sheet scrolls when a session ends and the tabs come back (a11y-16). To the top if the focused
 * control still shows there; otherwise just far enough to show it, and then never with the tabs half under
 * the top bar: past them if focus allows, else back to them. Focus itself never moves.
 */
function tabsScroll(sheet: HTMLElement, view: View): number | null {
  const tabs = sheet.querySelector<HTMLElement>(".nv-minute-tabs")?.getBoundingClientRect();
  if (!tabs) return null;
  const now = sheet.scrollTop;
  const max = sheet.scrollHeight - sheet.clientHeight;
  const active = document.activeElement;
  const focus = active instanceof HTMLElement && sheet.contains(active) ? active.getBoundingClientRect() : null;
  // A rect measured now sits at rect.y + now - s once the sheet is scrolled to s.
  const shows = (s: number) => !focus || (focus.top + now - s >= view.top && focus.bottom + now - s <= view.bottom);
  let s = 0;
  if (!shows(0)) {
    s = now;
    if (focus && focus.bottom > view.bottom - CLEAR) s = now + focus.bottom - (view.bottom - CLEAR);
    else if (focus && focus.top < view.top + CLEAR) s = now + focus.top - (view.top + CLEAR);
    s = Math.max(0, Math.min(max, s));
    if (tabs.top + now - s < view.top && tabs.bottom + now - s > view.top) {
      const past = Math.ceil(now + tabs.bottom - view.top) + 1;
      const back = Math.max(0, now + tabs.top - (view.top + CLEAR));
      if (past <= max && shows(past)) s = past;
      else if (shows(back)) s = back;
    }
  }
  return Math.abs(s - now) < 1 ? null : s;
}

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
    ringDraw: mv(0),
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
      breath: bindStyle({ opacity: v.breath }),
      dim: bindStyle({ opacity: v.fieldDim }),
    },
    stage: {
      halo: bindStyle({ opacity: transformValue(() => v.haloIn.get() * 0.6 * v.glow.get()), scale: v.haloScale }),
      ripple: bindStyle({ opacity: v.rippleOpacity, scale: v.rippleScale }),
      fly: bindStyle({ x: v.flyX, y: v.flyY, scale: v.flyScale }),
      glow: bindStyle({ opacity: v.skin }),
      light: bindStyle({ opacity: transformValue(() => 0.25 + 0.75 * v.glow.get()) }),
      skin: bindStyle({ opacity: v.skin }),
      mint: bindStyle({ opacity: v.mint }),
      sky: bindStyle({ opacity: v.sky }),
      rose: bindStyle({ opacity: v.rose }),
      pearl: bindStyle({ opacity: v.pearl }),
    },
    orb: { scale: v.scale, y: v.lift, opacity: transformValue(() => v.orbIn.get() * v.orbDim.get()) },
    // The word appears as the orb arrives under it, whatever the timeline: within 28px of home.
    text: {
      opacity: transformValue(
        () => v.textIn.get() * v.textRecede.get() * clamp01(1 - Math.hypot(v.flyX.get(), v.flyY.get()) / 28),
      ),
    },
  };
  return { values, tones, binds, all: Object.values(values) };
}

/** The tools re-render only when the api or the shell changes, not when the dialog opens. */
const TOOL_VIEWS: Partial<Record<ToolId, FC<ToolProps>>> = Object.fromEntries(
  ENABLED_TOOLS.map((id) => [id, memo(TOOLS[id])]),
);

/** What Layout needs from the shell. */
type Shell = { textHost: HTMLDivElement | null; compactHeight: boolean; setArmed(on: boolean): void };
const ShellContext = createContext<Shell>({ textHost: null, compactHeight: false, setArmed: () => {} });

/** The tools' slot layout (spec §5.2). The orb slot is portaled into the shell's stage. */
function Layout({ orb, orbButton, readout, prompt, controls, fine, always }: LayoutSlots) {
  const { textHost, compactHeight, setArmed } = useContext(ShellContext);
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
  ) : (
    orb
  );

  return (
    <div className="nv-minute-layout">
      {textHost ? createPortal(face, textHost) : null}
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
      <div data-nv-in="controls" className="nv-minute-controls">
        {controls}
      </div>
      {fine ? (
        compactHeight ? (
          <details data-nv-in="fine" className="nv-minute-fine nv-minute-about">
            <summary>About this exercise</summary>
            <div className="nv-minute-about-body">{fine}</div>
          </details>
        ) : (
          <div data-nv-in="fine" className="nv-minute-fine">
            {fine}
          </div>
        )
      ) : null}
      {always ? (
        <div data-nv-in="always" className="nv-minute-always">
          {always}
        </div>
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
}: SheetProps) {
  const reducedMotion = usePrefersReducedMotion();
  const coarse = useMedia("(pointer: coarse)");
  const compactHeight = useMedia("(max-height: 699.98px)");
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [textHost, setTextHost] = useState<HTMLDivElement | null>(null);
  const [vibrationOk] = useState(canVibrate);
  const [ring] = useState(createRing);
  const [motes] = useState(() => createMotes(moteCount(coarse, reducedMotion)));
  const [scene] = useState(createScene);
  const { values: v, tones, binds } = scene;
  const sessionActive = activeTool === tool;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const phaseRef = useRef<Phase>("closed");
  const toneRef = useRef<Tone>(TOOL_TONE[tool]);
  const armedRef = useRef(false);
  const sessionRef = useRef(false);
  const completedRef = useRef(false);
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

  /* ---- Opening (§5.8) ------------------------------------------------------------------- */
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
      // Neither is needed for the first frame: the history entry (Back closes) and the motes'
      // canvas (the field fades in from 400ms).
      requestAnimationFrame(() => {
        if (phaseRef.current === "opening" || phaseRef.current === "open") pushMinuteEntry();
      });
      later(120, () => motes.prepare());
      // Sound left on last time: the press that opened Take a minute still counts as a gesture. A deep
      // link or Back has none, so sound waits for the first press inside (the captures below).
      if (loadPrefs().sound) {
        sound.on = true;
        sound.wake();
      }

      const k = pace();
      const box = stage.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const d = orbEl.offsetWidth || 1;
      fieldRef.current?.style.setProperty("--nv-pool-x", `${cx}px`);
      fieldRef.current?.style.setProperty("--nv-pool-y", `${cy}px`);
      const from = retarget ? null : readOrigin(origin?.());

      if (!retarget) {
        const bx = from?.x ?? cx;
        const by = from?.y ?? cy;
        bloomEl.style.left = `${bx}px`;
        bloomEl.style.top = `${by}px`;
        v.cover.jump(coverScale(bx, by));
      }

      if (reducedMotion) {
        // A 200ms fade of the finished scene: no bloom, flight, ripple, stagger or motes.
        stopAll(scene.all);
        if (!retarget) {
          ring.refill(1, 0);
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
        v.ringDraw.jump(1);
        if (!retarget) v.root.jump(0);
        tween(v.root, 1, 0.2, "linear");
        ui.dataset.ui = "in";
        ui.dataset.ready = "";
        phaseRef.current = "open";
        return;
      }

      v.root.jump(1);
      // A swipe-close leaves the sheet below the screen.
      if (retarget) spring(v.surfaceY, 0, 0.42 * pace(), 0);
      else v.surfaceY.jump(0);
      if (!retarget) {
        // A fresh stage: whatever the last session left (an empty ring, a receded orb, a dimmed
        // field) is reset before the first frame.
        ring.refill(1, 0);
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
        v.ringDraw.jump(0);
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
      tweenK(v.ringDraw, 1, 0.7, CALM, retarget ? 0.2 : 0.72);
      tweenK(v.textIn, 1, 0.45, CALM, retarget ? 0.2 : 0.72);

      // The stagger runs on CSS transitions (experience.css), so a close reverses each in place.
      requestAnimationFrame(() => {
        if (phaseRef.current !== "closing") ui.dataset.ui = "in";
      });

      // One mint ripple when the orb lands (its rise settles within 2px at about 950ms).
      if (!retarget) {
        later((flies ? 950 : 640) * k, () => {
          if (phaseRef.current === "closing") return;
          v.rippleScale.jump(REST_SCALE);
          v.rippleOpacity.jump(0.45);
          // Once faded, the ring shrinks back so its 2.4 D box stops widening the sheet's scroll area.
          tween(v.rippleScale, 2.4, 1.4 * k, CALM).finished.then(() => v.rippleScale.jump(REST_SCALE));
          tween(v.rippleOpacity, 0, 1.4 * k, CALM);
        });
      }
      later(1600 * k, () => {
        if (phaseRef.current !== "opening") return;
        phaseRef.current = "open";
        ui.dataset.ready = "";
      });
    },
    [clearTimers, later, motes, origin, reducedMotion, ring, scene, titleRef, v],
  );

  /* ---- Closing (§5.9) ------------------------------------------------------------------- */
  const playClose = useCallback(() => {
    const stage = stageRef.current;
    const orbEl = orbRef.current;
    const bloomEl = bloomRef.current;
    const ui = uiRef.current;
    // Esc mid-opening: everything turns around from where it is, with no pause first.
    const interrupting = phaseRef.current === "opening";
    clearTimers();
    phaseRef.current = "closing";
    const token = ++closeTokenRef.current;
    motes.setMoving(false);
    if (ui) {
      ui.dataset.ui = "out";
      delete ui.dataset.ready;
    }
    const k = pace();
    sound.fadeOut(450 * k);
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

    if (reducedMotion || !stage || !orbEl || !bloomEl) {
      tween(v.root, 0, 0.16, "linear");
      later(170, () => handoff());
      return;
    }
    const lead = (s: number) => (interrupting ? 0 : s * k);
    const springK = (value: MotionValue<number>, to: number, vd: number, bounce: number, delay = 0) =>
      spring(value, to, vd * k, bounce, { delay: lead(delay) });
    const tweenK = (value: MotionValue<number>, to: number, s: number, ease: Ease, delay = 0) =>
      tween(value, to, s * k, ease, { delay: delay * k });

    const style = closeStyle();
    if (style.kind === "swipe") {
      // The sheet keeps the finger's speed on its way down; the page brightens behind it.
      spring(v.surfaceY, window.innerHeight, 0.42 * k, 0, { velocity: Math.max(0, style.speed) });
      tweenK(v.dim, 0, 0.36, EXIT);
      later(440 * k, () => handoff());
      return;
    }

    tweenK(v.textIn, 0, 0.16, EXIT);
    tweenK(v.haloIn, 0, 0.3, EXIT);
    tweenK(v.fieldIn, 0, 0.3, EXIT);
    tweenK(v.rippleOpacity, 0, 0.16, EXIT);

    const box = stage.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const d = orbEl.offsetWidth || 1;
    const to = readOrigin(origin?.());
    if (!to?.pearl) {
      // Nowhere to land (no pearl on screen): the orb fades where it is.
      tweenK(v.orbIn, 0, 0.3, EXIT);
      tweenK(v.flyScale, v.flyScale.get() * 0.9, 0.3, EXIT);
      springK(v.bloom, 0.4, 0.52, 0, 0.12);
      tweenK(v.bloomFade, 0, 0.2, EXIT, 0.46);
      tweenK(v.dim, 0, 0.24, EXIT, 0.36);
      later(680 * k, () => handoff());
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
    springK(v.flyX, target.x, 0.55, 0, 0.08);
    springK(v.flyY, target.y, 0.55, 0, 0.08);
    springK(v.flyScale, target.scale, 0.55, 0, 0.08);
    springK(v.scale, REST_SCALE, 0.55, 0, 0.08);
    springK(v.lift, 0, 0.55, 0, 0.08);
    tweenK(v.skin, 1, 0.34, "easeInOut", interrupting ? 0.1 : 0.26);
    tweenK(v.orbIn, 1, 0.16, "linear");
    springK(v.bloom, to.size / BLOOM, 0.52, 0, 0.12);
    tweenK(v.bloomFade, 0, 0.2, EXIT, 0.46);
    tweenK(v.dim, 0, 0.24, EXIT, 0.36);
    // The handoff waits until the orb sits on the pearl (within a pixel; at most 420ms more), then
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
    later(680 * k, () => {
      const deadline = performance.now() + 420 * k;
      const wait = () => {
        if (landed() || performance.now() > deadline) handoff(land);
        else requestAnimationFrame(wait);
      };
      wait();
    });
  }, [clearTimers, closeStyle, later, motes, onHandoff, origin, reducedMotion, scene, showPearl, v]);

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
      stopAll(scene.all);
      ring.dispose();
      motes.setMoving(false);
      showPearl();
    },
    [clearTimers, motes, ring, scene, showPearl],
  );

  useEffect(() => v.ringDraw.on("change", (x) => ring.setDraw(x)), [ring, v]);

  useEffect(
    () =>
      onSessionDone(() => {
        completedRef.current = true;
      }),
    [],
  );

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

  // The header's backdrop appears once the sheet scrolls (experience.css). In short landscape a long
  // screen docks the main button at the bottom (sticky); while it floats over the content before it,
  // that content fades out and is cut off 8px above it (data-docked, --nv-dock-cut).
  useEffect(() => {
    const sheet = uiRef.current;
    if (!sheet) return;
    let raf = 0;
    const dock = () => {
      raf = 0;
      const controls = sheet.querySelector<HTMLElement>(".nv-minute-panel .nv-minute-controls");
      if (!controls) return;
      const button = controls.querySelector<HTMLElement>(".nv-minute-primary");
      const before = button?.previousElementSibling;
      let cut = 0;
      if (button && before && getComputedStyle(button).position === "sticky") {
        const top = button.getBoundingClientRect().top;
        if (top > 0) cut = before.getBoundingClientRect().bottom - (top - 8);
      }
      if (cut > 0) controls.style.setProperty("--nv-dock-cut", `${Math.round(cut)}px`);
      controls.toggleAttribute("data-docked", cut > 0);
    };
    const update = () => {
      if (!raf) raf = requestAnimationFrame(dock);
    };
    const onScroll = () => {
      sheet.toggleAttribute("data-scrolled", sheet.scrollTop > 4);
      update();
    };
    sheet.addEventListener("scroll", onScroll, { passive: true });
    const sizes = new ResizeObserver(update);
    sizes.observe(sheet);
    const col = sheet.querySelector(".nv-minute-col");
    if (col) sizes.observe(col);
    return () => {
      cancelAnimationFrame(raf);
      sheet.removeEventListener("scroll", onScroll);
      sizes.disconnect();
    };
  }, []);

  // The sheet scrolls by itself only around a session and after a tool switch from a link: smoothly,
  // or at once under reduced motion.
  const scrollSheet = useCallback(
    (top: number) => {
      const sheet = uiRef.current;
      if (!sheet) return;
      const to = Math.round(Math.max(0, Math.min(sheet.scrollHeight - sheet.clientHeight, top)));
      if (Math.abs(to - sheet.scrollTop) >= 1) sheet.scrollTo({ top: to, behavior: reducedMotion ? "instant" : "smooth" });
    },
    [reducedMotion],
  );

  // A session's start brings its stage into view; its end settles the returning tabs (stageScroll,
  // tabsScroll). Measured a frame after the commit, once the tool's controls have changed.
  const sessionWasRef = useRef(false);
  useEffect(() => {
    const was = sessionWasRef.current;
    sessionWasRef.current = sessionActive;
    if (was === sessionActive || (phaseRef.current !== "opening" && phaseRef.current !== "open")) return;
    const raf = requestAnimationFrame(() => {
      const sheet = uiRef.current;
      const bar = zoneRef.current;
      if (!sheet || !bar) return;
      const view = { top: bar.getBoundingClientRect().bottom, bottom: sheet.getBoundingClientRect().top + sheet.clientHeight };
      const to = sessionActive ? stageScroll(sheet, view) : tabsScroll(sheet, view);
      if (to !== null) scrollSheet(to);
    });
    return () => cancelAnimationFrame(raf);
  }, [sessionActive, scrollSheet]);

  // A new tool gets a fresh stage: its tone, a full ring and the orb at rest. Before the scene is
  // open (a launcher that names another tool), the tone simply starts as the tool's.
  useEffect(() => {
    savePrefs({ tool });
    const instant = phaseRef.current !== "open";
    toneTo(TOOL_TONE[tool], instant);
    if (instant) return;
    ring.refill(1, 600);
    motes.setMoving(false);
    if (!reducedMotion) spring(v.scale, REST_SCALE, 0.6, 0);
    spring(v.lift, 0, 0.6, 0);
    tween(v.textRecede, 1, 0.3);
    tween(v.orbDim, 1, 0.3);
    tween(v.glow, 1, 0.3);
    tween(v.fieldDim, 0, 0.4);
    tween(v.breath, 0.12, 0.4);
  }, [tool, toneTo, ring, motes, reducedMotion, v]);

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
          if (live() && !reducedMotion) v.scale.set(x);
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
      },
      ring: {
        setRemaining(f) {
          if (live()) ring.setRemaining(f);
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
        setMotes(on) {
          motes.setMoving(on && live());
        },
        brighten() {
          if (!live()) return;
          tween(v.fieldDim, 0, 0.6, CALM);
          tween(v.breath, [v.breath.get(), 0.3, 0.12], 0.6, "easeOut", { times: [0, 0.4, 1] });
        },
      },
      sound: {
        enabled: prefs.sound,
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
      setSessionActive(active) {
        setActiveTool(active ? tool : null);
      },
      reducedMotion,
      coarse,
      compactHeight,
      prefs: { ...prefs, tool },
      setPrefs,
      switchTool(id) {
        if (!TOOL_ENABLED[id] || sessionRef.current) return;
        onToolChange(id);
        // The link that asked leaves with its panel: focus goes to the new tool's tab, never the page,
        // and the sheet scrolls up to it.
        requestAnimationFrame(() => {
          uiRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
          scrollSheet(0);
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
    motes,
    onToolChange,
    prefs,
    reducedMotion,
    requestClose,
    ring,
    scrollSheet,
    setPrefs,
    tones,
    tool,
    toneTo,
    v,
    vibrationOk,
  ]);

  const setArmed = useCallback((on: boolean) => {
    armedRef.current = on;
  }, []);
  const shell = useMemo<Shell>(() => ({ textHost, compactHeight, setArmed }), [textHost, compactHeight, setArmed]);

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

  const toggleSound = () => {
    const on = !prefs.sound;
    if (on) sound.enable();
    else sound.disable();
    setPrefs({ sound: on });
  };
  const toggleVibration = () => {
    const on = !prefs.vibration;
    if (on) vibrate("tap");
    setPrefs({ vibration: on });
  };

  return (
    <div ref={attachRoot} className="nv-minute-root">
      <div ref={dimBind} aria-hidden className="nv-minute-dim" />
      <div ref={surfaceBind} className="nv-minute-surface">
        <div ref={attachBloom} aria-hidden className="nv-minute-bloom" />
        <div ref={fieldRef} className="nv-minute-fieldbox">
          <Field binds={fieldBinds} attachCanvas={motes.attach} />
        </div>
        <div
          ref={uiRef}
          className="theme-pine nv-minute-sheet"
          data-session={sessionActive ? "" : undefined}
          // Sound left on last time starts with the first press inside (a touch grants it at the click).
          onPointerDownCapture={() => sound.wake()}
          onClickCapture={() => sound.wake()}
          onKeyDownCapture={() => sound.wake()}
        >
          <div ref={zoneRef} data-nv-in="top" className="nv-minute-top">
            <span aria-hidden className="nv-minute-handle" />
            <div className="nv-minute-bar">
              {/* Toggle buttons: a constant name with aria-pressed; the icon shows the state. */}
              <div className="nv-minute-toggles">
                <button type="button" aria-pressed={prefs.sound} className="nv-minute-toggle" onClick={toggleSound}>
                  {prefs.sound ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
                  Sound
                </button>
                {vibrationOk ? (
                  <button
                    type="button"
                    aria-pressed={prefs.vibration}
                    className="nv-minute-toggle"
                    onClick={toggleVibration}
                  >
                    {prefs.vibration ? <Vibrate aria-hidden /> : <VibrateOff aria-hidden />}
                    Vibration
                  </button>
                ) : null}
              </div>
              <Dialog.Close aria-label="Close" className="nv-minute-close">
                <X aria-hidden />
              </Dialog.Close>
            </div>
          </div>
          <div className="nv-minute-col">
            <Dialog.Title ref={titleRef} tabIndex={-1} data-nv-in="title" className="nv-minute-title">
              Take a minute.
            </Dialog.Title>
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
                    {ENABLED_TOOLS.map((id) => (
                      <Tabs.Tab key={id} value={id} className="nv-minute-tab">
                        {TOOL_LABEL[id]}
                      </Tabs.Tab>
                    ))}
                    <Tabs.Indicator aria-hidden className="nv-minute-tab-pill" />
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
  const [generation, setGeneration] = useState(0);

  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
  });

  // ✕, Esc, Done and swipe close at once and step back over our history entry; Back closes from
  // popstate. Every close goes through Base UI's onOpenChange below.
  const requestClose = useCallback((style: CloseStyle) => {
    styleRef.current = style;
    actionsRef.current?.close();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      if (openRef.current && !isMinuteEntry()) actionsRef.current?.close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  const closeStyle = useCallback(() => styleRef.current, []);
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
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Experience;
