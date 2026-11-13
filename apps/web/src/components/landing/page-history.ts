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

/** A trip longer than this many screen heights arrives most of the way at once, then glides the rest. */
const LONG_TRIP = 1.5;
/** How far short of its landing a long trip arrives. */
const GLIDE_PX = 120;

/** Reduced motion, or the visitor's own pause (motion.tsx): a scroll jumps, nothing glides. */
export function motionOff(): boolean {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "paused"
  );
}

const scrollMarginTop = (el: HTMLElement) => parseFloat(getComputedStyle(el).scrollMarginTop) || 0;

/** `target` rests at its scroll margin, or the page can scroll no further towards it. */
export function arrivedAt(target: HTMLElement): boolean {
  const off = target.getBoundingClientRect().top - scrollMarginTop(target);
  if (Math.abs(off) < 2) return true;
  return off > 0
    ? Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight
    : window.scrollY <= 0;
}

/**
 * The one way a long in-page trip is made, whoever starts it (the bar, the menu, any `#id` link): the
 * page arrives 120px short of `target` at once and glides the rest, so a mid-range phone never streams
 * every section, photo and reveal in between. A trip of a screen and a half or less is left alone (CSS
 * scroll-behavior glides it), as is everything under reduced motion or the visitor's pause, where a
 * scroll simply jumps, and a target hidden in a closed drop-down (disclosure-hash.tsx aligns that one).
 * True when it took the scroll over.
 */
export function hopTowards(target: HTMLElement): boolean {
  if (motionOff() || !target.getClientRects().length) return false;
  const top = target.getBoundingClientRect().top;
  if (Math.abs(top) <= window.innerHeight * LONG_TRIP) return false;
  const y = window.scrollY + top - scrollMarginTop(target);
  window.scrollTo({ top: top > 0 ? y - GLIDE_PX : y + GLIDE_PX, behavior: "instant" });
  requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
  return true;
}
