"use client";

import { useEffect, useRef } from "react";
import { TOOL_TONE } from "../config";
import type { ToolProps } from "../types";
import { COMMON, EYES } from "./copy";
import {
  FineLines,
  HiddenTimer,
  OrbNum,
  OrbWord,
  PromptLine,
  ToolControls,
  safetySlots,
  useToolSession,
  type MainAction,
  type SideAction,
} from "./parts";

/* Eye break: a 20-second look-away, the one screen that asks you not to watch it, so nothing on it
   counts. A short settle-in says what is coming; then the orb recedes and the field dims; at the end the
   field brightens, the orb says "Welcome back", and a chime (the top bar's Sound, on by default for this
   tool) or a vibration says it's time to look back. The line under Start says which. Nothing paces it,
   so the clock ticks on a timer. One quiet Stop; Back or a hidden tab pause it first rather than end it. */

const LENGTH_MS = 20_000;
const SETTLE_MS = 3000;
const TICK_MS = 250;
const DIM = 0.6;

export function Eyes({ api, Layout }: ToolProps) {
  const primary = useRef<HTMLButtonElement>(null);
  const announced = useRef(false);

  const s = useToolSession({
    api,
    tone: TOOL_TONE.eyes,
    pauseWhenHidden: true,
    leadInMs: SETTLE_MS,
    tick: TICK_MS,
    backPauses: true,
    onDone(a) {
      a.orb.recede(false);
      a.field.setDim(0);
      a.field.brighten();
      if (a.sound.enabled) a.sound.chime("look-back");
      if (a.haptics.enabled) a.haptics.buzz("done");
      a.announce(EYES.announceDone, { force: true });
    },
    onReset(a) {
      a.orb.recede(false);
      a.field.setDim(0);
    },
  });
  const { phase } = s;

  // Running: recede (under reduced motion the shell dims the orb in place) and dim the field. The
  // settle-in and a pause bring the orb back, so its word can be read.
  useEffect(() => {
    if (phase === "running") {
      api.orb.recede(true);
      api.field.setDim(DIM);
      if (!announced.current) {
        announced.current = true;
        api.announce(EYES.announceStart);
      }
    } else if (phase === "leadin" || phase === "paused") {
      api.orb.recede(false);
      api.field.setDim(0);
    }
  }, [api, phase]);

  const start = () => {
    announced.current = false;
    api.announce(EYES.leadIn, { force: true });
    s.begin(LENGTH_MS);
  };

  const stop = () => {
    s.halt();
    primary.current?.focus();
  };

  let orb;
  let readout;
  let prompt;
  let note: string | undefined;
  let main: MainAction;
  let beside: SideAction | undefined;
  let under: SideAction | undefined;
  if (phase === "idle") {
    orb = (
      <>
        <OrbNum>{EYES.idleNum}</OrbNum>
        <OrbWord>{EYES.idleWord}</OrbWord>
      </>
    );
    readout = <p className="nv-tool-sub nv-tool-sub-wide">{EYES.idleBody}</p>;
    note = api.sound.enabled ? EYES.cue.on : EYES.cue.off;
    main = { label: EYES.start, run: start };
  } else if (phase === "done") {
    orb = (
      <OrbWord key="welcome" className="nv-tool-swap">
        {EYES.welcome}
      </OrbWord>
    );
    readout = <p className="nv-tool-lead nv-tool-swap">{EYES.blink}</p>;
    main = { label: COMMON.done, run: api.close };
    under = { label: COMMON.again, run: start };
  } else {
    const paused = phase === "paused";
    // The settle-in keeps the idle face (what is about to happen); the receding orb needs no word; a pause says so.
    orb =
      phase === "leadin" ? (
        <>
          <OrbNum>{EYES.idleNum}</OrbNum>
          <OrbWord>{EYES.idleWord}</OrbWord>
        </>
      ) : paused ? (
        <OrbWord>{COMMON.paused}</OrbWord>
      ) : null;
    readout = <HiddenTimer seconds={s.secondsLeft} />;
    const line =
      phase === "leadin" ? EYES.leadIn : s.pausedByBack ? COMMON.backPaused : s.pausedByVisibility ? COMMON.away : EYES.running;
    prompt = (
      <PromptLine strong swapKey={line}>
        {line}
      </PromptLine>
    );
    if (paused) {
      main = { label: COMMON.resume, run: s.togglePause };
      beside = { label: COMMON.stop, run: stop };
    } else {
      main = { label: COMMON.stop, run: stop, quiet: true };
    }
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      readout={<div className="nv-tool-readout">{readout}</div>}
      prompt={prompt}
      {...safetySlots(EYES.always, phase === "idle" || phase === "done" ? { line: EYES.always } : {}, note)}
      controls={<ToolControls main={main} mainRef={primary} beside={beside} under={under} />}
      dock={phase === "done" ? "flow" : "sticky"}
      fine={<FineLines lines={EYES.fine} />}
      fineTitle={COMMON.sources}
    />
  );
}
