"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { TOOL_TONE } from "../config";
import type { ExperienceApi, Prefs, ToolProps } from "../types";
import { ANNOUNCE, BREATHE, COMMON } from "./copy";
import {
  ChipRadio,
  Clock,
  FineLines,
  GLOW_REST,
  LeadInOrb,
  ORB_REST,
  OrbNum,
  OrbWord,
  PromptLine,
  SafetyLine,
  TimeLeft,
  ToolControls,
  useToolSession,
  type MainAction,
} from "./parts";

/* Breathe (spec §3.12, §5.5, §5.6): a countdown, never a stopwatch. Five seconds in, five out, with
   the numeral counting 5 to 1 in each phase. Every length is a multiple of 10 s, so it always ends on
   a full exhale at 0:00, and "Keep going" carries the same rhythm on. Back from time away, the
   lead-in replays and the session picks up at the start of a whole breath, from rest. Under reduced
   motion the orb never scales: its inner light paces the breath (.4 to 1) with the words and
   numerals. */

const PHASE_MS = 5000;
/** One breath in and out. */
const BREATH_MS = 2 * PHASE_MS;
const GLOW_EMPTY = 0.4;
type Minutes = Prefs["breatheMinutes"];

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

/** The field's mint pool back to rest, alongside the orb's spring. */
function emptyField(breath: RefObject<Ease>, a: ExperienceApi, ms: number) {
  easeTo(breath, 0, ms, (v) => a.field.setBreath(v));
}

export function Breathe({ api, Layout }: ToolProps) {
  const chosen = api.prefs.breatheMinutes;
  const [doneHere, setDoneHere] = useState(0);
  const lastPhase = useRef(-1);
  const length = useRef(chosen * 60_000);
  const primary = useRef<HTMLButtonElement>(null);
  // Reduced motion: the light eases between rest and the breath at the edges of a session.
  const glow = useRef<Ease>({ value: GLOW_REST, raf: 0 });
  // The field's breath (0 to 1), eased back to rest with the orb.
  const breath = useRef<Ease>({ value: 0, raf: 0 });

  const s = useToolSession({
    api,
    tone: TOOL_TONE.breathe,
    pauseWhenHidden: true,
    resumeAlignMs: BREATH_MS,
    onFrame(elapsed, total, a) {
      const i = Math.floor(elapsed / PHASE_MS);
      const inhale = i % 2 === 0;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * ((elapsed % PHASE_MS) / PHASE_MS));
      const full = inhale ? e : 1 - e;
      if (a.reducedMotion) {
        if (!glow.current.raf) {
          glow.current.value = GLOW_EMPTY + (1 - GLOW_EMPTY) * full;
          a.orb.setGlow(glow.current.value);
        }
      } else {
        a.orb.setScale(ORB_REST + 0.38 * full);
        if (!breath.current.raf) {
          breath.current.value = full;
          a.field.setBreath(full);
        }
      }
      if (elapsed >= total || i === lastPhase.current) return;
      lastPhase.current = i;
      if (a.sound.enabled) a.sound.chime(inhale ? "in" : "out");
      if (a.haptics.enabled) a.haptics.buzz(inhale ? "in" : "out");
      a.announce(inhale ? BREATHE.inhale : BREATHE.exhale);
    },
    onDone(a) {
      a.orb.spring(ORB_REST, { visualDuration: 1.2, bounce: 0 });
      if (a.reducedMotion) fadeGlow(glow, a, GLOW_REST, 900);
      else emptyField(breath, a, 1200);
      if (a.sound.enabled) a.sound.chime("done");
      if (a.haptics.enabled) a.haptics.buzz("done");
      a.setPrefs({ completed: a.prefs.completed + 1 });
      a.announce(ANNOUNCE.doneMinutes(asMinutes(length.current)), { force: true });
      setDoneHere((n) => n + 1);
    },
    onReset(a) {
      a.orb.spring(ORB_REST, { visualDuration: 0.6, bounce: 0 });
      if (a.reducedMotion) fadeGlow(glow, a, GLOW_REST, 600);
      else emptyField(breath, a, 600);
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

  // Back from time away: the lead-in replays and the time left moves on to a whole breath
  // (resumeAlignMs), so the orb, the field and the ring settle there before it starts.
  const before = useRef(phase);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    if (phase !== "leadin" || was !== "paused") return;
    lastPhase.current = -1;
    if (totalMs > 0) refillRing((totalMs - getElapsed()) / totalMs);
    if (api.reducedMotion) {
      fadeGlow(glow, api, GLOW_EMPTY, 900);
    } else {
      api.orb.spring(ORB_REST, { visualDuration: 1.2, bounce: 0 });
      emptyField(breath, api, 1200);
    }
  }, [api, phase, totalMs, getElapsed, refillRing]);

  const start = (minutes: Minutes) => {
    length.current = minutes * 60_000;
    lastPhase.current = -1;
    // The first breath starts empty: under reduced motion the light settles there during the lead-in.
    if (api.reducedMotion) fadeGlow(glow, api, GLOW_EMPTY, 1500);
    s.begin(length.current);
  };

  const keepGoing = (addMinutes: number) => {
    const total = length.current + addMinutes * 60_000;
    if (api.reducedMotion) {
      fadeGlow(glow, api, GLOW_EMPTY, 500);
    } else {
      // The breath carries straight on: the frames take the field back at once.
      cancelAnimationFrame(breath.current.raf);
      breath.current.raf = 0;
    }
    s.extend(addMinutes * 60_000);
    s.refillRing((addMinutes * 60_000) / total);
    length.current = total;
  };

  const stop = () => {
    s.halt();
    primary.current?.focus();
  };

  // Whole seconds into the session: the word and the numeral change on the same once-a-second tick.
  const total = s.totalMs || chosen * 60_000;
  const minutes = asMinutes(total);
  const k = Math.max(0, Math.round(total / 1000) - s.secondsLeft);
  const phaseIndex = Math.floor(k / 5);
  const inhale = phaseIndex % 2 === 0;
  const count = 5 - (k % 5);
  const returning = api.prefs.completed - doneHere > 0;

  let orb;
  let readout;
  let prompt;
  let options = null;
  let after = null;
  let main: MainAction;
  let onStop: (() => void) | undefined;
  let onDone: (() => void) | undefined;
  if (phase === "idle") {
    orb = <OrbWord>{BREATHE.word}</OrbWord>;
    readout = (
      <>
        {returning && <p className="nv-tool-welcome">{BREATHE.welcome}</p>}
        <Clock seconds={chosen * 60} running={false} />
        <p className="nv-tool-sub">{BREATHE.idleSub}</p>
      </>
    );
    options = (
      <fieldset className="nv-tool-chips">
        <legend className="sr-only">{BREATHE.chipsLabel}</legend>
        {BREATHE.chips.map((m) => (
          <ChipRadio key={m} name="nv-breathe-minutes" checked={chosen === m} onSelect={() => api.setPrefs({ breatheMinutes: m })}>
            {BREATHE.chip(m)}
          </ChipRadio>
        ))}
      </fieldset>
    );
    after = (
      <button type="button" className="nv-tool-textlink" onClick={() => api.switchTool("rest")}>
        {BREATHE.restLink}
      </button>
    );
    main = { label: BREATHE.start, run: () => start(chosen) };
  } else if (phase === "done") {
    orb = (
      <span className="nv-tool-proverb">
        <span lang={BREATHE.proverb.lang} className="nv-tool-proverb-text">
          {BREATHE.proverb.text}
        </span>
        <span className="sr-only"> · </span>
        <span className="nv-tool-proverb-gloss">{BREATHE.proverb.gloss}</span>
      </span>
    );
    readout = <p className="nv-tool-lead">{BREATHE.done(minutes)}</p>;
    main =
      minutes === 5
        ? { label: COMMON.again, run: () => start(5) }
        : { label: BREATHE.keepGoing(minutes === 1 ? 4 : 2), run: () => keepGoing(minutes === 1 ? 4 : 2) };
    onDone = api.close;
  } else {
    orb =
      phase === "leadin" ? (
        <LeadInOrb left={s.leadInLeft} />
      ) : phase === "paused" ? (
        <OrbWord>{COMMON.paused}</OrbWord>
      ) : (
        <>
          <OrbWord key={phaseIndex} className="nv-tool-swap">
            {inhale ? BREATHE.inhale : BREATHE.exhale}
          </OrbWord>
          <OrbNum>{count}</OrbNum>
        </>
      );
    readout = <TimeLeft seconds={s.secondsLeft} of={BREATHE.left(minutes)} />;
    prompt = (
      <PromptLine swapKey={phase}>
        {phase === "leadin" ? COMMON.leadInLine : s.pausedByVisibility ? COMMON.away : null}
      </PromptLine>
    );
    main = { label: phase === "paused" ? COMMON.resume : COMMON.pause, run: s.togglePause };
    onStop = stop;
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      readout={<div className="nv-tool-readout">{readout}</div>}
      prompt={prompt}
      options={options}
      always={<SafetyLine text={BREATHE.always} />}
      controls={<ToolControls main={main} mainRef={primary} onStop={onStop} onDone={onDone} />}
      after={after}
      fine={<FineLines lines={BREATHE.fine} />}
    />
  );
}
