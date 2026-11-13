"use client";

import { useEffect, useRef } from "react";
import { TOOL_TONE } from "../config";
import type { ToolProps } from "../types";
import { COMMON, EYES } from "./copy";
import {
  FineLines,
  LeadInOrb,
  OrbNum,
  OrbWord,
  PromptLine,
  TimeLeft,
  ToolControls,
  safetySlots,
  useToolSession,
  type MainAction,
  type SideAction,
} from "./parts";

/* Eyes: a 20-second look-away, the one screen that asks you not to watch it. While it runs the orb
   recedes and the field dims; at the end the field always brightens, and a chime (the top bar's Sound,
   on by default for this tool) or a vibration says it's time to look back. Nothing paces it, so the
   clock ticks on a timer. Back pauses it first rather than closing the sheet. */

const LENGTH_MS = 20_000;
const TICK_MS = 250;
const DIM = 0.6;

export function Eyes({ api, Layout }: ToolProps) {
  const primary = useRef<HTMLButtonElement>(null);
  const announced = useRef(false);

  const s = useToolSession({
    api,
    tone: TOOL_TONE.eyes,
    pauseWhenHidden: true,
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
  // lead-in and a pause bring the orb back, so "Paused" can be read.
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
    s.begin(LENGTH_MS);
  };

  const stop = () => {
    s.halt();
    primary.current?.focus();
  };

  let orb = null;
  let readout;
  let prompt;
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
    main = { label: EYES.start, run: start };
  } else if (phase === "done") {
    readout = <p className="nv-tool-lead">{EYES.done}</p>;
    main = { label: COMMON.done, run: api.close };
    under = { label: COMMON.again, run: start };
  } else {
    if (phase === "leadin") orb = <LeadInOrb left={s.leadInLeft} />;
    else if (phase === "paused") orb = <OrbWord>{COMMON.paused}</OrbWord>;
    readout = <TimeLeft seconds={s.secondsLeft} of={EYES.left} />;
    // "Look away now" only once the 20 seconds run. Both lines keep their place, so nothing moves.
    const line =
      phase === "leadin" ? EYES.leadIn : s.pausedByBack ? COMMON.backPaused : s.pausedByVisibility ? COMMON.away : EYES.running;
    prompt = (
      <>
        <PromptLine strong swapKey={line}>
          {line}
        </PromptLine>
        <PromptLine swapKey="leadin">{phase === "leadin" ? COMMON.leadInLine : null}</PromptLine>
      </>
    );
    main = { label: phase === "paused" ? COMMON.resume : COMMON.pause, run: s.togglePause, quiet: phase !== "paused" };
    beside = { label: COMMON.stop, run: stop };
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      readout={<div className="nv-tool-readout">{readout}</div>}
      prompt={prompt}
      {...safetySlots(EYES.always, phase === "idle" || phase === "done" ? { line: EYES.always } : {})}
      controls={<ToolControls main={main} mainRef={primary} beside={beside} under={under} />}
      dock={phase === "done" ? "flow" : "sticky"}
      fine={<FineLines lines={EYES.fine} />}
      fineTitle={COMMON.sources}
    />
  );
}
