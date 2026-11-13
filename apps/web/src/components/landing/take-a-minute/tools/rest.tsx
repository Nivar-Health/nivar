"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_TONE } from "../config";
import type { ToolProps } from "../types";
import { ANNOUNCE, COMMON, REST } from "./copy";
import {
  HiddenTimer,
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
import { SeatedFigure } from "./seated-figure";

/* Before BP: five quiet minutes before a blood pressure reading. A rest is only valid unbroken, so it
   has no Pause: one quiet Stop. Nothing ticks: the orb is still, the ring glides on a timer, one prompt
   comes each minute and one quiet line says roughly how long is left. Wall-clock time (pauseWhenHidden
   false), and the timer keeps firing in a hidden page, so the end chime still sounds with the phone put
   down. Closing the sheet mid-rest does not throw the rest away: its end is kept for this page view, and
   opening Before BP again before then picks it up where it is. The emergency line opens from a text
   button before and during the rest, and stands in full, with its call buttons, beside the reading
   guidance when the rest is done. */

const LENGTH_MS = 5 * 60_000;
const SETTLE_MS = 4000;
const TICK_MS = 250;
/** How long after the first line the note about the screen is said. */
const NOTE_DELAY_MS = 4000;

/**
 * When a rest that is running ends (performance.now()), kept when the sheet closes mid-rest, so reopening
 * Before BP picks it up; 0 when none is. Module state: it lasts as long as the page, and no longer.
 */
let endsAt = 0;

/** -1 is the first line; then the prompt for 4:00, 3:00, 2:00 and 1:00 left. */
function promptIndex(secondsLeft: number): number {
  let index = -1;
  REST.prompts.forEach((p, i) => {
    if (secondsLeft <= p.from) index = i;
  });
  return index;
}

/** Time left in words, changing on the minute with the prompts: never seconds. */
function coarseLeft(secondsLeft: number): string {
  return secondsLeft > 60 ? COMMON.aboutLeft(Math.ceil(secondsLeft / 60)) : COMMON.underAMinute;
}

export function Rest({ api, Layout }: ToolProps) {
  const primary = useRef<HTMLButtonElement>(null);
  const cued = useRef<number | null>(null);
  const noteSaid = useRef(false);
  // Picked up after a close: the line says so until the next prompt.
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  // The prompt the run began on: the note about the screen shows through that minute only.
  const [firstIndex, setFirstIndex] = useState<number | null>(null);

  const s = useToolSession({
    api,
    tone: TOOL_TONE.rest,
    pauseWhenHidden: false,
    leadInMs: SETTLE_MS,
    tick: TICK_MS,
    onDone(a) {
      endsAt = 0;
      if (a.sound.enabled) a.sound.chime("done");
      if (a.haptics.enabled) a.haptics.buzz("done");
      a.announce(ANNOUNCE.doneMinutes(5), { force: true });
    },
  });
  const { phase, begin, getElapsed } = s;
  const running = phase === "running";
  const idle = useRef(true);
  useEffect(() => {
    idle.current = phase === "idle";
  });
  const index = running ? promptIndex(s.secondsLeft) : null;

  // Its end is known once the settle-in is over.
  useEffect(() => {
    if (running) endsAt = performance.now() + (LENGTH_MS - getElapsed());
  }, [running, getElapsed]);

  // Opened again while a rest closed mid-way is still running: it carries on from where it is now.
  useEffect(
    () =>
      api.onOpen(() => {
        // Only a fresh tool picks up; one already resting (the api changed under it) carries on as it is.
        if (!idle.current) return;
        const left = endsAt - performance.now();
        if (left < 1000) {
          endsAt = 0;
          return;
        }
        const at = LENGTH_MS - left;
        const now = promptIndex(Math.ceil(left / 1000));
        cued.current = now;
        setResumedAt(now);
        // The note about the screen belonged to the run's first minute, which has passed.
        setFirstIndex(null);
        begin(LENGTH_MS, { at });
        api.announce(`${REST.stillRunning} ${coarseLeft(Math.ceil(left / 1000))}.`, { force: true });
      }),
    [api, begin],
  );

  // Each prompt is announced once with the time left in words (the minute's one spoken mark), with a
  // chime if sound is on. After time away only the current one.
  useEffect(() => {
    if (!running || index === null || cued.current === index) return;
    const first = cued.current === null;
    cued.current = index;
    if (first) setFirstIndex(index);
    if (index >= 0 && api.sound.enabled) api.sound.chime("prompt");
    const text = index < 0 ? REST.firstLine : REST.prompts[index].text;
    api.announce(`${text} ${coarseLeft(s.secondsLeft)}.`);
  }, [api, running, index, s.secondsLeft]);

  // No wake lock: shown through the first minute, and said once, a few seconds after the first line so it
  // never talks over it.
  const screenNote = running && s.screenHeld === false && index === firstIndex;
  useEffect(() => {
    if (!screenNote || noteSaid.current) return;
    const timer = window.setTimeout(() => {
      noteSaid.current = true;
      api.announce(COMMON.screenMayOff, { force: true });
    }, NOTE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [api, screenNote]);

  const start = () => {
    cued.current = null;
    noteSaid.current = false;
    setResumedAt(null);
    setFirstIndex(null);
    api.announce(REST.announceStart, { force: true });
    begin(LENGTH_MS);
  };

  const stop = () => {
    endsAt = 0;
    s.halt();
    primary.current?.focus();
  };

  let orb;
  let readout;
  let prompt;
  let options = null;
  let note: string | undefined;
  let main: MainAction;
  let under: SideAction | undefined;
  if (phase === "idle") {
    orb = <SeatedFigure />;
    readout = (
      <>
        <p className="nv-tool-lead">{REST.idleTitle}</p>
        <p className="nv-tool-sub">{REST.idleBody}</p>
      </>
    );
    // A plain list: nothing to tick, and Start never waits on it.
    options = (
      <div className="nv-tool-steps">
        {REST.groups.map((group) => (
          <div key={group.label} className="nv-tool-step-group">
            <h3 className="nv-tool-step-label">{group.label}</h3>
            <ul className="nv-tool-step-list">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
    note = api.sound.enabled ? REST.phoneDown.on : REST.phoneDown.off;
    main = { label: REST.start, run: start };
  } else if (phase === "done") {
    orb = <SeatedFigure />;
    readout = <p className="nv-tool-lead">{REST.doneTitle}</p>;
    // The reading first; then, under its own label, what to do with a high one, the emergency line among it.
    prompt = (
      <div className="nv-tool-notes">
        <p>{REST.doneBody[0]}</p>
        <p className="nv-tool-notes-label">{REST.highLabel}</p>
        <p>{REST.doneBody[1]}</p>
        <SafetyFull text={REST.always} />
        <p>{REST.doneBody[2]}</p>
      </div>
    );
    main = { label: COMMON.done, run: api.close };
    under = { label: REST.again, run: start };
  } else {
    // Settling in, then resting: a still orb, the time in words, one line. The ring is the time left.
    const settling = phase === "leadin";
    orb = <OrbWord>{settling ? COMMON.settleIn : REST.word}</OrbWord>;
    readout = (
      <>
        <HiddenTimer seconds={s.secondsLeft} />
        <p className="nv-tool-coarse">{running ? <SteadyText text={coarseLeft(s.secondsLeft)} /> : " "}</p>
      </>
    );
    const line = settling
      ? COMMON.leadInLine
      : index === resumedAt
        ? REST.stillRunning
        : index !== null && index >= 0
          ? REST.prompts[index].text
          : REST.firstLine;
    prompt = (
      <>
        <PromptLine strong={!settling} swapKey={line}>
          {line}
        </PromptLine>
        {screenNote ? <p className="nv-tool-aside nv-tool-swap">{COMMON.screenMayOff}</p> : null}
      </>
    );
    main = { label: COMMON.stop, run: stop, quiet: true };
  }

  return (
    <Layout
      orb={<span className="nv-tool-orb">{orb}</span>}
      readout={<div className="nv-tool-readout">{readout}</div>}
      prompt={prompt}
      options={options}
      {...safetySlots(
        REST.always,
        phase === "done" ? { shown: true } : { more: { label: REST.alwaysLabel, text: REST.always } },
        note,
      )}
      controls={<ToolControls main={main} mainRef={primary} under={under} />}
      dock={phase === "done" ? "flow" : "sticky"}
      fine={
        <p className="nv-tool-fine">
          <RichText parts={REST.sources} />
        </p>
      }
      fineTitle={COMMON.sources}
    />
  );
}
