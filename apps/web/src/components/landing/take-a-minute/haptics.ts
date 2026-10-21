/* Vibration cues (spec §5.12): offered only where the browser can vibrate and the pointer is a
   finger (desktop Chrome has navigator.vibrate but no motor), off by default, switched on from a
   click. The tools never buzz while a pulse is being counted. */

export type Buzz = "in" | "out" | "tap" | "done";

const PATTERN: Record<Buzz, number | number[]> = {
  in: 12,
  out: [8, 70, 8],
  tap: 8,
  done: [24, 90, 24],
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
