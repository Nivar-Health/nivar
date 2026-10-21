/* Back closes Take a minute (spec §5.4). Opening pushes one history entry with no URL: Next 16.4's
   patched pushState copies its own state (__NA and the router tree) into it, so Back restores
   without a reload and without a scroll. Deep links are read, then stripped from the address. */

const MARK = "nvMinute";

type Entry = Record<string, unknown>;
const entryOf = (state: unknown): Entry | null => (typeof state === "object" && state !== null ? (state as Entry) : null);

/** The current history entry is the one Take a minute pushed. */
export function isMinuteEntry(): boolean {
  return entryOf(window.history.state)?.[MARK] === 1;
}

/** One entry per open; a second push on the same entry (Forward, then open) is skipped. */
export function pushMinuteEntry(): void {
  if (isMinuteEntry()) return;
  try {
    window.history.pushState({ [MARK]: 1 }, "");
  } catch {
    // A sandboxed frame can refuse history writes; Back then simply leaves the page as before.
  }
}

// The page's own entry state, as Next's router wrote it (it carries __NA).
let routerState: Entry | null = null;

/** Keeps the router's state of the current entry, when it has one (call on mount and before opening). */
export function keepRouterState(): void {
  const state = entryOf(window.history.state);
  if (state?.__NA && state[MARK] === undefined) routerState = state;
}

/**
 * Removes a #take-a-minute deep link from the address. A hash typed or followed on the page makes a
 * fresh entry with no router state, and Next reloads the page when Back lands on such an entry; so it
 * gets the page's router state, which Next's patched replaceState keeps as it is.
 */
export function stripHash(): void {
  const { pathname, search } = window.location;
  const state = entryOf(window.history.state);
  try {
    window.history.replaceState(state?.__NA ? state : routerState, "", pathname + search);
  } catch {
    // As above: the address keeps its hash, and nothing else changes.
  }
}
