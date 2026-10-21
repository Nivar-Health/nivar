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
  PrimaryButton,
  PromptLine,
  QuietButton,
  TimeLeft,
  useToolSession,
} from "./parts";

/* Eyes (spec §3.12, §5.6): a 20-second look-away, the one screen that asks you not to watch it. While
   it runs the orb recedes and the field dims; at the end a chime or vibration (when one is on) says
   it's time to look back, and the field always brightens. */

const LENGTH_MS = 20_000;
const DIM = 0.6;

export function Eyes({ api, Layout }: ToolProps) {
  const primary = useRef<HTMLButtonElement>(null);
  const announced = useRef(false);

  const s = useToolSession({
    api,
    tone: TOOL_TONE.eyes,
    pauseWhenHidden: true,
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

  const showHint = !api.sound.enabled && !(api.haptics.supported && api.haptics.enabled);

  let orb = null;
  let readout;
  let prompt;
  let action: { label: string; run(): void };
  let secondary = null;
  if (phase === "idle") {
    orb = (
      <>
        <OrbNum>{EYES.idleNum}</OrbNum>
        <OrbWord>{EYES.idleWord}</OrbWord>
      </>
    );
    readout = <p className="nv-tool-sub nv-tool-sub-wide">{EYES.idleBody}</p>;
    prompt = showHint ? <p className="nv-tool-hint">{EYES.hint}</p> : undefined;
    action = { label: EYES.start, run: start };
  } else if (phase === "done") {
    readout = <p className="nv-tool-lead">{EYES.done}</p>;
    action = { label: COMMON.again, run: start };
    secondary = <QuietButton onClick={api.close}>{COMMON.done}</QuietButton>;
  } else {
    if (phase === "leadin") orb = <LeadInOrb left={s.leadInLeft} />;
    else if (phase === "paused") orb = <OrbWord>{COMMON.paused}</OrbWord>;
    readout = <TimeLeft seconds={s.secondsLeft} of={EYES.left} />;
    // "Look away now" only once the 20 seconds run. Both lines keep their place, so nothing moves.
    const line = phase === "leadin" ? EYES.leadIn : s.pausedByVisibility ? COMMON.away : EYES.running;
    prompt = (
      <>
        <PromptLine strong swapKey={line}>
          {line}
        </PromptLine>
        <PromptLine swapKey="leadin">{phase === "leadin" ? COMMON.leadInLine : null}</PromptLine>
      </>
    );
    action = phase === "paused" ? { label: COMMON.resume, run: s.togglePause } : { label: COMMON.pause, run: s.togglePause };
    secondary = <QuietButton onClick={stop}>{COMMON.stop}</QuietButton>;
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      readout={<div className="nv-tool-readout">{readout}</div>}
      prompt={prompt}
      controls={
        <div className="nv-tool-controls">
          <PrimaryButton ref={primary} onClick={action.run}>
            {action.label}
          </PrimaryButton>
          {secondary}
        </div>
      }
      fine={<FineLines lines={EYES.fine} />}
    />
  );
}
