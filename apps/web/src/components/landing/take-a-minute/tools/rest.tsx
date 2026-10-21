"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_TONE } from "../config";
import type { ToolProps } from "../types";
import { ANNOUNCE, COMMON, REST, type RestPart } from "./copy";
import {
  Emergency,
  LeadInOrb,
  OrbWord,
  PrimaryButton,
  PromptLine,
  QuietButton,
  RichText,
  TimeLeft,
  useToolSession,
} from "./parts";
import { SeatedFigure } from "./seated-figure";

/* Rest (spec §3.12, §5.6): five quiet minutes before a blood pressure reading. Unpaced: the orb
   stays still and never scales. Wall-clock time (pauseWhenHidden false), so after a tab switch it
   shows the true time left, or done. The ticks only light the drawing; Start never waits for them. */

const LENGTH_MS = 5 * 60_000;

/** -1 is the first line; then the prompt for 4:00, 3:00, 2:00 and 1:00 left. */
function promptIndex(secondsLeft: number): number {
  let index = -1;
  REST.prompts.forEach((p, i) => {
    if (secondsLeft <= p.from) index = i;
  });
  return index;
}

export function Rest({ api, Layout }: ToolProps) {
  const [lit, setLit] = useState<ReadonlySet<RestPart>>(() => new Set());
  const primary = useRef<HTMLButtonElement>(null);
  const cued = useRef<number | null>(null);

  const s = useToolSession({
    api,
    tone: TOOL_TONE.rest,
    pauseWhenHidden: false,
    onDone(a) {
      if (a.sound.enabled) a.sound.chime("done");
      if (a.haptics.enabled) a.haptics.buzz("done");
      a.announce(ANNOUNCE.doneMinutes(5), { force: true });
    },
  });
  const { phase } = s;
  const counting = phase === "running" || phase === "paused";
  const index = counting ? promptIndex(s.secondsLeft) : null;
  const line = index === null ? null : index < 0 ? REST.firstLine : REST.prompts[index].text;

  // Each prompt is announced once, with a chime if sound is on. After time away only the current one.
  useEffect(() => {
    if (phase !== "running" || index === null || cued.current === index) return;
    const first = cued.current === null;
    cued.current = index;
    if (index >= 0 && api.sound.enabled) api.sound.chime("prompt");
    if (index >= 0 || first) api.announce(index < 0 ? REST.firstLine : REST.prompts[index].text);
  }, [api, phase, index]);

  const start = () => {
    cued.current = null;
    s.begin(LENGTH_MS);
  };

  const stop = () => {
    s.halt();
    primary.current?.focus();
  };

  const toggle = (part: RestPart, on: boolean) =>
    setLit((prev) => {
      const next = new Set(prev);
      if (on) next.add(part);
      else next.delete(part);
      return next;
    });

  let orb;
  let readout;
  let prompt;
  let action: { label: string; run(): void };
  let secondary = null;
  if (phase === "idle") {
    orb = <SeatedFigure lit={lit} />;
    readout = (
      <>
        <p className="nv-tool-lead">{REST.idleTitle}</p>
        <p className="nv-tool-sub">{REST.idleBody}</p>
      </>
    );
    action = { label: REST.start, run: start };
  } else if (phase === "done") {
    orb = <SeatedFigure lit={lit} />;
    readout = <p className="nv-tool-lead">{REST.doneTitle}</p>;
    prompt = (
      <div className="nv-tool-notes">
        {REST.doneBody.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
    );
    action = { label: COMMON.again, run: start };
    secondary = <QuietButton onClick={api.close}>{COMMON.done}</QuietButton>;
  } else {
    orb =
      phase === "leadin" ? (
        <LeadInOrb left={s.leadInLeft} />
      ) : (
        <OrbWord>{phase === "paused" ? COMMON.paused : REST.word}</OrbWord>
      );
    readout = <TimeLeft seconds={s.secondsLeft} of={REST.left} />;
    prompt =
      phase === "leadin" ? (
        <PromptLine swapKey="leadin">{COMMON.leadInLine}</PromptLine>
      ) : (
        <PromptLine strong swapKey={index ?? "first"}>
          {s.pausedByVisibility ? COMMON.away : line}
        </PromptLine>
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
          {phase === "idle" ? (
            <ul className="nv-tool-ticks">
              {REST.ticks.map(({ part, text }) => (
                <li key={part}>
                  <label className="nv-tool-tick">
                    <input type="checkbox" checked={lit.has(part)} onChange={(e) => toggle(part, e.target.checked)} />
                    <span aria-hidden className="nv-tool-tick-box" />
                    <span>{text}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          <PrimaryButton ref={primary} onClick={action.run}>
            {action.label}
          </PrimaryButton>
          {secondary}
        </div>
      }
      fine={
        <p className="nv-tool-fine">
          <RichText parts={REST.sources} />
        </p>
      }
      always={<Emergency text={REST.always} />}
    />
  );
}
