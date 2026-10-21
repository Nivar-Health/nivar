"use client";

import { startTransition, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { HASH, TOOL_ENABLED, enabledTool, isToolId } from "./config";
import type { ExperienceProps } from "./experience";
import { keepRouterState, stripHash } from "./history";
import { MINUTE_OPEN_EVENT, MINUTE_WARM_EVENT, prefetchTakeAMinute } from "./open";
import type { MinuteOpenDetail, ToolId } from "./types";

/* The corner island (spec §5.3), first-load JS: no motion, no Base UI. It shows the pearl button,
   applies the visibility rules, peeks the label, loads the lazy experience on idle or intent, and
   opens it from the button, any [data-minute-open] launcher, MINUTE_OPEN_EVENT and the
   #take-a-minute deep links. The pearl and the WhatsApp button arrive server-rendered. */

const NAME = TOOL_ENABLED.pulse
  ? "Take a minute: breathing, rest, pulse and eye-break timers"
  : "Take a minute: breathing, rest and eye-break timers";
const LABEL = "Take a minute";
const FAILED = "Couldn't open. Try again.";

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

const flag = (el: HTMLElement | null, name: string, on: boolean) => el?.toggleAttribute(name, on);

const launcherOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>("[data-minute-open]") : null;

/** A field outside the dialog that raises the on-screen keyboard (coarse pointers only). */
const typingIn = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  el.matches(
    "textarea, select, input:not([type=radio], [type=checkbox], [type=button], [type=submit], [type=reset], [type=range], [type=color], [type=file], [type=image])",
  ) &&
  !el.closest("[role=dialog]") &&
  matchMedia("(pointer: coarse)").matches;

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

/** Whether the label, peeking, would lie over a control of the page: then it leaves that spot clear. */
function labelCovers(button: HTMLElement): boolean {
  const label = button.querySelector(".nv-minute-corner-label");
  if (!label) return false;
  const circle = button.getBoundingClientRect();
  const pill = label.getBoundingClientRect();
  const cluster = button.parentElement;
  for (const y of [0.3, 0.5, 0.7].map((k) => pill.top + pill.height * k)) {
    for (let i = 0; i < 4; i++) {
      const x = circle.left - 2 - ((circle.left - pill.left - 8) * i) / 3;
      const hit = document.elementsFromPoint(x, y).find((el) => !cluster?.contains(el));
      if (hit?.closest("a[href], button, summary, label, input, select, textarea, [role=button]")) return true;
    }
  }
  return false;
}

export function Corner({ pearl, whatsapp }: { pearl: ReactNode; whatsapp: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const [Experience, setExperience] = useState<ComponentType<ExperienceProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<ToolId | null>(null);
  // Hidden until the observers report: the pearl must not flash over the hero on load.
  const [hero, setHero] = useState(true);
  const [overForm, setOverForm] = useState(false);
  const [typing, setTyping] = useState(false);
  const [failed, setFailed] = useState(false);

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

  const request = useCallback((wanted: ToolId | "" | undefined, opener: HTMLElement | null) => {
    if (openRef.current) return;
    keepRouterState();
    openerRef.current = opener;
    originRef.current = originOf(opener);
    const go = (Loaded: ComponentType<ExperienceProps>) => {
      openRef.current = true;
      // The button fades under the pond: its first-appearance breath and peek end here.
      flag(buttonRef.current, "data-intro", false);
      flag(buttonRef.current, "data-peek", false);
      setExperience(() => Loaded);
      setTool((last) => (wanted ? enabledTool(wanted) : (last ?? storedTool())));
      setFailed(false);
      setOpen(true);
    };
    if (loaded) return go(loaded);
    flag(buttonRef.current, "data-loading", true);
    load().then(go, () => {
      flag(buttonRef.current, "data-loading", false);
      setFailed(true);
    });
  }, []);

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

  // Visibility: the pearl leaves while the hero is ≥ 30% visible; both buttons leave over the
  // callback form (≥ 15%) and, on touch, while a field has focus.
  useEffect(() => {
    const observe = (el: Element | undefined, ratio: number, set: (on: boolean) => void) => {
      if (!el) return set(false);
      const io = new IntersectionObserver(([entry]) => set(entry.intersectionRatio >= ratio), {
        threshold: [0, ratio],
      });
      io.observe(el);
      return () => io.disconnect();
    };
    const stopTop = observe(document.getElementById("top") ?? undefined, 0.3, setHero);
    const stopForm = observe(document.getElementById("callback") ?? undefined, 0.15, setOverForm);
    const onFocusIn = (e: FocusEvent) => setTyping(typingIn(e.target));
    const onFocusOut = (e: FocusEvent) => setTyping(typingIn(e.relatedTarget));
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      stopTop?.();
      stopForm?.();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // First appearance on this page load, armed once: one breath and one ripple; the label peeks for
  // 4 s once the page is still (so it is seen, and checked against what lies under it), unless it
  // would cover a control there, when it waits for the next scroll to settle, once, within 8 s; and
  // the experience downloads when the browser is idle.
  const visible = !hero && !overForm && !typing && !open;
  const appeared = useRef(false);
  useEffect(() => {
    const button = buttonRef.current;
    if (!visible || appeared.current || !button) return;
    appeared.current = true;
    const since = performance.now();
    flag(button, "data-intro", true);
    later(3600, () => flag(button, "data-intro", false));
    const peek = (retry: boolean) => {
      if (performance.now() - since > 8000) return;
      if (shown(button) && !labelCovers(button)) {
        flag(button, "data-peek", true);
        later(4000, () => flag(button, "data-peek", false));
      } else if (retry) pending.current.add(afterNextScroll(() => peek(false), 150));
    };
    later(400, () => pending.current.add(whenStill(() => peek(true), 150)));
    if (frugal()) return;
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(() => load().catch(() => {}), { timeout: 2000 });
      pending.current.add(() => cancelIdleCallback(idle));
    } else later(2000, () => load().catch(() => {}));
  }, [visible, later]);

  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => setFailed(false), 4000);
    return () => clearTimeout(t);
  }, [failed]);

  const onOpenChange = useCallback((next: boolean) => {
    openRef.current = next;
    if (!next) flag(buttonRef.current, "data-loading", false);
    setOpen(next);
  }, []);

  // The opener while it is still in the page, else the corner button while it may show, else the
  // page's headline (h1#hero-title, tabIndex -1): never nothing, which would drop focus to <body>.
  const returnFocus = useCallback(() => {
    const opener = openerRef.current;
    if (opener?.isConnected) return opener;
    const button = buttonRef.current;
    if (button && !button.hasAttribute("data-hidden") && !wrapRef.current?.hasAttribute("data-hidden")) return button;
    return document.getElementById("hero-title");
  }, []);

  // A launcher's pearl, else the corner's own pearl while the corner may show, else nothing.
  const origin = useCallback(() => {
    const el = originRef.current;
    const button = buttonRef.current;
    if (el?.isConnected && !button?.contains(el)) return el;
    const visibleNow = button && !button.hasAttribute("data-hidden") && !wrapRef.current?.hasAttribute("data-hidden");
    return visibleNow ? button.querySelector<HTMLElement>(".nv-minute-pearl") : null;
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
      <div ref={wrapRef} className="nv-minute-cluster" data-hidden={overForm || typing ? "" : undefined}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={NAME}
          aria-haspopup="dialog"
          data-pause-trigger=""
          data-hidden={hero ? "" : undefined}
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
