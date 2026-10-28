type Entry = Record<string, unknown>;
const entryOf = (s: unknown): Entry | null => (typeof s === "object" && s !== null ? (s as Entry) : null);

let routerState: Entry | null = null;

/** Keeps the page's own router state (Next writes __NA and the tree); call on mount. */
export function keepRouterState(): void {
  const s = entryOf(window.history.state);
  if (s?.__NA) routerState = s;
}

/**
 * Replaces the current entry's hash. A state with __NA passes straight through Next 16.4's patched
 * replaceState (app-router.js ~l.299), so nothing re-renders mid-scroll. An entry without router
 * state (a native #hash click pushed it) gets the kept router state, never null.
 */
export function replaceHash(hash: `#${string}`): void {
  const s = entryOf(window.history.state);
  const state = s?.__NA ? s : routerState;
  if (!state) return;
  try {
    window.history.replaceState(state, "", `${location.pathname}${location.search}${hash}`);
  } catch {
    // Sandboxed frames and Safari's rate limit can refuse history writes; the jump still happens.
  }
}

/** Focus for screen readers and the next Tab: the heading the target is labelled by, else the target. */
export function focusLanding(target: HTMLElement): void {
  const labelId = target.getAttribute("aria-labelledby");
  const el = (labelId && document.getElementById(labelId)) || target;
  if (!el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
    el.setAttribute("data-nv-nav-target", "");
    el.addEventListener("blur", () => {
      el.removeAttribute("tabindex");
      el.removeAttribute("data-nv-nav-target");
    }, { once: true });
  }
  el.focus({ preventScroll: true });
}
