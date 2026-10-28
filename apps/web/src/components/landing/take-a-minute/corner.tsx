"use client";

import { startTransition, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useChromeSignals } from "../chrome-signals";
import { ENABLED_TOOLS, HASH, TOOL_LABEL, enabledTool, isToolId } from "./config";
import type { ExperienceProps } from "./experience";
import { keepRouterState, stripHash } from "./history";
import { MINUTE_OPEN_EVENT, MINUTE_WARM_EVENT, prefetchTakeAMinute, reportMinuteState } from "./open";
import type { MinuteOpenDetail, ToolId } from "./types";

/* The corner island (spec §5.3), first-load JS: no motion, no Base UI. It shows the pearl button,
   applies the visibility rules, peeks the label, loads the lazy experience on idle or intent, and
   opens it from the button, any [data-minute-open] launcher, MINUTE_OPEN_EVENT and the
   #take-a-minute deep links. The pearl and the WhatsApp button arrive server-rendered.
   Below 640px the corner's buttons are display:none (mobile spec D6), but the island stays: it hosts
   Take a minute for every launcher, prefetches it as a launcher nears, and marks the launcher a visitor
   tapped while the chunk loads or fails (§1.17). */

/** The config names (mobile spec §1.16), as every launcher uses them: "Take a minute: Breathe, BP rest, Eyes". */
const NAME = `Take a minute: ${ENABLED_TOOLS.map((t) => TOOL_LABEL[t]).join(", ")}`;
const LABEL = "Take a minute";
const FAILED = "Couldn't open. Try again.";
/** How long the failure note (and the launcher's danger outline) shows. */
const FAILED_MS = 4000;

let loaded: ComponentType<ExperienceProps> | null = null;
const load = () => prefetchTakeAMinute().then((mod) => (loaded = mod.Experience));

/** The tool used last time (prefs.ts keeps it in nivar.minute.v1). */
function storedTool(): ToolId {
  try {
    return enabledTool(JSON.parse(localStorage.getItem("nivar.minute.v1") ?? "{}").tool);
  } catch {
    return "breathe";
  }
}

/** Where a launcher's orb flies from: its scope's [data-minute-origin], a pearl inside it, or itself. */
function originOf(el: HTMLElement | null): HTMLElement | null {
  return (
    el?.closest("[data-minute-scope]")?.querySelector<HTMLElement>("[data-minute-origin]") ??
    el?.querySelector<HTMLElement>(".nv-minute-pearl") ??
    el
  );
}

const flag = (el: Element | null | undefined, name: string, on: boolean) => el?.toggleAttribute(name, on);

const launcherOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>("[data-minute-open]") : null;

/** Laid out at all: below 640px the corner's buttons are display:none (landing.css, cluster.css). */
const rendered = (el: Element | null | undefined) => (el?.getClientRects().length ?? 0) > 0;

/** In the page and showing: neither display:none nor visibility:hidden, itself or through an ancestor. */
function showing(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el?.isConnected) return false;
  return "checkVisibility" in el ? el.checkVisibility({ visibilityProperty: true }) : rendered(el);
}

/** Save-Data, or a 2G-class link: nothing is downloaded on speculation (intent and a tap still load). */
function frugal(): boolean {
  const link = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return link?.saveData === true || link?.effectiveType === "2g" || link?.effectiveType === "slow-2g";
}

/** Runs `run` once the page has not scrolled for `ms` (after `ms`, if it is still); returns a cancel. */
function whenStill(run: () => void, ms: number): () => void {
  let timer = setTimeout(done, ms);
  function onScroll() {
    clearTimeout(timer);
    timer = setTimeout(done, ms);
  }
  function done() {
    removeEventListener("scroll", onScroll);
    run();
  }
  addEventListener("scroll", onScroll, { passive: true });
  return () => {
    clearTimeout(timer);
    removeEventListener("scroll", onScroll);
  };
}

/** Runs `run` when the next scroll has settled; returns a cancel. */
function afterNextScroll(run: () => void, ms: number): () => void {
  let cancel = () => removeEventListener("scroll", onScroll);
  function onScroll() {
    removeEventListener("scroll", onScroll);
    cancel = whenStill(run, ms);
  }
  addEventListener("scroll", onScroll, { passive: true });
  return () => cancel();
}

const shown = (button: HTMLElement) =>
  !button.matches("[data-hidden], [data-open]") && !button.closest("[data-hidden]");

/**
 * Whether the label, peeking, would lie over or against a control of the page: then it leaves that spot
 * clear. Its taps are its own while it peeks, so it is tested where it will show (a stadium: its left end
 * is round) and 4px beyond, top and bottom rows included.
 */
function labelCovers(button: HTMLElement): boolean {
  const label = button.querySelector(".nv-minute-corner-label");
  if (!label) return false;
  const circle = button.getBoundingClientRect();
  const pill = label.getBoundingClientRect();
  const cluster = button.parentElement;
  const r = pill.height / 2;
  for (const k of [-0.08, 0.15, 0.5, 0.85, 1.08]) {
    const y = pill.top + pill.height * k;
    const dy = Math.min(r, Math.abs(y - pill.top - r));
    const left = pill.left + r - Math.sqrt(r * r - dy * dy) - 4;
    for (let i = 0; i < 5; i++) {
      const x = circle.left - 2 - ((circle.left - 2 - left) * i) / 4;
      const hit = document.elementsFromPoint(x, y).find((el) => !cluster?.contains(el));
      if (hit?.closest("a[href], button, summary, label, input, select, textarea, [role=button]")) return true;
    }
  }
  return false;
}

/**
 * The peek ends on the first scroll or touch elsewhere (A3-02): a press on the corner itself is left alone,
 * so the label it shows takes the tap and opens Take a minute. Returns a cancel.
 */
function endPeekOnInput(button: HTMLElement, end: () => void): () => void {
  const onScroll = () => end();
  const onPress = (e: PointerEvent) => {
    if (!(e.target instanceof Node && button.contains(e.target))) end();
  };
  addEventListener("scroll", onScroll, { passive: true, once: true });
  document.addEventListener("pointerdown", onPress, { capture: true, passive: true });
  return () => {
    removeEventListener("scroll", onScroll);
    document.removeEventListener("pointerdown", onPress, { capture: true });
  };
}

export function Corner({ pearl, whatsapp }: { pearl: ReactNode; whatsapp: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  /** The launcher that carries data-minute-failed, so it is cleared even after another tap. */
  const failedOnRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const [Experience, setExperience] = useState<ComponentType<ExperienceProps> | null>(null);
  const [open, setOpen] = useState(false);
  // Tells the live ECG (live-dashboard.tsx) to rest while the sheet covers the page.
  useEffect(() => reportMinuteState(open), [open]);
  const [tool, setTool] = useState<ToolId | null>(null);
  const [failed, setFailed] = useState(false);
  // Hidden at the hero (the store reports "hero" until its first report, so the pearl never flashes
  // there on load); both buttons leave over the form and the footer, and on touch while a field has focus.
  const { zone, typing } = useChromeSignals();
  const atHero = zone === "hero";
  const away = zone === "form" || typing;

  // The one-shots (the first appearance's breath, ripple, peek and idle prefetch, and the deferred
  // render below) hold their timers and listeners here; only an unmount cancels them, so a corner
  // that hides or opens in the meantime still ends every one.
  const pending = useRef(new Set<() => void>());
  useEffect(() => {
    const cancels = pending.current;
    return () => {
      for (const cancel of cancels) cancel();
      cancels.clear();
    };
  }, []);
  const later = useCallback((ms: number, run: () => void) => {
    const timer = setTimeout(run, ms);
    pending.current.add(() => clearTimeout(timer));
  }, []);

  // Load the experience and render it, closed and hidden, in the background: a tap then only plays
  // the opening instead of first mounting a dialog, a stage and a tool. On intent, at once.
  const warm = useCallback(() => {
    load().then(
      (Loaded) =>
        startTransition(() => {
          setExperience((current: ComponentType<ExperienceProps> | null) => current ?? Loaded);
          setTool((last) => last ?? storedTool());
        }),
      () => {},
    );
  }, []);

  // A chunk that arrived without intent (the idle prefetch, or another launcher's) renders once the
  // page has been still for 300ms, so that long first render never lands in the middle of a flick.
  const deferred = useRef(false);
  const warmWhenStill = useCallback(() => {
    if (deferred.current) return;
    deferred.current = true;
    pending.current.add(whenStill(warm, 300));
  }, [warm]);

  // §1.17: the corner button's own data-loading / data-failed, mirrored on the launcher that was tapped
  // (namespaced, as it may be another component's element), set and cleared together.
  const setLoading = useCallback((on: boolean) => {
    const button = buttonRef.current;
    const opener = openerRef.current;
    flag(button, "data-loading", on);
    if (opener !== button) flag(opener, "data-minute-loading", on);
  }, []);
  const clearFailed = useCallback(() => {
    flag(failedOnRef.current, "data-minute-failed", false);
    failedOnRef.current = null;
    setFailed(false);
  }, []);

  const request = useCallback(
    (wanted: ToolId | "" | undefined, opener: HTMLElement | null) => {
      if (openRef.current) return;
      keepRouterState();
      // A new tap clears the last failure, wherever it showed.
      clearFailed();
      if (openerRef.current !== opener) setLoading(false);
      openerRef.current = opener;
      originRef.current = originOf(opener);
      const go = (Loaded: ComponentType<ExperienceProps>) => {
        openRef.current = true;
        // The button fades under the pond: its first-appearance breath and peek end here.
        flag(buttonRef.current, "data-intro", false);
        flag(buttonRef.current, "data-peek", false);
        setExperience(() => Loaded);
        setTool((last) => (wanted ? enabledTool(wanted) : (last ?? storedTool())));
        setOpen(true);
      };
      if (loaded) return go(loaded);
      setLoading(true);
      load().then(go, () => {
        if (openerRef.current !== opener) return;
        setLoading(false);
        if (opener && opener !== buttonRef.current) {
          flag(opener, "data-minute-failed", true);
          failedOnRef.current = opener;
        }
        setFailed(true);
      });
    },
    [clearFailed, setLoading],
  );

  // Launchers, the open event and deep links.
  useEffect(() => {
    keepRouterState();
    const onOpenEvent = (e: Event) => {
      const detail: MinuteOpenDetail = (e as CustomEvent<MinuteOpenDetail>).detail ?? {};
      request(detail.tool, detail.origin ?? null);
    };
    const onClick = (e: MouseEvent) => {
      const el = launcherOf(e.target);
      if (!el) return;
      if (el instanceof HTMLAnchorElement) e.preventDefault();
      const value = el.getAttribute("data-minute-open");
      request(isToolId(value) ? value : "", el);
    };
    const onIntent = (e: Event) => {
      if (launcherOf(e.target)) warm();
    };
    const onHash = () => {
      const target = HASH[location.hash];
      if (location.pathname !== "/" || target === undefined) return;
      stripHash();
      request(target, null);
    };
    addEventListener(MINUTE_OPEN_EVENT, onOpenEvent);
    addEventListener(MINUTE_WARM_EVENT, warmWhenStill);
    addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    for (const type of ["pointerover", "touchstart", "focusin"]) {
      document.addEventListener(type, onIntent, { passive: true });
    }
    const deepLink = setTimeout(onHash, 0);
    return () => {
      removeEventListener(MINUTE_OPEN_EVENT, onOpenEvent);
      removeEventListener(MINUTE_WARM_EVENT, warmWhenStill);
      removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      for (const type of ["pointerover", "touchstart", "focusin"]) document.removeEventListener(type, onIntent);
      clearTimeout(deepLink);
    };
  }, [request, warm, warmWhenStill]);

  // The ways in on the page (the Small habits tile, the footer, the success state) are where phones
  // open it, with no corner to prefetch from: the chunk loads as soon as one comes within a screen of
  // view, then renders when the page is still. Never on speculation under Save-Data or 2G.
  useEffect(() => {
    if (frugal()) return;
    const scopes = document.querySelectorAll("[data-minute-scope]");
    if (!scopes.length) return;
    const near = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near.disconnect();
        load().then(warmWhenStill, () => {});
      },
      { rootMargin: "100% 0px" },
    );
    scopes.forEach((scope) => near.observe(scope));
    return () => near.disconnect();
  }, [warmWhenStill]);

  // First appearance on this page load (from 640px, where the corner is laid out), armed once: one
  // breath and one ripple; the label peeks for 4 s once the page is still (so it is seen, and checked
  // against what lies under it), unless it would cover a control there, when it waits for the next
  // scroll to settle, once, within 8 s; and the experience downloads when the browser is idle. The peek
  // ends early on the first scroll or touch, and while it shows its label takes the tap (cluster.css).
  const visible = !atHero && !away && !open;
  const appeared = useRef(false);
  useEffect(() => {
    const button = buttonRef.current;
    if (!visible || appeared.current || !button || !rendered(button)) return;
    appeared.current = true;
    const since = performance.now();
    flag(button, "data-intro", true);
    later(3600, () => flag(button, "data-intro", false));
    const peek = (retry: boolean) => {
      if (performance.now() - since > 8000) return;
      if (shown(button) && !labelCovers(button)) {
        let stop = () => {};
        const end = () => {
          stop();
          flag(button, "data-peek", false);
        };
        flag(button, "data-peek", true);
        stop = endPeekOnInput(button, end);
        pending.current.add(stop);
        later(4000, end);
      } else if (retry) pending.current.add(afterNextScroll(() => peek(false), 150));
    };
    later(400, () => pending.current.add(whenStill(() => peek(true), 150)));
    if (frugal()) return;
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(() => load().catch(() => {}), { timeout: 2000 });
      pending.current.add(() => cancelIdleCallback(idle));
    } else later(2000, () => load().catch(() => {}));
  }, [visible, later]);

  // The failure note shows for 4 s, on the corner and on the launcher that was tapped.
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(clearFailed, FAILED_MS);
    return () => clearTimeout(t);
  }, [failed, clearFailed]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      openRef.current = next;
      if (!next) setLoading(false);
      setOpen(next);
    },
    [setLoading],
  );

  // Where focus goes on close, never <body>: the launcher while it still shows; the corner button while
  // it is laid out and not hidden; the bar's Menu tab while the bar shows; else the page's headline
  // (h1#hero-title, tabIndex -1).
  const returnFocus = useCallback(() => {
    const opener = openerRef.current;
    if (showing(opener)) return opener;
    const button = buttonRef.current;
    if (button && rendered(button) && !button.hasAttribute("data-hidden") && !wrapRef.current?.hasAttribute("data-hidden")) {
      return button;
    }
    const tab = document.getElementById("nv-menu-bar");
    if (showing(tab)) return tab;
    return document.getElementById("hero-title");
  }, []);

  // Where the orb rises from and lands: the launcher's pearl (or the launcher) while it is laid out; else
  // the corner's own pearl while the corner is laid out and shown; else nothing (a centred bloom).
  const origin = useCallback(() => {
    const el = originRef.current;
    const button = buttonRef.current;
    if (el?.isConnected && rendered(el) && !button?.contains(el)) return el;
    const cornerShows =
      button && rendered(button) && !button.hasAttribute("data-hidden") && !wrapRef.current?.hasAttribute("data-hidden");
    return cornerShows ? button.querySelector<HTMLElement>(".nv-minute-pearl") : null;
  }, []);

  // The handoff: the orb is back in its pearl. The corner's pearl settles when it was the landing
  // spot, and a mint dot marks a finished session.
  const onClosed = useCallback(
    ({ completed }: { completed: boolean }) => {
      const pulse = (name: string, ms: number) => {
        flag(buttonRef.current, name, true);
        setTimeout(() => flag(buttonRef.current, name, false), ms);
      };
      const landing = origin();
      if (landing && buttonRef.current?.contains(landing)) pulse("data-settle", 360);
      if (completed) pulse("data-done", 4000);
    },
    [origin],
  );

  return (
    <>
      <div ref={wrapRef} className="nv-minute-cluster" data-hidden={away ? "" : undefined}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={NAME}
          aria-haspopup="dialog"
          data-pause-trigger=""
          data-hidden={atHero ? "" : undefined}
          data-open={open ? "" : undefined}
          data-failed={failed ? "" : undefined}
          className="nv-minute-corner"
          onClick={(e) => request("", e.currentTarget)}
          onPointerEnter={warm}
          onFocus={warm}
        >
          {[LABEL, FAILED].map((text) => (
            <span key={text} aria-hidden className="nv-minute-corner-label" data-note={text === FAILED ? "" : undefined}>
              <span className="nv-minute-corner-shade" />
              <span className="nv-minute-corner-pill">
                <span>{text}</span>
              </span>
            </span>
          ))}
          {pearl}
          <span aria-hidden className="nv-minute-corner-dot" />
        </button>
        <span className="nv-minute-wa">{whatsapp}</span>
      </div>
      {/* Outside the cluster, so it still announces below 640px, where the cluster is display:none. */}
      <span role="status" className="sr-only">
        {failed ? FAILED : ""}
      </span>
      {Experience && tool ? (
        <Experience
          open={open}
          tool={tool}
          onToolChange={setTool}
          onOpenChange={onOpenChange}
          returnFocus={returnFocus}
          origin={origin}
          onClosed={onClosed}
        />
      ) : null}
    </>
  );
}
