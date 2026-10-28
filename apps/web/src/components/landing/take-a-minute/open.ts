import type { MinuteOpenDetail, ToolId } from "./types";

/** Fired on window; the corner cluster (cluster.tsx) listens and opens the experience. */
export const MINUTE_OPEN_EVENT = "nivar:minute-open";

/** Fired on window once the experience chunk has loaded: the corner renders it, closed, ahead of a tap. */
export const MINUTE_WARM_EVENT = "nivar:minute-warm";

/**
 * Fired on window by the corner whenever Take a minute opens or closes (`detail.open`), so a loop under
 * the sheet (the live ECG) can rest. A window event, not an html attribute: §1.4 keeps those for chrome-signals.
 */
export const MINUTE_STATE_EVENT = "nivar:minute-state";

let minuteOpen = false;

/** The corner's report: fires MINUTE_STATE_EVENT and keeps the state for a listener that mounts later. */
export function reportMinuteState(open: boolean): void {
  minuteOpen = open;
  window.dispatchEvent(new CustomEvent<{ open: boolean }>(MINUTE_STATE_EVENT, { detail: { open } }));
}

/** Whether Take a minute is open now: the initial state for a listener whose chunk arrives while it is. */
export const isMinuteOpen = (): boolean => minuteOpen;

/**
 * Opens Take a minute from client code (the nav sheet, for example). `tool` omitted or "" opens the
 * last-used tool. `origin` is the launcher: focus returns to it on close and the orb flies from it.
 * Markup-only launchers use `<button data-minute-open="<tool|''>" aria-haspopup="dialog">` instead.
 */
export function openTakeAMinute(tool?: ToolId | "", origin?: HTMLElement | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<MinuteOpenDetail>(MINUTE_OPEN_EVENT, { detail: { tool: tool ?? "", origin: origin ?? null } }),
  );
}

let chunk: Promise<typeof import("./experience")> | null = null;

/**
 * Loads the experience chunk once (memoized). A failed load is forgotten, so the next call retries.
 * When it arrives, MINUTE_WARM_EVENT lets the corner mount the scene ahead of the tap.
 */
export function prefetchTakeAMinute(): Promise<typeof import("./experience")> {
  chunk ??= import("./experience").then(
    (mod) => {
      window.dispatchEvent(new Event(MINUTE_WARM_EVENT));
      return mod;
    },
    (error: unknown) => {
      chunk = null;
      throw error;
    },
  );
  return chunk;
}
