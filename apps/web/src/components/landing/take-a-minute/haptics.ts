/* Vibration cues: an Android extra, offered only where the browser can vibrate and the pointer is a
   finger (desktop Chrome has navigator.vibrate but no motor), off by default, switched on from a
   click. Every cue has a visible twin. The pulses are long enough for the small motors in mid-range
   phones, which need 20 ms or more to spin up. The tools never buzz while a pulse is being counted. */

export type Buzz = "in" | "out" | "tap" | "done";

const PATTERN: Record<Buzz, number | number[]> = {
  in: 40,
  out: [30, 80, 30],
  tap: 20,
  done: [60, 100, 60],
};

export function canVibrate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function vibrate(kind: Buzz): void {
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch {
    // Blocked without a recent user gesture, or unsupported: a cue is never essential.
  }
}
