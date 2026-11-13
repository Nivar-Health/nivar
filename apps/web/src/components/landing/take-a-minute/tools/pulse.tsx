"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Digits } from "@/components/ui/digits";
import { TOOL_TONE } from "../config";
import type { ExperienceApi, Prefs, ToolProps } from "../types";
import { COMMON } from "./copy";
import { PULSE } from "./pulse-copy";
import {
  ChipRadio,
  HiddenTimer,
  LeadInOrb,
  ORB_REST,
  OrbNum,
  OrbWord,
  PromptLine,
  RichText,
  SafetyFull,
  SteadyText,
  ToolControls,
  safetySlots,
  useToolSession,
  type MainAction,
  type SideAction,
} from "./parts";
import { Wrist } from "./wrist";

/* Pulse (off in production until a doctor signs it off; tools/index.ts loads it only when enabled).
   Defaults to "Just count": both hands are busy, so the screen only shows 30 seconds passing on the ring;
   no digit ticks and nothing pulses, sounds, vibrates or speaks while you count. "Tap along" turns the
   orb into a real button; the 30 seconds start with the first tap. The orb only ever says what to do,
   so no number in it can pass for a beat count. Here a precise start matters, so it keeps "Get ready"
   3, 2, 1. The clock ticks on a timer (nothing here is paced); taps are timed where they land. The result
   is neutral (no verdict colours, no chart), read from the top, and nothing is stored. The safety line's
   first sentence shows quietly with a text button for the emergency one, and both stand in full beside
   the result. */

const LENGTH_MS = 30_000;
const TICK_MS = 250;
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
  const parts = [`${PULSE.result(r.bpm)} ${PULSE.resultCount(r.n, r.mode)}.`];
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
  const focusNext = useRef<"primary" | "input" | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ids = useId();
  const errorId = `${ids}-error`;
  const formId = `${ids}-count`;

  const s = useToolSession({
    api,
    tone: TOOL_TONE.pulse,
    pauseWhenHidden: true,
    tick: TICK_MS,
    holdActive: stage === "armed",
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
    // Read from its first line: the number, then every note under it.
    a.scrollToTop();
    a.announce(resultText(r), { force: true });
  }

  // "Get ready" once as the lead-in begins: the 3, 2, 1 is on screen only.
  useEffect(() => {
    if (phase === "leadin") api.announce(COMMON.getReady);
  }, [api, phase]);

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
    log.current = { last: null, gaps: [], n: 0 };
    if (chosen === "count") {
      setStage("session");
      s.begin(LENGTH_MS);
    } else {
      // The arc draws in now: the count starts, with a full ring, at the first tap.
      s.touch();
      s.refillRing(1);
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

  // The main button keeps one place in the dock, so focus stays on it from Start to Pause; after a
  // count it submits the beats form above it (Return in the field submits it too).
  let orb;
  let readout = null;
  let prompt;
  let options = null;
  let main: MainAction;
  let held = false;
  let beside: SideAction | undefined;
  let under: SideAction | undefined;
  if (stage === "idle") {
    orb = <Wrist />;
    readout = (
      <>
        <p className="nv-tool-lead">{PULSE.idleTitle}</p>
        <p className="nv-tool-sub nv-tool-sub-wide">
          {PULSE.idleBody.map((line) => (
            <span key={line} className="nv-tool-sub-line">
              {line}
            </span>
          ))}
        </p>
      </>
    );
    // The how to count sits with Start, in the dock: on a phone the how-to above runs long, and the
    // choice that goes with the button is never under it.
    options = (
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
    main = { label: PULSE.start, run: start };
  } else if (stage === "armed") {
    orb = <OrbWord>{PULSE.tapWord}</OrbWord>;
    readout = (
      <p className="nv-tool-count">
        <SteadyText text={PULSE.taps(0)} />
      </p>
    );
    prompt = <PromptLine>{api.coarse ? PULSE.tapHint : `${PULSE.tapHint} ${PULSE.tapKeys}`}</PromptLine>;
    // Pause waits, hidden and out of the row (Stop is centred), until the first tap starts the count.
    main = { label: COMMON.pause, quiet: true };
    held = true;
    beside = { label: COMMON.stop, run: toIdle };
  } else if (stage === "session") {
    if (phase === "leadin") orb = <LeadInOrb left={s.leadInLeft} />;
    else if (phase === "paused") orb = <OrbWord>{COMMON.paused}</OrbWord>;
    else orb = <OrbWord>{mode === "tap" ? PULSE.tapWord : PULSE.countWord}</OrbWord>;
    // The ring is the time left; no digit ticks while the beats are counted.
    readout = (
      <>
        <HiddenTimer seconds={s.secondsLeft} />
        {mode === "tap" ? (
          <p className="nv-tool-count">
            <SteadyText text={PULSE.taps(taps)} />
          </p>
        ) : null}
      </>
    );
    prompt = (
      <PromptLine swapKey={phase}>
        {phase === "leadin" ? PULSE.leadIn : s.pausedByVisibility ? COMMON.away : null}
      </PromptLine>
    );
    main = { label: phase === "paused" ? COMMON.resume : COMMON.pause, run: s.togglePause, quiet: phase !== "paused" };
    beside = { label: COMMON.stop, run: toIdle };
  } else if (stage === "entry") {
    orb = ENTRY.test(entry.trim()) ? (
      <OrbNum aria-hidden>
        <Digits value={entry.trim()} />
      </OrbNum>
    ) : null;
    options = (
      <form id={formId} className="nv-tool-entry" noValidate onSubmit={submit}>
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
      </form>
    );
    main = { label: PULSE.seeResult, form: formId };
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
          <SafetyFull text={PULSE.always} />
        </div>
      );
    } else {
      orb = <Wrist />;
      readout = <p className="nv-tool-lead">{PULSE.fewTaps(r.n)}</p>;
      prompt = (
        <div className="nv-tool-notes">
          <SafetyFull text={PULSE.always} />
        </div>
      );
    }
    main = { label: PULSE.again, run: toIdle };
    under = { label: COMMON.done, run: api.close };
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      orbButton={tapping ? { label: PULSE.tapWord, onPress: tap } : undefined}
      readout={readout ? <div className="nv-tool-readout">{readout}</div> : undefined}
      prompt={prompt}
      options={stage === "idle" ? undefined : options}
      {...safetySlots(
        PULSE.always,
        stage === "result"
          ? { shown: true }
          : { line: PULSE.alwaysLine, more: { label: PULSE.alwaysLabel, text: PULSE.alwaysEmergency }, flow: stage === "idle" },
      )}
      controls={
        <>
          {stage === "idle" ? options : null}
          <ToolControls main={main} mainRef={primary} held={held} beside={beside} under={under} />
        </>
      }
      // Idle follows the how-to too: on a phone it runs long, and a sticky dock would sit on the safety line.
      dock={stage === "idle" || stage === "entry" || stage === "result" ? "flow" : "sticky"}
      fine={
        <p className="nv-tool-fine">
          <RichText parts={PULSE.sources} />
        </p>
      }
      fineTitle={COMMON.sources}
    />
  );
}
