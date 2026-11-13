"use client";

import { createElement, useLayoutEffect, useSyncExternalStore, type ReactElement } from "react";
import { MOTION_STORAGE_KEY } from "./motion";

export type Zone = "hero" | "mid" | "form";
export type HeroCta = "below" | "in" | "above";
export type ChromeSignals = Readonly<{ zone: Zone; heroCta: HeroCta; typing: boolean }>;

/** What the server renders for: the top of the page, nothing focused. */
const SERVER: ChromeSignals = Object.freeze({ zone: "hero", heroCta: "in", typing: false });
/** #callback enters the form zone at 15% visible and leaves it below 10%. */
const FORM_IN = 0.15;
const FORM_OUT = 0.1;
/** The footer joins the form zone once this much of it shows (it starts under the phone bar), and leaves when none does. */
const FOOTER_IN = 0.08;
/** A keyboard field lost focus and nothing took over: restore the chrome after this. */
const TYPING_RELEASE_MS = 150;
/** An on-screen keyboard takes more than this from the visual viewport; a browser toolbar takes less. */
const KEYBOARD_PX = 80;
/** This far one way is a direction: enough to ignore a resting thumb. */
const DIRECTION_PX = 8;
/** Where the pill follows the scroll direction (site-nav.css): a phone held sideways. */
const SHORT_LANDSCAPE = "(width >= 40rem) and (max-height: 32.5rem)";
/** Where the pill leaves mid-page and the bar takes over (site-nav.css). */
const PHONE = "(width < 40rem)";
/** The pill's bottom edge when it cannot be measured. */
const PILL_EDGE_PX = 76;
const KEYBOARD_FIELD =
  "textarea, select, input:not([type=radio], [type=checkbox], [type=button], [type=submit], [type=reset], [type=range], [type=color], [type=file], [type=image], [type=hidden])";

let state: ChromeSignals = SERVER;
/** False until the first commit: that one always writes the attributes, even when it equals SERVER. */
let reported = false;
let detach: (() => void) | null = null;
const listeners = new Set<() => void>();

/** A field outside any dialog that raises the on-screen keyboard (coarse pointers only). */
export function raisesKeyboard(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    el.matches(KEYBOARD_FIELD) &&
    !el.closest("[role=dialog]") &&
    matchMedia("(pointer: coarse)").matches
  );
}

function commit(next: ChromeSignals) {
  if (reported && next.zone === state.zone && next.heroCta === state.heroCta && next.typing === state.typing) return;
  reported = true;
  state = next;
  const root = document.documentElement;
  root.dataset.nvZone = next.zone;
  root.dataset.nvCta = next.heroCta;
  root.toggleAttribute("data-nv-typing", next.typing);
  listeners.forEach((notify) => notify());
}

function armTransitions() {
  const root = document.documentElement;
  if (root.hasAttribute("data-nv-chrome")) return;
  requestAnimationFrame(() => requestAnimationFrame(() => root.setAttribute("data-nv-chrome", "")));
}

/** The element the address points at, if any. */
function hashTarget(): HTMLElement | null {
  if (location.hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch {
    return null;
  }
}

function attach(): () => void {
  const root = document.documentElement;
  const cta = document.querySelector<HTMLElement>("main [data-nv-hero-cta]");
  const form = document.getElementById("callback");
  const footer = document.querySelector("[data-landing] > footer");
  // Observing the footer: a jump from below the form to above it crosses no #callback threshold.
  // Observing the hero section: on a short screen the CTA starts below the fold, and a jump past it (or
  // back to the top) carries it to the other side without it ever intersecting, which crosses none of
  // its own thresholds. A jump to any section, or back to the top, crosses one of the hero's: gone, the
  // CTA is above it; still in view, one read of the silent CTA settles its side.
  const hero = cta?.closest("section") ?? null;
  // The hero's button counts as in view only below the pill: under it nobody can see or tap it, so the
  // hand-off to the bar (or back to the pill) happens at the pill's lower edge, not the screen's. Phones
  // are the exception: there the pill leaves with the hand-off and would uncover the button beside the
  // bar's own, so the edge is the screen's.
  const pill = document.querySelector("[data-landing] > header .nv-nav-bar")?.getBoundingClientRect().bottom;
  const edge = window.matchMedia(PHONE).matches ? 0 : Math.round(pill && pill > 0 ? pill : PILL_EDGE_PX);
  let heroCta: HeroCta | null = cta ? null : "above"; // null until the first report
  let formOn = false;
  let footerOn = false;
  const report = () => {
    const h = heroCta ?? "in";
    commit({ ...state, heroCta: h, zone: formOn || footerOn ? "form" : h === "above" ? "mid" : "hero" });
    armTransitions();
  };

  const ctaIo = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      const top = e.rootBounds?.top ?? edge;
      const bottom = e.rootBounds?.bottom ?? innerHeight;
      const r = e.intersectionRatio;
      if (r >= 0.99) heroCta = "in";
      else if (!e.isIntersecting || r === 0) heroCta = e.boundingClientRect.top >= bottom ? "below" : "above";
      else if (r >= 0.5) heroCta = "in"; // half in view: the hero's own button is the screen's one marigold
      else if (heroCta === null) {
        // The first report finds it cut by an edge: the fold's side is the pill's to carry, the pill's side the bar's.
        heroCta = e.boundingClientRect.bottom > bottom ? "below" : e.boundingClientRect.top < top ? "above" : "in";
      }
      // Under half visible after the first report: keep the last state (the CTA's other half is the hysteresis).
      report();
    },
    { rootMargin: `-${edge}px 0px 0px 0px`, threshold: [0, 0.5, 1] },
  );
  if (cta) ctaIo.observe(cta);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.target === form) {
          formOn = e.intersectionRatio >= (formOn ? FORM_OUT : FORM_IN);
        } else if (e.target === footer) {
          footerOn = e.isIntersecting && (footerOn || e.intersectionRatio >= FOOTER_IN);
        } else if (!e.isIntersecting) {
          heroCta = e.boundingClientRect.top >= (e.rootBounds?.bottom ?? innerHeight) ? "below" : "above";
        } else if (cta && (heroCta === "above" || heroCta === "below")) {
          // The hero is in view and the CTA has said it is out of it; it may be on the other side now.
          const r = cta.getBoundingClientRect();
          if (r.top >= innerHeight) heroCta = "below";
          else if (r.bottom <= edge) heroCta = "above";
        }
      }
      report();
    },
    { threshold: [0, FOOTER_IN, FORM_OUT, FORM_IN] },
  );
  for (const el of [form, footer, hero]) if (el) io.observe(el);

  // Typing: a keyboard field has focus, is on screen, and its keyboard has not been put away. Android
  // keeps the focus when Back hides the keyboard, and a visitor may scroll off to check something with
  // the field still focused; either way the chrome comes back.
  const vv = window.visualViewport;
  let release = 0;
  let field: Element | null = null;
  let fieldInView = true;
  let fullHeight = 0;
  let keyboardUp = false;
  let putAway = false;
  const sync = () => commit({ ...state, typing: field !== null && fieldInView && !putAway });
  // Its own observer: the one above reads any target it does not know as the hero.
  const fieldIo = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    if (e.target !== field) return;
    fieldInView = e.isIntersecting;
    sync();
  });
  const watch = (el: Element) => {
    clearTimeout(release);
    if (el !== field) {
      fieldIo.disconnect();
      field = el;
      fieldInView = true;
      fieldIo.observe(el);
    }
    putAway = false;
    if (vv && !keyboardUp) fullHeight = vv.height;
    sync();
  };
  const unwatch = () => {
    fieldIo.disconnect();
    field = null;
    keyboardUp = false;
    putAway = false;
    sync();
  };
  const onFocusIn = (e: FocusEvent) => {
    if (raisesKeyboard(e.target)) watch(e.target as Element);
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!field || raisesKeyboard(e.relatedTarget)) return;
    clearTimeout(release);
    release = window.setTimeout(() => {
      if (!raisesKeyboard(document.activeElement)) unwatch();
    }, TYPING_RELEASE_MS);
  };
  // The keyboard only shrinks the visual viewport (the layout one where a browser resizes that instead).
  const onViewport = () => {
    if (!vv || !field) return;
    const up = vv.height < Math.max(window.innerHeight, fullHeight) - KEYBOARD_PX;
    if (up) putAway = false;
    else if (keyboardUp) putAway = true;
    keyboardUp = up;
    sync();
  };
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  vv?.addEventListener("resize", onViewport);
  if (raisesKeyboard(document.activeElement)) watch(document.activeElement as Element);

  // Back (or any move of the address) to somewhere outside the form: a field left focused there is off
  // screen now, and would hold the keyboard up and the next keystroke's scroll.
  const onMoved = () => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !form?.contains(el) || !el.matches(KEYBOARD_FIELD)) return;
    const to = hashTarget();
    if (!to || !form.contains(to)) el.blur();
  };
  window.addEventListener("hashchange", onMoved);
  window.addEventListener("popstate", onMoved);

  // The scroll direction, for a phone held sideways only: there the pill leaves on the way down and
  // returns on the first move up. Written only when it changes; no other layout listens to scroll.
  const sideways = window.matchMedia(SHORT_LANDSCAPE);
  let turnY = 0;
  let dir: "down" | "up" | null = null;
  const onScroll = () => {
    const y = Math.max(0, window.scrollY);
    // Still going the same way: the turning point follows.
    if (dir === "down" ? y >= turnY : dir === "up" && y <= turnY) {
      turnY = y;
      return;
    }
    if (Math.abs(y - turnY) < DIRECTION_PX) return;
    dir = y > turnY ? "down" : "up";
    turnY = y;
    root.dataset.nvDir = dir;
  };
  const onSideways = () => {
    window.removeEventListener("scroll", onScroll);
    dir = null;
    delete root.dataset.nvDir;
    if (!sideways.matches) return;
    turnY = Math.max(0, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
  };
  onSideways();
  sideways.addEventListener("change", onSideways);

  return () => {
    io.disconnect();
    ctaIo.disconnect();
    fieldIo.disconnect();
    clearTimeout(release);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    vv?.removeEventListener("resize", onViewport);
    window.removeEventListener("hashchange", onMoved);
    window.removeEventListener("popstate", onMoved);
    window.removeEventListener("scroll", onScroll);
    sideways.removeEventListener("change", onSideways);
    // A client-side move to /login unmounts the site layout: leave <html> clean for the product app.
    delete root.dataset.nvZone;
    delete root.dataset.nvCta;
    delete root.dataset.nvDir;
    root.removeAttribute("data-nv-typing");
    root.removeAttribute("data-nv-chrome");
    state = SERVER;
    reported = false;
  };
}

/**
 * attach(), and again when the screen crosses the phone width (a phone turned sideways): the hero
 * button's hand-off edge is read once per attach, and it differs on each side.
 */
function attachAcrossWidths(): () => void {
  let stop = attach();
  const phone = window.matchMedia(PHONE);
  const again = () => {
    stop();
    stop = attach();
  };
  phone.addEventListener("change", again);
  return () => {
    phone.removeEventListener("change", again);
    stop();
  };
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  detach ??= attachAcrossWidths();
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

/** SERVER during SSR and hydration, then live. Re-renders only on a change. */
export function useChromeSignals(): ChromeSignals {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** On <html> while the public site is mounted: landing.css paints the canvas white, globals.css glides in-page jumps. */
const SITE_CLASS = "nv-site";

/** Runs as the page is parsed: the class, and a pause the visitor chose on an earlier visit (motion.tsx). */
const BEFORE_PAINT = `(function(d){d.classList.add("${SITE_CLASS}");try{if(localStorage.getItem("${MOTION_STORAGE_KEY}")==="paused")d.setAttribute("data-motion","paused")}catch(e){}})(document.documentElement)`;

/**
 * Marks <html> as the public site, first thing in app/(site)/layout.tsx. A class, not
 * `html:has([data-landing])`: with <html> as a :has() anchor every node added anywhere restyles the
 * whole document. The inline script sets it before first paint on a full load; the layout effect covers
 * a client-side arrival (a script React inserts never runs) and takes it off again on the way to the
 * product app. <html> carries suppressHydrationWarning for it (app/layout.tsx).
 */
export function SiteRoot(): ReactElement {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(SITE_CLASS);
    return () => root.classList.remove(SITE_CLASS);
  }, []);
  return createElement("script", {
    // Executable in the server's HTML only: on the client it is inert text, so React has nothing to warn about.
    type: typeof window === "undefined" ? "text/javascript" : "text/plain",
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: { __html: BEFORE_PAINT },
  });
}
