"use client";

import { Phone } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { formatClock, useSession } from "../engine";
import type { ExperienceApi, Session, Tone } from "../types";
import { ANNOUNCE, COMMON, type Rich } from "./copy";
import "./tools.css";

/* What the four tools share: a session hook over useSession that owns the time-left ring, the
   session-active flag and the clean-up, plus the small pieces of UI every tool renders. */

/** The orb's resting scale (spec §5.6): idle, done and every unpaced tool. */
export const ORB_REST = 0.62;
/** The orb's inner light at rest; reduced motion paces Breathe with it (.4 to 1) instead of the scale. */
export const GLOW_REST = 1;
const REFILL_MS = 600;

/** Time left as a share of the ring. The shell steps it once a second under reduced motion. */
function ringLeft(elapsedMs: number, totalMs: number): number {
  return totalMs > 0 ? Math.max(0, totalMs - elapsedMs) / totalMs : 1;
}

type ToolSessionOptions = {
  api: ExperienceApi;
  tone: Tone;
  pauseWhenHidden: boolean;
  /** Back from time away, the session resumes at the start of a whole cycle (engine.ts). */
  resumeAlignMs?: number;
  /** Every running frame, after the ring. Writes the orb and the field through the api only. */
  onFrame?(elapsedMs: number, totalMs: number, api: ExperienceApi): void;
  onDone?(api: ExperienceApi): void;
  /** Puts back what the tool changed on the orb and the field (Stop, and when the tool leaves). */
  onReset?(api: ExperienceApi): void;
  /** A tool-local state that also counts as a session (Pulse's armed tap pad). */
  holdActive?: boolean;
  /** The field's motes drift while the session runs (default true; Pulse keeps the screen still). */
  motes?: boolean;
};

export type ToolSession = Session & {
  /** leadin, running or paused (or holdActive): tabs and chips step aside, swipe is off. */
  active: boolean;
  /** Starts a session. The ring refills first, so it shows the whole length through the lead-in. */
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

  const session = useSession({
    pauseWhenHidden: o.pauseWhenHidden,
    resumeAlignMs: o.resumeAlignMs,
    onFrame(elapsed, total) {
      const { api, onFrame } = latest.current;
      api.ring.setRemaining(ringLeft(elapsed, total));
      onFrame?.(elapsed, total, api);
    },
    onDone() {
      const { api, onDone } = latest.current;
      // The ring ends empty. Normally the last frame put it there; after a Resume that found no
      // whole cycle left (resumeAlignMs) it eases there from where the pause left it.
      api.ring.refill(0, REFILL_MS);
      onDone?.(api);
    },
  });
  const { phase, start, pause, resume, stop } = session;

  const refillRing = useCallback((f: number) => latest.current.api.ring.refill(f, REFILL_MS), []);

  const touch = useCallback(() => {
    touched.current = true;
  }, []);

  const reset = useCallback(() => {
    if (!touched.current) return;
    touched.current = false;
    const { api, onReset } = latest.current;
    refillRing(1);
    onReset?.(api);
  }, [refillRing]);

  const begin = useCallback(
    (totalMs: number, b?: { leadIn?: boolean; refill?: boolean }) => {
      touched.current = true;
      if (b?.refill !== false) refillRing(1);
      start(totalMs, { leadIn: b?.leadIn ?? true });
    },
    [refillRing, start],
  );

  const halt = useCallback(() => {
    stop();
    reset();
  }, [stop, reset]);

  const togglePause = useCallback(() => {
    const { api } = latest.current;
    if (phase === "paused") {
      resume();
      api.announce(ANNOUNCE.resumed, { force: true });
    } else if (phase === "leadin" || phase === "running") {
      pause();
      api.announce(ANNOUNCE.paused, { force: true });
    }
  }, [phase, pause, resume]);

  const active = phase === "leadin" || phase === "running" || phase === "paused" || Boolean(o.holdActive);
  useEffect(() => {
    if (!active) return;
    const { api } = latest.current;
    api.setSessionActive(true);
    return () => api.setSessionActive(false);
  }, [active]);

  useEffect(() => {
    latest.current.api.orb.setTone(o.tone);
  }, [o.tone]);

  // Motes drift only while the clock runs: never paused, never after the end.
  const drift = phase === "running" && o.motes !== false;
  useEffect(() => {
    if (!drift) return;
    const { api } = latest.current;
    api.field.setMotes(true);
    return () => api.field.setMotes(false);
  }, [drift]);

  // Leaving the tool (a tab switch or closing) puts the ring, orb and field back for the next one.
  useEffect(() => reset, [reset]);

  return { ...session, active, begin, halt, togglePause, refillRing, touch };
}

/** The word in the orb's text layer (17px; it never scales with the orb). */
export function OrbWord({ children, className, ...rest }: ComponentProps<"span">) {
  return (
    <span className={cn("nv-tool-word", className)} {...rest}>
      {children}
    </span>
  );
}

/** The numeral in the orb (64px, 56 on phones). */
export function OrbNum({ children, className, ...rest }: ComponentProps<"span">) {
  return (
    <span className={cn("nv-tool-num", className)} {...rest}>
      {children}
    </span>
  );
}

/** "Get ready" with 3, 2, 1. */
export function LeadInOrb({ left }: { left: number }) {
  return (
    <>
      <OrbWord>{COMMON.getReady}</OrbWord>
      <OrbNum>{left}</OrbNum>
    </>
  );
}

/** The countdown: role="timer", not live (spec §5.11). Idle shows the length without the role. */
export function Clock({ seconds, running = true }: { seconds: number; running?: boolean }) {
  return (
    <p role={running ? "timer" : undefined} aria-label={running ? COMMON.timeLeft : undefined} className="nv-tool-clock">
      {formatClock(seconds)}
    </p>
  );
}

/** Time left, the same in every tool's session: the m:ss countdown under the orb, then "left of …". */
export function TimeLeft({ seconds, of, running = true }: { seconds: number; of: string; running?: boolean }) {
  return (
    <>
      <Clock seconds={seconds} running={running} />
      <p className="nv-tool-sub">{of}</p>
    </>
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

/** The always-visible emergency line, with 112 and 108 as tel: links. */
export function Emergency({ text }: { text: string }) {
  return (
    <p className="nv-tool-sos">
      <Phone aria-hidden className="nv-tool-sos-icon" />
      <span>
        {text.split(/\b(112|108)\b/).map((part, i) =>
          part === "112" || part === "108" ? (
            <a key={i} href={`tel:${part}`} className="nv-tool-tel">
              {part}
            </a>
          ) : (
            <Fragment key={i}>{part}</Fragment>
          ),
        )}
      </span>
    </p>
  );
}

/**
 * Start, Pause, Resume and the end-of-session action: 56px, at least 168px wide (spec §5.7). It wears
 * the shell's nv-minute-primary, so it matches the shell and enters 60ms after the chips (§5.8).
 */
export function PrimaryButton({ className, ...rest }: ComponentProps<"button">) {
  return <button type="button" className={cn("nv-minute-primary nv-tool-primary", className)} {...rest} />;
}

/** "Stop" and "Done": the shell's quiet text button, with a 44px target. */
export function QuietButton({ className, ...rest }: ComponentProps<"button">) {
  return <button type="button" className={cn("nv-minute-quiet nv-tool-quiet", className)} {...rest} />;
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
