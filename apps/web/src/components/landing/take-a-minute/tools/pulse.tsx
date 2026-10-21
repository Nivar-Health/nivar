"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TOOL_TONE } from "../config";
import type { ExperienceApi, Prefs, ToolProps } from "../types";
import { COMMON, PULSE } from "./copy";
import {
  ChipRadio,
  Emergency,
  LeadInOrb,
  ORB_REST,
  OrbNum,
  OrbWord,
  PrimaryButton,
  PromptLine,
  QuietButton,
  RichText,
  TimeLeft,
  useToolSession,
} from "./parts";
import { Wrist } from "./wrist";

/* Pulse (spec §3.12, §5.4, §5.6). Defaults to "Just count": both hands are busy, so the screen
   only counts down 30 seconds; nothing pulses, ticks or vibrates while you count. "Tap along" turns
   the orb into a real button; the 30 seconds start with the first tap. The orb only ever says what
   to do: the time left sits under it, as in every tool, so no number in it can pass for a beat
   count. The result is neutral (no verdict colours, no chart) and nothing is stored. */

const LENGTH_MS = 30_000;
const MIN_TAP_GAP_MS = 250;
const MIN_TAPS = 10;
const ENTRY = /^\d{1,3}$/;

type Mode = Prefs["pulseMode"];
/** Tool-local states around the session (spec §5.4). */
type Stage = "idle" | "armed" | "session" | "entry" | "result";
type Result = { kind: "rate"; bpm: number; n: number; mode: Mode } | { kind: "few"; n: number };

const inRange = (bpm: number) => bpm >= 60 && bpm <= 100;

function resultText(r: Result): string {
  if (r.kind === "few") return PULSE.fewTaps(r.n);
  const parts = [`${PULSE.result(r.bpm)} ${PULSE.resultCount(r.n, r.mode)}`];
  if (!inRange(r.bpm)) parts.push(PULSE.outOfRange);
  return parts.join(" ");
}

/** On phones, keep the number field in view once the keyboard is up (addendum M6). */
function revealAboveKeyboard(el: HTMLElement, reduced: boolean) {
  const vv = window.visualViewport;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    vv?.removeEventListener("resize", go);
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  };
  vv?.addEventListener("resize", go);
  window.setTimeout(go, 300);
}

export function Pulse({ api, Layout }: ToolProps) {
  const chosen: Mode = api.prefs.pulseMode ?? "count";
  const [stage, setStage] = useState<Stage>("idle");
  const [mode, setMode] = useState<Mode>(chosen);
  const [taps, setTaps] = useState(0);
  const [entry, setEntry] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const log = useRef<{ last: number | null; gaps: number[]; n: number }>({ last: null, gaps: [], n: 0 });
  const started = useRef(false);
  const tenLeft = useRef(false);
  const focusNext = useRef<"primary" | "input" | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ids = useId();
  const errorId = `${ids}-error`;

  const s = useToolSession({
    api,
    tone: TOOL_TONE.pulse,
    pauseWhenHidden: true,
    holdActive: stage === "armed",
    motes: false,
    onFrame(elapsed, total, a) {
      if (!tenLeft.current && total - elapsed <= 10_000 && elapsed < total) {
        tenLeft.current = true;
        a.announce(PULSE.announceTen);
      }
    },
    onDone(a) {
      // The count is over, so a cue is fine now; never during it.
      if (a.sound.enabled) a.sound.chime("done");
      if (a.haptics.enabled) a.haptics.buzz("done");
      if (mode === "count") {
        focusNext.current = "input";
        setStage("entry");
        return;
      }
      const { n, gaps } = log.current;
      const r: Result =
        n < MIN_TAPS || gaps.length === 0
          ? { kind: "few", n }
          : { kind: "rate", bpm: Math.round(60_000 / (gaps.reduce((x, y) => x + y, 0) / gaps.length)), n, mode: "tap" };
      showResult(r, a);
    },
  });
  const { phase } = s;

  function showResult(r: Result, a: ExperienceApi) {
    setResult(r);
    focusNext.current = "primary";
    setStage("result");
    a.announce(resultText(r), { force: true });
  }

  // "Started, 30 seconds" once per count, when the time starts running.
  useEffect(() => {
    if (phase !== "running" || started.current) return;
    started.current = true;
    api.announce(PULSE.announceStart);
  }, [api, phase]);

  // A pause breaks the run of taps, so the gap across it never counts as a beat.
  useEffect(() => {
    if (phase === "paused") log.current.last = null;
  }, [phase]);

  // Focus follows the step: the number field after a count, the main button after a result.
  useEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    focusNext.current = null;
    (next === "input" ? input.current : primary.current)?.focus({ preventScroll: next === "input" && api.coarse });
  });

  const start = () => {
    setMode(chosen);
    setTaps(0);
    setEntry("");
    setInvalid(false);
    setResult(null);
    started.current = false;
    tenLeft.current = false;
    log.current = { last: null, gaps: [], n: 0 };
    if (chosen === "count") {
      setStage("session");
      s.begin(LENGTH_MS);
    } else {
      s.touch();
      setStage("armed");
    }
  };

  const toIdle = () => {
    s.halt();
    setStage("idle");
    setTaps(0);
    setResult(null);
    focusNext.current = "primary";
  };

  const feedback = () => {
    api.orb.flash();
    if (!api.reducedMotion) {
      api.orb.setScale(ORB_REST * 1.035);
      api.orb.spring(ORB_REST, { visualDuration: 0.26, bounce: 0.3 });
    }
    if (api.sound.enabled) api.sound.tick();
  };

  const tap = () => {
    const now = performance.now();
    const l = log.current;
    if (stage === "armed") {
      log.current = { last: now, gaps: [], n: 1 };
      setTaps(1);
      setStage("session");
      s.begin(LENGTH_MS, { leadIn: false, refill: false });
      feedback();
      return;
    }
    if (phase !== "running") return;
    if (l.last !== null) {
      if (now - l.last < MIN_TAP_GAP_MS) return;
      l.gaps.push(now - l.last);
    }
    l.last = now;
    l.n += 1;
    setTaps(l.n);
    feedback();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = entry.trim();
    const n = ENTRY.test(raw) ? Number(raw) : NaN;
    if (!(n >= 5 && n <= 300)) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    setInvalid(false);
    showResult({ kind: "rate", bpm: n * 2, n, mode: "count" }, api);
  };

  const tapping = mode === "tap" && (stage === "armed" || (stage === "session" && phase === "running"));

  // The main button keeps one slot in the controls, so focus stays on it from Start to Pause.
  let orb;
  let readout = null;
  let prompt;
  let modes = null;
  let form = null;
  let action: { label: string; run(): void } = { label: "", run: () => {} };
  let secondary = null;
  if (stage === "idle") {
    orb = <Wrist />;
    readout = (
      <>
        <p className="nv-tool-lead">{PULSE.idleTitle}</p>
        <p className="nv-tool-sub nv-tool-sub-wide">{PULSE.idleBody}</p>
      </>
    );
    modes = (
      <fieldset className="nv-tool-modes">
        <legend className="nv-tool-legend">{PULSE.modeLegend}</legend>
        <div className="nv-tool-chips">
          {(["count", "tap"] as const).map((m) => (
            <ChipRadio key={m} name="nv-pulse-mode" checked={chosen === m} onSelect={() => api.setPrefs({ pulseMode: m })}>
              {PULSE.modes[m]}
            </ChipRadio>
          ))}
        </div>
      </fieldset>
    );
    action = { label: PULSE.start, run: start };
  } else if (stage === "armed") {
    orb = <OrbWord>{PULSE.tapWord}</OrbWord>;
    readout = (
      <>
        <TimeLeft seconds={LENGTH_MS / 1000} of={PULSE.left} running={false} />
        <p className="nv-tool-count">{PULSE.taps(0)}</p>
      </>
    );
    prompt = <PromptLine>{PULSE.tapHint}</PromptLine>;
    // Pause's place is kept (hidden), so nothing moves when the first tap starts the count.
    action = { label: COMMON.pause, run: () => {} };
    secondary = <QuietButton onClick={toIdle}>{COMMON.stop}</QuietButton>;
  } else if (stage === "session") {
    if (phase === "leadin") orb = <LeadInOrb left={s.leadInLeft} />;
    else if (phase === "paused") orb = <OrbWord>{COMMON.paused}</OrbWord>;
    else orb = <OrbWord>{mode === "tap" ? PULSE.tapWord : PULSE.countWord}</OrbWord>;
    readout = (
      <>
        <TimeLeft seconds={s.secondsLeft} of={PULSE.left} />
        {mode === "tap" ? <p className="nv-tool-count">{PULSE.taps(taps)}</p> : null}
      </>
    );
    prompt = (
      <PromptLine swapKey={phase}>
        {phase === "leadin" ? PULSE.leadIn : s.pausedByVisibility ? COMMON.away : null}
      </PromptLine>
    );
    action = { label: phase === "paused" ? COMMON.resume : COMMON.pause, run: s.togglePause };
    secondary = <QuietButton onClick={toIdle}>{COMMON.stop}</QuietButton>;
  } else if (stage === "entry") {
    orb = ENTRY.test(entry.trim()) ? <OrbNum aria-hidden>{entry.trim()}</OrbNum> : null;
    form = (
      <form className="nv-tool-entry" noValidate onSubmit={submit}>
        <label htmlFor={`${ids}-beats`} className="nv-tool-legend">
          {PULSE.entryLabel}
        </label>
        <input
          ref={input}
          id={`${ids}-beats`}
          className="nv-tool-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={3}
          value={entry}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(e) => {
            setEntry(e.target.value);
            if (invalid) setInvalid(false);
          }}
          onFocus={(e) => api.coarse && revealAboveKeyboard(e.currentTarget, api.reducedMotion)}
        />
        <p id={errorId} className="nv-tool-error" aria-live="polite">
          {invalid ? PULSE.entryError : ""}
        </p>
        <PrimaryButton type="submit">{PULSE.seeResult}</PrimaryButton>
      </form>
    );
  } else {
    const r = result ?? { kind: "few" as const, n: taps };
    if (r.kind === "rate") {
      orb = (
        <span className="nv-tool-result">
          <OrbWord>{PULSE.resultWords.before}</OrbWord> <OrbNum>{r.bpm}</OrbNum>{" "}
          <OrbWord>{PULSE.resultWords.after}</OrbWord>
        </span>
      );
      readout = <p className="nv-tool-sub">{PULSE.resultCount(r.n, r.mode)}</p>;
      prompt = (
        <div className="nv-tool-notes">
          <p>{PULSE.general}</p>
          {!inRange(r.bpm) && <p>{PULSE.outOfRange}</p>}
        </div>
      );
    } else {
      orb = <Wrist />;
      readout = <p className="nv-tool-lead">{PULSE.fewTaps(r.n)}</p>;
    }
    action = { label: PULSE.again, run: toIdle };
    secondary = <QuietButton onClick={api.close}>{COMMON.done}</QuietButton>;
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      orbButton={tapping ? { label: PULSE.tapWord, onPress: tap } : undefined}
      readout={readout ? <div className="nv-tool-readout">{readout}</div> : undefined}
      prompt={prompt}
      controls={
        <div className="nv-tool-controls">
          {modes}
          {form}
          {stage === "entry" ? null : (
            <PrimaryButton
              ref={primary}
              onClick={action.run}
              inert={stage === "armed"}
              className={stage === "armed" ? "nv-tool-held" : undefined}
            >
              {action.label}
            </PrimaryButton>
          )}
          {secondary}
        </div>
      }
      fine={
        <p className="nv-tool-fine">
          <RichText parts={PULSE.sources} />
        </p>
      }
      always={<Emergency text={PULSE.always} />}
    />
  );
}
