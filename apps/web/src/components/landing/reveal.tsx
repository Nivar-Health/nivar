"use client";

import { useEffect } from "react";

const SELECTOR = "[data-nv-reveal]:not([data-nv-revealed])";
const INDIC = '[lang|="kn"], [lang|="hi"]';

/**
 * Lets the Noto Kannada and Devanagari faces apply (globals.css), so the browser fetches them. Until
 * then far-off Indic text uses the system's own Indic fonts and the first load stays light.
 */
export function allowIndicFonts() {
  document.documentElement.setAttribute("data-indic-fonts", "");
}

/**
 * One observer for the whole landing page. Elements carry `data-nv-reveal` (see revealProps).
 * Hiding is CSS-only and applies only once <html data-nv-reveal-ready> is set here, and only while
 * motion plays: never under reduced motion or a pause (landing.css). Rendered once by app/(site)/layout.tsx.
 * Elements added (or marked) after mount are picked up too, so nothing stays hidden.
 * A second observer allows the Indic fonts once Indic text is within one and a half screens.
 */
export function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-nv-revealed", "");
          io.unobserve(e.target);
        }
      },
      // Any pixel past the 92% line starts it (mobile addendum M8): a tall group never sits blank mid-flick.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    // On or above the screen: show at once. Below it: reveal when scrolled into view.
    const track = (el: Element) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute("data-nv-revealed", "");
      else io.observe(el);
    };
    document.querySelectorAll(SELECTOR).forEach(track);
    root.setAttribute("data-nv-reveal-ready", "");

    let indic: IntersectionObserver | null = root.hasAttribute("data-indic-fonts")
      ? null
      : new IntersectionObserver(
          (entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            allowIndicFonts();
            indic?.disconnect();
            indic = null;
          },
          { rootMargin: "150% 0px" },
        );
    document.querySelectorAll(INDIC).forEach((el) => indic?.observe(el));

    // Late arrivals: new elements, and existing elements that gain data-nv-reveal (React can reuse a node).
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") {
          if (r.target instanceof Element && r.target.matches(SELECTOR)) track(r.target);
          continue;
        }
        r.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) track(node);
          node.querySelectorAll(SELECTOR).forEach(track);
          if (!indic) return;
          if (node.matches(INDIC)) indic.observe(node);
          node.querySelectorAll(INDIC).forEach((el) => indic?.observe(el));
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-nv-reveal"] });

    return () => {
      mo.disconnect();
      io.disconnect();
      indic?.disconnect();
      root.removeAttribute("data-nv-reveal-ready");
    };
  }, []);
  return null;
}
