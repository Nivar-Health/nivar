"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { TOOL_TONE } from "../config";
import { formatClock } from "../engine";
import type { ExperienceApi, Prefs, ToolProps } from "../types";
import { ANNOUNCE, BREATHE, COMMON } from "./copy";
import {
  ChipRadio,
  FineLines,
  GLOW_REST,
  HiddenTimer,
  ORB_REST,
  OrbWord,
  PromptLine,
  SteadyText,
  ToolControls,
  safetySlots,
  useToolSession,
  type MainAction,
  type SideAction,
} from "./parts";

/* Breathe: a guide, never a stopwatch. Five counts in and five out, or a gentler four, paced by the orb
   on a raised cosine, one phase word and one dot a second. Nothing ticks while it runs: no numeral and
   no clock, the ring is the time left. A session is a whole number of breaths, so it always ends on a
   full breath out, and "Stay a little longer" carries the same rhythm on. It opens with a settle-in
   that ends on a breath out, so the first breath in starts from empty and the person and the orb are in
   step; every Resume replays that breath out and picks up at the start of a whole breath. The last
   breath is followed by a moment of stillness and one ripple before the done screen. Under reduced
   motion the orb never scales: its light fades with the breath, with the words and the dots. */

type Minutes = Prefs["breatheMinutes"];
type Counts = Prefs["breatheCounts"];

/** The settle-in before the first breath, and its last part, a breath out, which also leads every Resume. */
const SETTLE_MS = 6000;
const BREATH_OUT_MS = 3000;
/** How far the orb swells while settling in, before it eases down with the breath out. */
const SETTLE_SCALE = 0.76;
/** The stillness between the last breath out and the done screen. */
const STILL_MS = 1500;
/** From this length a session gets a spoken mark each minute, and the note when the screen may switch off. */
const LONG_MS = 150_000;

const phaseMs = (counts: Counts) => counts * 1000;

/** About this exercise before and during a session: the safety line already shows under the button then. */
const FINE_BEFORE = BREATHE.fine.filter((line) => line[0] !== BREATHE.always);

/** A session of `minutes` as whole breaths at this pace: 6, 18 and 30 at five counts; 8, 23 and 38 at four. */
function lengthMs(minutes: Minutes, counts: Counts): number {
  const breath = 2 * phaseMs(counts);
  return Math.round((minutes * 60_000) / breath) * breath;
}

const asMinutes = (ms: number): Minutes => {
  const m = Math.round(ms / 60_000);
  return m >= 5 ? 5 : m >= 3 ? 3 : 1;
};

type Ease = { value: number; raf: number };

/** Eases a value the shell can only set (the orb's light, the field's breath) to `to`. */
function easeTo(ease: RefObject<Ease>, to: number, ms: number, write: (v: number) => void) {
  const g = ease.current;
  cancelAnimationFrame(g.raf);
  g.raf = 0;
  const from = g.value;
  if (Math.abs(to - from) < 0.001) return;
  let t0 = -1;
  const step = (now: number) => {
    if (t0 < 0) t0 = now;
    const p = Math.min(1, (now - t0) / ms);
    g.value = from + (to - from) * (1 - (1 - p) ** 3);
    write(g.value);
    g.raf = p < 1 ? requestAnimationFrame(step) : 0;
  };
  g.raf = requestAnimationFrame(step);
}

/** Reduced motion: eases the orb's light to `to` (a fade, not motion) at the edges of a session. */
function fadeGlow(glow: RefObject<Ease>, a: ExperienceApi, to: number, ms: number) {
  easeTo(glow, to, ms, (v) => a.orb.setGlow(v));
}

/** The mint pool behind the orb back to rest, alongside the orb. */
function emptyField(breath: RefObject<Ease>, a: ExperienceApi, ms: number) {
  easeTo(breath, 0, ms, (v) => a.field.setBreath(v));
}

export function Breathe({ api, Layout }: ToolProps) {
  const chosen = api.prefs.breatheMinutes;
  const counts = api.prefs.breatheCounts;
  const lastPhase = useRef(-1);
  const length = useRef(0);
  const primary = useRef<HTMLButtonElement>(null);
  // Reduced motion: the light eases between rest and the breath at the edges of a session.
  const glow = useRef<Ease>({ value: GLOW_REST, raf: 0 });
  // The field's breath (0 to 1), eased back to rest with the orb.
  const breath = useRef<Ease>({ value: 0, raf: 0 });
  // The stillness after the last breath out: the session is over, the done screen has not come yet.
  const [ending, setEnding] = useState(false);
  const [tip, setTip] = useState(false);
  const apiNow = useRef(api);
  useLayoutEffect(() => {
    apiNow.current = api;
  });

  const s = useToolSession({
    api,
    tone: TOOL_TONE.breathe,
    pauseWhenHidden: true,
    leadInMs: SETTLE_MS,
    resumeLeadInMs: BREATH_OUT_MS,
    resumeAlignMs: 2 * phaseMs(counts),
    tick: "frame",
    backPauses: true,
    holdActive: ending,
    onFrame(elapsed, total, a) {
      const ms = phaseMs(counts);
      const i = Math.floor(elapsed / ms);
      const inhale = i % 2 === 0;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * ((elapsed % ms) / ms));
      const full = inhale ? e : 1 - e;
      if (a.reducedMotion) {
        // A fade at a session's edge (fadeGlow) has the light until it lands.
        if (!glow.current.raf) {
          glow.current.value = full;
          a.orb.setGlow(full);
        }
      } else a.orb.setScale(ORB_REST + (1 - ORB_REST) * full);
      if (!breath.current.raf) {
        breath.current.value = full;
        a.field.setBreath(full);
      }
      if (elapsed >= total || i === lastPhase.current) return;
      lastPhase.current = i;
      // With Sound on the chimes carry the breath; without it, screen readers hear the words.
      if (a.sound.enabled) a.sound.chime(inhale ? "in" : "out");
      else a.announce(inhale ? BREATHE.inhale : BREATHE.exhale);
      if (a.haptics.enabled) a.haptics.buzz(inhale ? "in" : "out");
    },
    onDone(a) {
      a.orb.spring(ORB_REST, { visualDuration: 1.2, bounce: 0 });
      if (a.reducedMotion) fadeGlow(glow, a, GLOW_REST, 900);
      emptyField(breath, a, 1200);
      if (a.sound.enabled) a.sound.chime("done");
      if (a.haptics.enabled) a.haptics.buzz("done");
      a.announce(ANNOUNCE.doneMinutes(asMinutes(length.current)), { force: true });
      // Once ever, on a first done screen reached in silence.
      if (!a.sound.enabled && !a.prefs.tipShown) {
        setTip(true);
        a.setPrefs({ tipShown: true });
      }
      setEnding(true);
    },
    onReset(a) {
      a.orb.spring(ORB_REST, { visualDuration: 0.6, bounce: 0 });
      if (a.reducedMotion) fadeGlow(glow, a, GLOW_REST, 600);
      emptyField(breath, a, 600);
    },
  });
  const { phase, totalMs, getElapsed, refillRing } = s;

  // Declared after the session, so leaving the tool (whose reset starts these) cancels them too.
  useEffect(() => {
    const g = glow.current;
    const b = breath.current;
    return () => {
      cancelAnimationFrame(g.raf);
      cancelAnimationFrame(b.raf);
    };
  }, []);

  // The ending: stillness, then one ripple as the done screen comes in.
  useEffect(() => {
    if (!ending) return;
    const timer = window.setTimeout(() => {
      setEnding(false);
      apiNow.current.orb.ripple();
    }, STILL_MS);
    return () => window.clearTimeout(timer);
  }, [ending]);

  // The settle-in. First the orb swells a little; then, with "Let your breath out.", it eases down to
  // its smallest (under reduced motion its light dims), so the first breath in starts from empty. A
  // Resume plays only the breath out, from wherever the pause left the orb.
  const breathingOut = phase === "leadin" && s.leadInLeft * 1000 <= BREATH_OUT_MS;
  useEffect(() => {
    if (phase !== "leadin") return;
    const a = apiNow.current;
    if (!breathingOut) {
      a.orb.spring(SETTLE_SCALE, { visualDuration: 2.4, bounce: 0 });
      return;
    }
    a.orb.spring(ORB_REST, { visualDuration: 2, bounce: 0 });
    if (a.reducedMotion) fadeGlow(glow, a, 0, 2400);
    emptyField(breath, a, 2400);
  }, [phase, breathingOut]);

  // A Resume moves the time left on to a whole breath (resumeAlignMs): the ring settles there, and the
  // first breath after it is chimed or announced again.
  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (phase !== "leadin" || was !== "paused") return;
    lastPhase.current = -1;
    if (totalMs > 0) refillRing((totalMs - getElapsed()) / totalMs);
  }, [phase, totalMs, getElapsed, refillRing]);

  const start = (minutes: Minutes) => {
    length.current = lengthMs(minutes, counts);
    lastPhase.current = -1;
    setTip(false);
    api.announce(BREATHE.announceStart, { force: true });
    s.begin(length.current);
  };

  const stay = (addMinutes: number) => {
    const add = addMinutes * 60_000;
    const total = length.current + add;
    setTip(false);
    lastPhase.current = -1;
    // The breath carries straight on from rest: under reduced motion the light eases down to meet it,
    // and the frames take the field back at once.
    if (api.reducedMotion) fadeGlow(glow, api, 0, 500);
    cancelAnimationFrame(breath.current.raf);
    breath.current.raf = 0;
    s.extend(add);
    s.refillRing(add / total);
    length.current = total;
  };

  const end = () => {
    s.halt();
    primary.current?.focus();
  };

  const setPace = (next: Counts) => {
    api.setPrefs({ breatheCounts: next });
    api.announce(BREATHE.paceSaid[next], { force: true });
  };

  const view = phase === "done" ? (ending ? "ending" : "done") : phase;
  const total = totalMs || lengthMs(chosen, counts);
  const minutes = asMinutes(total);
  // Whole seconds into the session: the word and the dots change on the same once-a-second tick. The
  // stillness keeps the last second's picture (breathe out, no dot lit) while it fades.
  const k = Math.min(Math.max(0, Math.round(total / 1000) - s.secondsLeft), Math.round(total / 1000) - 1);
  const inhale = Math.floor(k / counts) % 2 === 0;
  const beat = k % counts;
  const lit = inhale ? beat + 1 : counts - 1 - beat;

  // One spoken mark a minute on the longer sessions, two seconds after a breath turns, so it never
  // talks over a phase word. Never the count, never seconds.
  const minuteMark =
    phase === "running" && total >= LONG_MS && k >= 20 && s.secondsLeft % 60 === 58 ? Math.round(s.secondsLeft / 60) : 0;
  useEffect(() => {
    if (minuteMark) apiNow.current.announce(COMMON.aboutLeft(minuteMark), { force: true });
  }, [minuteMark]);

  // No wake lock on a longer session: said once, through the first two breaths.
  const screenNote = phase === "running" && total >= LONG_MS && s.screenHeld === false && k < 4 * counts;
  const sayScreenNote = screenNote && k >= 2;
  useEffect(() => {
    if (sayScreenNote) apiNow.current.announce(COMMON.screenMayOff, { force: true });
  }, [sayScreenNote]);

  let orb: ReactNode;
  let readout: ReactNode;
  let prompt: ReactNode;
  let options: ReactNode = null;
  let after: ReactNode = null;
  let main: MainAction;
  let beside: SideAction | undefined;
  let under: SideAction | undefined;
  if (view === "idle") {
    orb = (
      <OrbWord key="idle" className="nv-tool-swap">
        {BREATHE.word}
      </OrbWord>
    );
    readout = <p className="nv-tool-sub nv-tool-sub-wide">{BREATHE.technique}</p>;
    options = (
      <>
        <fieldset className="nv-tool-chips">
          <legend className="sr-only">{BREATHE.chipsLabel}</legend>
          {BREATHE.chips.map((m) => (
            <ChipRadio key={m} name="nv-breathe-minutes" checked={chosen === m} onSelect={() => api.setPrefs({ breatheMinutes: m })}>
              {BREATHE.chip(m)}
            </ChipRadio>
          ))}
        </fieldset>
        <button type="button" className="nv-tool-pace" onClick={() => setPace(counts === 5 ? 4 : 5)}>
          {BREATHE.pace[counts].now} <span className="nv-tool-pace-press">{BREATHE.pace[counts].press}</span>
        </button>
      </>
    );
    after = (
      <button type="button" className="nv-tool-textlink" onClick={() => api.switchTool("rest")}>
        {BREATHE.restLink}
      </button>
    );
    main = { label: BREATHE.start, run: () => start(chosen) };
  } else if (view === "done") {
    orb = (
      <span key="done" className="nv-tool-proverb nv-tool-swap">
        <span lang={BREATHE.proverb.lang} className="nv-tool-proverb-text">
          {BREATHE.proverb.text}
        </span>
        <span className="sr-only"> · </span>
        <span className="nv-tool-proverb-gloss">{BREATHE.proverb.gloss}</span>
      </span>
    );
    readout = <p className="nv-tool-lead nv-tool-swap">{BREATHE.done(minutes)}</p>;
    prompt = tip ? <p className="nv-tool-swap">{BREATHE.soundTip}</p> : undefined;
    main = { label: COMMON.done, run: api.close };
    under =
      minutes === 5
        ? { label: COMMON.again, run: () => start(5) }
        : { label: BREATHE.stay(minutes === 1 ? 4 : 2), run: () => stay(minutes === 1 ? 4 : 2) };
  } else {
    const paused = view === "paused";
    if (view === "leadin") {
      orb = (
        <OrbWord key="settle" className="nv-tool-swap">
          {COMMON.settleIn}
        </OrbWord>
      );
    } else if (paused) {
      orb = (
        <OrbWord key="paused" className="nv-tool-swap">
          {COMMON.paused}
        </OrbWord>
      );
    } else {
      // Both words and every dot stay in the page for the whole session and only fade: a breath turn
      // adds and removes nothing.
      orb = (
        <span key="breath" className="nv-tool-breath nv-tool-swap" data-ending={view === "ending" ? "" : undefined}>
          <span className="nv-tool-phase" data-phase={inhale ? "in" : "out"}>
            <OrbWord aria-hidden={!inhale}>{BREATHE.inhale}</OrbWord>
            <OrbWord aria-hidden={inhale}>{BREATHE.exhale}</OrbWord>
          </span>
          <span aria-hidden className="nv-tool-dots">
            {Array.from({ length: counts }, (_, i) => (
              <span key={i} className="nv-tool-dot" data-on={i < lit ? "" : undefined} />
            ))}
          </span>
        </span>
      );
    }
    // The ring is the time left. The clock shows only while paused; its line keeps its place throughout.
    readout = (
      <>
        <HiddenTimer seconds={s.secondsLeft} />
        <p aria-hidden className="nv-tool-left" data-on={paused ? "" : undefined}>
          {paused ? <SteadyText text={COMMON.left(formatClock(s.secondsLeft))} /> : " "}
        </p>
      </>
    );
    const line =
      view === "leadin"
        ? breathingOut
          ? BREATHE.breatheOut
          : COMMON.leadInLine
        : paused
          ? s.pausedByBack
            ? COMMON.backPaused
            : s.pausedByVisibility
              ? COMMON.away
              : null
          : screenNote
            ? COMMON.screenMayOff
            : null;
    prompt = <PromptLine swapKey={line ?? "none"}>{line}</PromptLine>;
    if (paused) {
      main = { label: COMMON.resume, run: s.togglePause };
      beside = { label: COMMON.end, run: end };
    } else {
      main = { label: COMMON.pause, run: view === "ending" ? undefined : s.togglePause, quiet: true };
    }
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      onOrbTap={view === "idle" ? () => start(chosen) : undefined}
      readout={<div className="nv-tool-readout">{readout}</div>}
      prompt={prompt}
      options={options}
      {...safetySlots(BREATHE.always, view === "done" ? {} : { line: BREATHE.always })}
      controls={<ToolControls main={main} mainRef={primary} beside={beside} under={under} hushed={view === "ending"} />}
      dock={view === "done" ? "flow" : "sticky"}
      after={after}
      fine={<FineLines lines={view === "done" ? BREATHE.fine : FINE_BEFORE} />}
    />
  );
}
