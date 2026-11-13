import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Session, SessionOptions, SessionPhase } from "./types";

/* The Take a minute clock. One loop, only during the lead-in and while running: animation frames for
   paced motion, or a timer when only the ring moves (options.tick). elapsed = banked + (now − since).
   React re-renders once a second; every tick goes to onFrame, which writes the ring and the orb through
   the api, never through React state. */

const LEAD_IN_MS = 3000;
/** A longer gap between ticks is sleep or a throttled tab, not time spent (pauseWhenHidden only). */
const MAX_FRAME_GAP_MS = 1000;

type View = Pick<Session, "phase" | "secondsLeft" | "leadInLeft" | "pausedByVisibility" | "totalMs" | "screenHeld">;

const IDLE: View = { phase: "idle", secondsLeft: 0, leadInLeft: 0, pausedByVisibility: false, totalMs: 0, screenHeld: null };

const secondsIn = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

const doneListeners = new Set<() => void>();

/** Called whenever any session reaches done: the shell's done-dot on the corner button, and its quiet ending. */
export function onSessionDone(listener: () => void): () => void {
  doneListeners.add(listener);
  return () => {
    doneListeners.delete(listener);
  };
}

/** "m:ss" for a countdown, e.g. formatClock(75) === "1:15" and formatClock(0) === "0:00". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Clock = Pick<Session, "start" | "pause" | "resume" | "stop" | "extend" | "getElapsed"> & { dispose(): void };

function createClock(options: () => SessionOptions, publish: (view: View) => void): Clock {
  let phase: SessionPhase = "idle";
  let total = 0;
  /** Running time banked before `since`. */
  let banked = 0;
  /** performance.now() when running last (re)started. */
  let since = 0;
  let leadSince = 0;
  /** The length of the lead-in now playing: the first one, or the shorter one before a Resume. */
  let leadLength = 0;
  let lastFrame = 0;
  let raf = 0;
  let timer = 0;
  /** This run started with a lead-in, so Resume after an away pause replays it. */
  let withLeadIn = true;
  let pausedFrom: "leadin" | "running" | null = null;
  let byVisibility = false;
  let disposed = false;
  let shown: View = IDLE;
  let lock: WakeLockSentinel | null = null;
  let wantLock = false;

  const leadMs = () => Math.max(0, options().leadInMs ?? LEAD_IN_MS);
  const elapsedAt = (now: number) => Math.min(total, phase === "running" ? banked + (now - since) : banked);

  function show(patch: Partial<View>) {
    if (disposed) return;
    const next = { ...shown, ...patch };
    if (
      next.phase === shown.phase &&
      next.secondsLeft === shown.secondsLeft &&
      next.leadInLeft === shown.leadInLeft &&
      next.pausedByVisibility === shown.pausedByVisibility &&
      next.totalMs === shown.totalMs &&
      next.screenHeld === shown.screenHeld
    ) {
      return;
    }
    shown = next;
    publish(next);
  }

  /**
   * Screen wake lock while counting: taken on start and resume, dropped on pause, stop, done and unmount.
   * The view says whether the browser granted it, so a tool can tell the person when the screen may
   * switch off before the end.
   */
  function holdScreen(on: boolean) {
    wantLock = on;
    if (!on) {
      lock?.release().catch(() => {});
      lock = null;
      return;
    }
    if (lock && !lock.released) {
      show({ screenHeld: true });
      return;
    }
    lock = null;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      show({ screenHeld: false });
      return;
    }
    // A hidden page cannot ask: onVisibility asks again when it shows.
    if (document.hidden) return;
    navigator.wakeLock.request("screen").then(
      (sentinel) => {
        if (wantLock && !disposed && !lock) {
          lock = sentinel;
          show({ screenHeld: true });
        } else sentinel.release().catch(() => {});
      },
      () => {
        if (wantLock) show({ screenHeld: false });
      },
    );
  }

  /** The next tick: a frame, or the session's timer. */
  function schedule() {
    const tick = options().tick ?? "frame";
    if (tick === "frame") raf = requestAnimationFrame(frame);
    else timer = window.setTimeout(frame, Math.max(16, tick));
  }

  function frame() {
    raf = 0;
    timer = 0;
    if (disposed || (phase !== "leadin" && phase !== "running")) return;
    const now = performance.now();
    const gap = now - lastFrame;
    lastFrame = now;
    if (gap > MAX_FRAME_GAP_MS && options().pauseWhenHidden) {
      if (phase === "running") since += gap;
      else leadSince += gap;
    }
    if (phase === "leadin") {
      const left = leadLength - (now - leadSince);
      if (left > 0) {
        show({ leadInLeft: secondsIn(left) });
        schedule();
        return;
      }
      phase = "running";
      // From the moment the lead-in ended, so a wall-clock session stays exact after a hidden tab.
      since = leadSince + leadLength;
      show({ phase, leadInLeft: 0 });
    }
    const elapsed = Math.max(0, banked + (now - since));
    if (elapsed >= total) {
      finish();
      return;
    }
    options().onFrame?.(elapsed, total);
    show({ secondsLeft: secondsIn(total - elapsed) });
    schedule();
  }

  function run() {
    if (raf || timer || disposed) return;
    lastFrame = performance.now();
    schedule();
  }

  function halt() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) window.clearTimeout(timer);
    raf = 0;
    timer = 0;
  }

  /** `landing`: one last frame exactly on the end. Not when Resume finds nothing left to run. */
  function finish(landing = true) {
    halt();
    phase = "done";
    banked = total;
    pausedFrom = null;
    byVisibility = false;
    holdScreen(false);
    if (landing) options().onFrame?.(total, total);
    show({ phase, secondsLeft: 0, leadInLeft: 0, pausedByVisibility: false, totalMs: total });
    options().onDone?.();
    doneListeners.forEach((listener) => listener());
  }

  function pauseNow(fromVisibility: boolean) {
    if (phase !== "leadin" && phase !== "running") return;
    if (phase === "running") banked = elapsedAt(performance.now());
    pausedFrom = phase;
    halt();
    phase = "paused";
    byVisibility = fromVisibility;
    holdScreen(false);
    show({ phase, leadInLeft: 0, pausedByVisibility: fromVisibility, secondsLeft: secondsIn(total - banked) });
  }

  function onVisibility() {
    if (disposed) return;
    if (document.hidden) {
      if (options().pauseWhenHidden) pauseNow(true);
      return;
    }
    // The browser drops a wake lock while the page is hidden; take it again for a wall-clock session.
    if (wantLock) holdScreen(true);
  }
  document.addEventListener("visibilitychange", onVisibility);

  return {
    start(totalMs, o) {
      if (disposed) return;
      halt();
      total = Math.max(0, totalMs);
      const at = Math.min(total, Math.max(0, o?.at ?? 0));
      banked = at;
      pausedFrom = null;
      byVisibility = false;
      withLeadIn = !at && o?.leadIn !== false && leadMs() > 0;
      const now = performance.now();
      if (withLeadIn) {
        phase = "leadin";
        leadSince = now;
        leadLength = leadMs();
        show({
          phase,
          totalMs: total,
          secondsLeft: secondsIn(total),
          leadInLeft: secondsIn(leadLength),
          pausedByVisibility: false,
          screenHeld: null,
        });
      } else {
        phase = "running";
        since = now;
        show({ phase, totalMs: total, secondsLeft: secondsIn(total - at), leadInLeft: 0, pausedByVisibility: false, screenHeld: null });
        options().onFrame?.(at, total);
      }
      holdScreen(true);
      run();
    },
    pause() {
      pauseNow(false);
    },
    resume() {
      if (disposed || phase !== "paused") return;
      const again = Math.max(0, options().resumeLeadInMs ?? 0);
      const replayLeadIn = again > 0 || pausedFrom === "leadin" || (byVisibility && withLeadIn);
      pausedFrom = null;
      byVisibility = false;
      const now = performance.now();
      if (replayLeadIn) {
        // Pick up at the start of a whole cycle. Only forward, so the countdown never counts up.
        const align = options().resumeAlignMs ?? 0;
        if (align > 0) banked = Math.min(total, Math.ceil(banked / align) * align);
        if (banked >= total) {
          finish(false);
          return;
        }
        phase = "leadin";
        leadSince = now;
        leadLength = again > 0 ? again : leadMs();
        show({ phase, pausedByVisibility: false, leadInLeft: secondsIn(leadLength), secondsLeft: secondsIn(total - banked) });
      } else {
        phase = "running";
        since = now;
        show({ phase, pausedByVisibility: false });
      }
      holdScreen(true);
      run();
    },
    stop() {
      halt();
      phase = "idle";
      total = 0;
      banked = 0;
      pausedFrom = null;
      byVisibility = false;
      holdScreen(false);
      show(IDLE);
    },
    extend(addMs) {
      if (disposed || phase === "idle" || !(addMs > 0)) return;
      if (phase === "done") {
        // Stay a little longer: continue from where it ended, so the breathing rhythm never breaks.
        banked = total;
        total += addMs;
        phase = "running";
        since = performance.now();
        show({ phase, totalMs: total, secondsLeft: secondsIn(addMs) });
        holdScreen(true);
        run();
        return;
      }
      total += addMs;
      show({ totalMs: total, secondsLeft: secondsIn(total - elapsedAt(performance.now())) });
    },
    getElapsed() {
      return elapsedAt(performance.now());
    },
    dispose() {
      disposed = true;
      halt();
      holdScreen(false);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

/**
 * A countdown session: idle → leadin → running ⇄ paused → done; stop() → idle.
 * Call the methods from event handlers or effects (not during render). Unmounting cancels the loop,
 * drops the wake lock and makes no further state updates.
 */
export function useSession(o: SessionOptions): Session {
  const latest = useRef(o);
  const clock = useRef<Clock | null>(null);
  const [view, setView] = useState<View>(IDLE);

  useLayoutEffect(() => {
    latest.current = o;
  });

  useLayoutEffect(() => {
    const c = createClock(() => latest.current, setView);
    clock.current = c;
    return () => {
      c.dispose();
      clock.current = null;
    };
  }, []);

  const start = useCallback((totalMs: number, so?: { leadIn?: boolean; at?: number }) => clock.current?.start(totalMs, so), []);
  const pause = useCallback(() => clock.current?.pause(), []);
  const resume = useCallback(() => clock.current?.resume(), []);
  const stop = useCallback(() => clock.current?.stop(), []);
  const extend = useCallback((addMs: number) => clock.current?.extend(addMs), []);
  const getElapsed = useCallback(() => clock.current?.getElapsed() ?? 0, []);

  return useMemo(
    () => ({ ...view, start, pause, resume, stop, extend, getElapsed }),
    [view, start, pause, resume, stop, extend, getElapsed],
  );
}
