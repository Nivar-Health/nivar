"use client";

import { Phone } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import { SAFETY_DISPLAY } from "../config";
import { formatClock, useSession } from "../engine";
import type { ExperienceApi, LayoutSlots, Session, Tone } from "../types";
import { ANNOUNCE, COMMON, type Rich } from "./copy";
import "./tools.css";

/* What the four tools share: a session hook over useSession that owns the time-left ring, the
   session-active flag and the clean-up, plus the small pieces of UI every tool renders. */

/** The orb's resting scale: idle, done and every unpaced tool. */
export const ORB_REST = 0.62;
/** The orb's light at rest; reduced motion paces Breathe with it (0 to 1) instead of the scale. */
export const GLOW_REST = 1;
const REFILL_MS = 600;
/** After its label changes, the main button ignores presses for this long: a double tap never lands on the next action. */
const GUARD_MS = 500;

/** Time left as a share of the ring. The shell steps it once a second under reduced motion. */
function ringLeft(elapsedMs: number, totalMs: number): number {
  return totalMs > 0 ? Math.max(0, totalMs - elapsedMs) / totalMs : 1;
}

type ToolSessionOptions = {
  api: ExperienceApi;
  tone: Tone;
  pauseWhenHidden: boolean;
  /** The lead-in before the time runs, in ms (engine.ts: 3000 unless set). */
  leadInMs?: number;
  /** A lead-in of this length before every Resume (engine.ts). */
  resumeLeadInMs?: number;
  /** Back from a pause, the session resumes at the start of a whole cycle (engine.ts). */
  resumeAlignMs?: number;
  /** "frame" for paced motion (Breathe); otherwise the timer's interval in ms, and the ring glides between ticks. */
  tick?: "frame" | number;
  /** Back pauses the session first and says so; the next Back closes. Not for a rest, which is only valid unbroken. */
  backPauses?: boolean;
  /** Every running tick, after the ring. Writes the orb and the field through the api only. */
  onFrame?(elapsedMs: number, totalMs: number, api: ExperienceApi): void;
  onDone?(api: ExperienceApi): void;
  /** Puts back what the tool changed on the orb and the field (Stop, and when the tool leaves). */
  onReset?(api: ExperienceApi): void;
  /** A tool-local state that also counts as a session (Pulse's armed tap pad, the stillness after Breathe). */
  holdActive?: boolean;
};

export type ToolSession = Session & {
  /** leadin, running or paused (or holdActive): tabs and chips step aside, swipe is off. */
  active: boolean;
  /** The session paused because Back was pressed ("Paused. Go back again to close."). */
  pausedByBack: boolean;
  /** Starts a session. The ring's arc draws in first, so it shows the whole length through the lead-in. */
  begin(totalMs: number, o?: { leadIn?: boolean; refill?: boolean }): void;
  /** Stop: back to idle, with the ring, orb and field put back. */
  halt(): void;
  /** Pause or Resume, announced. */
  togglePause(): void;
  /** Eases the ring to `f` over 600 ms (the shell tweens toward the live time left). */
  refillRing(f: number): void;
  /** Marks the orb, ring or field as changed, so leaving the tool puts them back. */
  touch(): void;
};

export function useToolSession(o: ToolSessionOptions): ToolSession {
  const latest = useRef(o);
  useLayoutEffect(() => {
    latest.current = o;
  });
  const touched = useRef(false);
  const [backPaused, setBackPaused] = useState(false);

  const session = useSession({
    pauseWhenHidden: o.pauseWhenHidden,
    leadInMs: o.leadInMs,
    resumeLeadInMs: o.resumeLeadInMs,
    resumeAlignMs: o.resumeAlignMs,
    tick: o.tick,
    onFrame(elapsed, total) {
      const { api, onFrame, tick } = latest.current;
      api.ring.setRemaining(ringLeft(elapsed, total), typeof tick === "number" ? tick : 0);
      onFrame?.(elapsed, total, api);
    },
    onDone() {
      const { api, onDone } = latest.current;
      // The ring ends empty. Normally the last tick put it there; after a Resume that found no
      // whole cycle left (resumeAlignMs) it eases there from where the pause left it.
      api.ring.refill(0, REFILL_MS);
      onDone?.(api);
    },
  });
  const { phase, pausedByVisibility, start, pause, resume, stop } = session;
  const phaseNow = useRef(phase);
  useLayoutEffect(() => {
    phaseNow.current = phase;
  });

  const refillRing = useCallback((f: number) => latest.current.api.ring.refill(f, REFILL_MS), []);

  const touch = useCallback(() => {
    touched.current = true;
  }, []);

  const reset = useCallback(() => {
    if (!touched.current) return;
    touched.current = false;
    const { api, onReset } = latest.current;
    // Back to the bare track: the arc belongs to a session.
    refillRing(0);
    onReset?.(api);
  }, [refillRing]);

  const begin = useCallback(
    (totalMs: number, b?: { leadIn?: boolean; refill?: boolean }) => {
      touched.current = true;
      setBackPaused(false);
      if (b?.refill !== false) refillRing(1);
      start(totalMs, { leadIn: b?.leadIn ?? true });
    },
    [refillRing, start],
  );

  const halt = useCallback(() => {
    setBackPaused(false);
    stop();
    reset();
  }, [stop, reset]);

  const togglePause = useCallback(() => {
    const { api } = latest.current;
    if (phase === "paused") {
      setBackPaused(false);
      resume();
      api.announce(ANNOUNCE.resumed, { force: true });
    } else if (phase === "leadin" || phase === "running") {
      pause();
      api.announce(ANNOUNCE.paused, { force: true });
    }
  }, [phase, pause, resume]);

  // Back, during a session that can pause: it pauses instead of closing, and the tool says how to close.
  const onBack = useCallback(() => {
    if (!latest.current.backPauses || (phaseNow.current !== "leadin" && phaseNow.current !== "running")) return false;
    pause();
    setBackPaused(true);
    latest.current.api.announce(COMMON.backPaused, { force: true });
    return true;
  }, [pause]);

  const active = phase === "leadin" || phase === "running" || phase === "paused" || Boolean(o.holdActive);
  useEffect(() => {
    if (!active) return;
    const { api } = latest.current;
    api.setSessionActive(true, { onBack });
    return () => api.setSessionActive(false);
  }, [active, onBack]);

  useEffect(() => {
    latest.current.api.orb.setTone(o.tone);
  }, [o.tone]);

  // A hidden tab paused the session: said aloud once the page shows again (the tool shows the line).
  useEffect(() => {
    if (!pausedByVisibility) return;
    const say = () => {
      if (!document.hidden) latest.current.api.announce(COMMON.away, { force: true });
    };
    say();
    document.addEventListener("visibilitychange", say);
    return () => document.removeEventListener("visibilitychange", say);
  }, [pausedByVisibility]);

  // Leaving the tool (a tab switch or closing) puts the ring, orb and field back for the next one.
  useEffect(() => reset, [reset]);

  return { ...session, active, pausedByBack: backPaused && phase === "paused", begin, halt, togglePause, refillRing, touch };
}

/** The word in the orb's text layer (it never scales with the orb). */
export function OrbWord({ children, className, ...rest }: ComponentProps<"span">) {
  return (
    <span className={cn("nv-tool-word", className)} {...rest}>
      {children}
    </span>
  );
}

/** A numeral in the orb (64px, 56 on phones). */
export function OrbNum({ children, className, ...rest }: ComponentProps<"span">) {
  return (
    <span className={cn("nv-tool-num", className)} {...rest}>
      {children}
    </span>
  );
}

/** "Get ready" with 3, 2, 1: where the start has to be exact (a pulse count). */
export function LeadInOrb({ left }: { left: number }) {
  return (
    <>
      <OrbWord>{COMMON.getReady}</OrbWord>
      <OrbNum>{left}</OrbNum>
    </>
  );
}

/**
 * The countdown, 36px: role="timer", not live. Idle shows the length without the role. Not for
 * Breathe, where the ring is the time left and nothing ticks.
 */
export function Clock({ seconds, running = true }: { seconds: number; running?: boolean }) {
  return (
    <p role={running ? "timer" : undefined} aria-label={running ? COMMON.timeLeft : undefined} className="nv-tool-clock">
      {formatClock(seconds)}
    </p>
  );
}

/** Time left as the m:ss countdown under the orb, then "left of …". */
export function TimeLeft({ seconds, of, running = true }: { seconds: number; of: string; running?: boolean }) {
  return (
    <>
      <Clock seconds={seconds} running={running} />
      <p className="nv-tool-sub">{of}</p>
    </>
  );
}

/** The time left for assistive technology alone, where the screen shows no clock: role="timer", not live. */
export function HiddenTimer({ seconds }: { seconds: number }) {
  return (
    <p role="timer" aria-label={COMMON.timeLeft} className="sr-only">
      {formatClock(seconds)}
    </p>
  );
}

export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="nv-tool-link">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** A sentence whose { text, href } parts are new-tab links. */
export function RichText({ parts }: { parts: Rich }) {
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <Fragment key={i}>{part}</Fragment>
    ) : (
      <SourceLink key={i} href={part.href}>
        {part.text}
      </SourceLink>
    ),
  );
}

/** Fine print: one paragraph per line. */
export function FineLines({ lines }: { lines: readonly Rich[] }) {
  return lines.map((line, i) => (
    <p key={i} className="nv-tool-fine">
      <RichText parts={line} />
    </p>
  ));
}

/** The one quiet line under the controls: plain text, no box and no mark. */
export function QuietLine({ children }: { children: ReactNode }) {
  return <p className="nv-tool-quietline">{children}</p>;
}

/** "Call 112" and "Call 108 (ambulance)": real tel: links on their own row, 48px tall. */
export function CallButtons() {
  return (
    <p className="nv-tool-calls">
      <a href="tel:112" className="nv-tool-call">
        <Phone aria-hidden />
        {COMMON.call112}
      </a>
      <a href="tel:108" className="nv-tool-call">
        <Phone aria-hidden />
        {COMMON.call108}
      </a>
    </p>
  );
}

/** A safety line in full, as plain text. An emergency line (it names 112) is followed by the call buttons. */
export function SafetyFull({ text }: { text: string }) {
  return (
    <div className="nv-tool-safety">
      <p>{text}</p>
      {/\b112\b/.test(text) ? <CallButtons /> : null}
    </div>
  );
}

/** A quiet text button that opens a safety line in place, in full (SafetyFull), and closes it again. */
export function SafetyMore({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="nv-tool-more">
      <button type="button" aria-expanded={open} aria-controls={id} className="nv-tool-textlink" onClick={() => setOpen((was) => !was)}>
        {label}
      </button>
      <div id={id} hidden={!open} className="nv-tool-more-body">
        <SafetyFull text={text} />
      </div>
    </div>
  );
}

/**
 * A tool's safety guidance for the state it is in, as Layout slots. Contextual (config.ts
 * SAFETY_DISPLAY): the quiet line under the controls (`line`), a text button that opens the sentence in
 * place (`more`), or nothing where it does not apply. "always": the whole of `text`, in full, in the
 * flow, whatever the state. `shown`: the tool sets the full line itself beside a result, in either mode.
 */
export function safetySlots(
  text: string,
  here: { line?: string; more?: { label: string; text: string }; shown?: boolean } = {},
): Pick<LayoutSlots, "safety" | "quiet"> {
  if (here.shown) return {};
  if (SAFETY_DISPLAY === "always") return { safety: <SafetyFull text={text} /> };
  if (!here.line && !here.more) return {};
  return {
    quiet: (
      <>
        {here.line ? <QuietLine>{here.line}</QuietLine> : null}
        {here.more ? <SafetyMore label={here.more.label} text={here.more.text} /> : null}
      </>
    ),
  };
}

/** The main button: the shell's 56px nv-minute-primary, so it matches the shell and enters with it. */
export function PrimaryButton({ className, ...rest }: ComponentProps<"button">) {
  return <button type="button" className={cn("nv-minute-primary nv-tool-primary", className)} {...rest} />;
}

/** A quiet text button with a 44px target: the second choice after a session. */
export function QuietButton({ className, ...rest }: ComponentProps<"button">) {
  return <button type="button" className={cn("nv-minute-quiet nv-tool-quiet", className)} {...rest} />;
}

/**
 * What the main button says and does. With `form` it submits that form instead (Pulse's beat count).
 * `quiet`: an outline rather than the solid pill, for Pause while a session runs, so the orb stays the
 * one bright thing on the screen.
 */
export type MainAction = { label: string; run?(): void; form?: string; quiet?: boolean };
export type SideAction = { label: string; run(): void };

/**
 * The dock's buttons, the same in every tool: the main button alone, or with one ghost pill beside it
 * (Stop, End), and one quiet text button under it after a session (Again, Stay a little longer). The
 * main button is one element throughout (only its class and label change), so it keeps focus from Start
 * to Pause to Done; for 500 ms after its label changes it ignores presses, so the second tap of a double
 * tap never lands on the next action. If a side button leaves while it has focus, focus moves to the
 * main button, never to the page.
 */
export function ToolControls({
  main,
  mainRef,
  beside,
  under,
  held = false,
  hushed = false,
}: {
  main: MainAction;
  mainRef: RefObject<HTMLButtonElement | null>;
  /** A ghost pill beside the main button. */
  beside?: SideAction;
  /** A quiet text button under the row. */
  under?: SideAction;
  /** Pulse's armed pad: the main button keeps its place, hidden and inert, until the first tap. */
  held?: boolean;
  /** The stillness after a session: the buttons fade out and take no presses, and focus stays where it is. */
  hushed?: boolean;
}) {
  const refocus = useRef(false);
  const sideRef = useCallback((el: HTMLButtonElement | null) => {
    if (!el) return;
    // Runs as the button leaves the page, before it is removed: it still knows whether it had focus.
    return () => {
      if (document.activeElement === el) refocus.current = true;
    };
  }, []);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body) mainRef.current?.focus({ preventScroll: true });
  });

  const label = useRef(main.label);
  const changedAt = useRef(Number.NEGATIVE_INFINITY);
  useLayoutEffect(() => {
    if (label.current === main.label) return;
    label.current = main.label;
    changedAt.current = performance.now();
  }, [main.label]);

  const press = (e: MouseEvent<HTMLButtonElement>) => {
    if (hushed || performance.now() - changedAt.current < GUARD_MS) {
      // Also keeps a guarded press from submitting the form.
      e.preventDefault();
      return;
    }
    main.run?.();
  };

  return (
    <div className="nv-tool-controls" data-hushed={hushed ? "" : undefined}>
      <div className={beside ? "nv-minute-row" : "nv-tool-row"}>
        <PrimaryButton
          ref={mainRef}
          type={main.form ? "submit" : "button"}
          form={main.form}
          onClick={press}
          inert={held}
          data-quiet={main.quiet ? "" : undefined}
          className={cn(beside || main.quiet ? "nv-tool-paired" : "nv-tool-solo", held && "nv-tool-held")}
        >
          {main.label}
        </PrimaryButton>
        {beside ? (
          <button ref={sideRef} type="button" className="nv-minute-stop" onClick={beside.run}>
            {beside.label}
          </button>
        ) : null}
      </div>
      {under ? (
        <QuietButton ref={sideRef} onClick={under.run}>
          {under.label}
        </QuietButton>
      ) : null}
    </div>
  );
}

/** A radio styled as the shell's chip (nv-minute-chip): 44px, mint when chosen. */
export function ChipRadio({
  name,
  checked,
  onSelect,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect(): void;
  children: ReactNode;
}) {
  return (
    <label className="nv-minute-chip nv-tool-chip" data-on={checked ? "" : undefined}>
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span>{children}</span>
    </label>
  );
}

/** A prompt line with a reserved height, so the controls below don't jump as it changes. */
export function PromptLine({ children, swapKey, strong = false }: { children?: ReactNode; swapKey?: string | number; strong?: boolean }) {
  return (
    <p className={cn("nv-tool-prompt", strong && "nv-tool-prompt-strong")}>
      {children ? (
        <span key={swapKey} className="nv-tool-swap">
          {children}
        </span>
      ) : null}
    </p>
  );
}
