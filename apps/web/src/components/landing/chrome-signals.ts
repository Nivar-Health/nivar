"use client";

import { useSyncExternalStore } from "react";

export type Zone = "hero" | "mid" | "form";
export type HeroCta = "below" | "in" | "above";
export type ChromeSignals = Readonly<{ zone: Zone; heroCta: HeroCta; typing: boolean }>;

/** What the server renders for: the top of the page, nothing focused. */
const SERVER: ChromeSignals = Object.freeze({ zone: "hero", heroCta: "in", typing: false });
/** #callback enters the form zone at 15% visible and leaves it below 10%. */
const FORM_IN = 0.15;
const FORM_OUT = 0.1;
/** A keyboard field lost focus and nothing took over: restore the chrome after this. */
const TYPING_RELEASE_MS = 150;
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

function attach(): () => void {
  const cta = document.querySelector<HTMLElement>("main [data-nv-hero-cta]");
  const form = document.getElementById("callback");
  const footer = document.querySelector("[data-landing] > footer");
  // Observing the footer: a jump from below the form to above it crosses no #callback threshold.
  // Observing the hero section: on a short screen the CTA starts below the fold, and a jump past it (or
  // back to the top) carries it to the other side without it ever intersecting, which crosses none of
  // its own thresholds. A jump to any section, or back to the top, crosses one of the hero's: gone, the
  // CTA is above it; still in view, one read of the silent CTA settles its side.
  const hero = cta?.closest("section") ?? null;
  let heroCta: HeroCta | null = cta ? null : "above"; // null until the first report
  let formOn = false;
  let footerOn = false;
  const io = new IntersectionObserver(
    (entries) => {
      let ctaReported = false;
      let heroInView = false;
      for (const e of entries) {
        const bottom = e.rootBounds?.bottom ?? innerHeight;
        if (e.target === cta) {
          ctaReported = true;
          const r = e.intersectionRatio;
          if (r >= 0.99) heroCta = "in";
          else if (!e.isIntersecting || r === 0) heroCta = e.boundingClientRect.top >= bottom ? "below" : "above";
          else if (r >= 0.5) heroCta = "in"; // half in view: the hero's own button is the screen's one marigold (D4, §5's 50% rule)
          else if (heroCta === null) heroCta = e.boundingClientRect.bottom > bottom ? "below" : "in";
          // Under half visible after the first report: keep the last state (the CTA's lower half is the hysteresis).
        } else if (e.target === form) {
          formOn = e.intersectionRatio >= (formOn ? FORM_OUT : FORM_IN);
        } else if (e.target === footer) {
          footerOn = e.isIntersecting;
        } else {
          heroInView = e.isIntersecting;
          if (!e.isIntersecting) heroCta = e.boundingClientRect.top >= bottom ? "below" : "above";
        }
      }
      // The CTA said nothing, so it is still out of view; it may be on the other side now.
      if (heroInView && !ctaReported && cta && (heroCta === "above" || heroCta === "below")) {
        const r = cta.getBoundingClientRect();
        if (r.top >= innerHeight) heroCta = "below";
        else if (r.bottom <= 0) heroCta = "above";
      }
      const h = heroCta ?? "in";
      commit({ ...state, heroCta: h, zone: formOn || footerOn ? "form" : h === "above" ? "mid" : "hero" });
      armTransitions();
    },
    { threshold: [0, FORM_OUT, FORM_IN, 0.5, 1] },
  );
  for (const el of [cta, form, footer, hero]) if (el) io.observe(el);

  let release = 0;
  const onFocusIn = (e: FocusEvent) => {
    if (!raisesKeyboard(e.target)) return;
    clearTimeout(release);
    commit({ ...state, typing: true });
  };
  const onFocusOut = (e: FocusEvent) => {
    if (!state.typing || raisesKeyboard(e.relatedTarget)) return;
    clearTimeout(release);
    release = window.setTimeout(() => {
      if (!raisesKeyboard(document.activeElement)) commit({ ...state, typing: false });
    }, TYPING_RELEASE_MS);
  };
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  if (raisesKeyboard(document.activeElement)) commit({ ...state, typing: true });

  return () => {
    io.disconnect();
    clearTimeout(release);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    // A client-side move to /login unmounts the site layout: leave <html> clean for the product app.
    const root = document.documentElement;
    delete root.dataset.nvZone;
    delete root.dataset.nvCta;
    root.removeAttribute("data-nv-typing");
    root.removeAttribute("data-nv-chrome");
    state = SERVER;
    reported = false;
  };
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  detach ??= attach();
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
