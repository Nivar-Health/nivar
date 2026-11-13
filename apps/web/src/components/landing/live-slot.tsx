"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DemoSignal } from "./live-dashboard";
import { useInView, useNear } from "./live-feeds";
import { useMotionPaused } from "./motion";
import { LiveDot, Pill } from "./primitives";
import { MINUTE_STATE_EVENT, isMinuteOpen } from "./take-a-minute/open";

/** The moving monitors and their simulators: a chunk of its own (live-dashboard.tsx). */
type Monitors = typeof import("./live-dashboard");

/** The phone breakpoint in range syntax, exactly as the CSS writes it, so the two never disagree at fractional widths. */
const PHONE_QUERY = "(width < 40rem)";

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Below sm. Behaviour only (which moving monitors mount, and how tall): the layout itself is CSS. */
function usePhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

function subscribeMinute(onChange: () => void) {
  window.addEventListener(MINUTE_STATE_EVENT, onChange);
  return () => window.removeEventListener(MINUTE_STATE_EVENT, onChange);
}

const subscribeNever = () => () => {};

/**
 * The readings dashboard's frame. Everything a visitor reads in it arrives server-rendered (live-panel.tsx):
 * the header, a still frame of each monitor and the vitals. That still is the whole demo without
 * JavaScript, under reduced motion or the page-wide pause, and when the monitors' chunk cannot load.
 *
 * Where motion plays, the chunk is fetched once the frame is within 600px of the screen and each moving
 * monitor fades in over its still. They stream and draw only while on screen; off screen, held with
 * Pause, or under Take a minute they keep their last frame and run no loop. Where motion rests, Play
 * starts them: motion the visitor asks for is fine.
 */
export function LiveDashboardSlot({
  signal,
  ecgPhone,
  ecg,
  steth,
  head,
  ecgStill,
  stethStill,
  className,
  children,
}: {
  signal: DemoSignal;
  /** Monitor heights in px: the ECG on phones, the ECG from 640px, the stethoscope (from 640px only). */
  ecgPhone: number;
  ecg: number;
  steth: number;
  /** Who and what the demo shows: the header's words. */
  head: ReactNode;
  ecgStill: ReactNode;
  stethStill: ReactNode;
  className?: string;
  /** The vitals, under the monitors. */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNear(ref);
  const inView = useInView(ref);
  const phone = usePhone();
  const motionPaused = useMotionPaused();
  /** Take a minute is open over the page (corner.tsx reports it): the traces rest under the sheet. */
  const minuteOpen = useSyncExternalStore(subscribeMinute, isMinuteOpen, () => false);
  /** The button means nothing before hydration, so it is not in the server's markup. */
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  /** The visitor's own Play or Pause. It holds while the page-wide setting it was made under does. */
  const [choice, setChoice] = useState<{ play: boolean; under: boolean } | null>(null);
  const wantsPlay = choice && choice.under === motionPaused ? choice.play : !motionPaused;
  const [monitors, setMonitors] = useState<Monitors | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!near || !wantsPlay || monitors || failed) return;
    let alive = true;
    import("./live-dashboard").then(
      (m) => alive && setMonitors(m),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [near, wantsPlay, monitors, failed]);

  /** What the button reports. A load that failed is not playing, so Play offers another try. */
  const playing = wantsPlay && !failed;
  const running = monitors !== null && wantsPlay && inView && !minuteOpen;
  const toggle = () => {
    setFailed(false);
    setChoice({ play: !playing, under: motionPaused });
  };

  return (
    <div
      ref={ref}
      className={cn(
        // inset-shadow-2xs + inset-shadow-white/6: a 1px top highlight (white at 6%) without a colour literal.
        "flex min-w-0 flex-col rounded-[1.5rem] border border-border bg-card p-3 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)] inset-shadow-2xs inset-shadow-white/6 sm:p-4 lg:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-2.5 sm:pb-4">
        <div className="min-w-0">{head}</div>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Below 360px the name needs the pill's room. */}
          <Pill tone="inverse" size="md" className="h-8 max-[22.5rem]:hidden sm:h-9">
            <LiveDot pulse={running} className="size-1.5" />
            <span>
              Doctor<span className="max-sm:hidden"> reviewing</span>
            </span>
          </Pill>
          {/* A 44px target around a circle the pill's height (check-ups.css). Its box is reserved, so the
              header does not move when the button arrives. */}
          <span className="nv-chk-hold-box">
            {hydrated && (
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause the demo" : "Play the demo"}
                className="nv-chk-hold"
              >
                <span aria-hidden>
                  {playing ? (
                    <Pause className="size-3.5" fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play className="size-3.5 translate-x-px" fill="currentColor" strokeWidth={0} />
                  )}
                </span>
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="nv-chk-mon shrink-0">
        {ecgStill}
        {monitors && (
          <monitors.LiveEcg
            signal={signal}
            running={running}
            paused={!wantsPlay}
            height={phone ? ecgPhone : ecg}
            className="nv-chk-dash"
          />
        )}
      </div>

      <div className="nv-chk-mon mt-3 shrink-0 max-sm:hidden">
        {stethStill}
        {monitors && !phone && (
          <monitors.LiveSteth signal={signal} running={running} paused={!wantsPlay} height={steth} className="nv-chk-dash" />
        )}
      </div>

      {children}
    </div>
  );
}
