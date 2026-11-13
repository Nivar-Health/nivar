"use client";

import { useEffect } from "react";

const SELECTOR = "[data-nv-reveal]:not([data-nv-revealed])";
const INDIC = '[lang|="kn"], [lang|="hi"]';

/**
 * Whether the Noto Kannada and Devanagari faces may apply. Until then far-off Indic text uses the
 * system's own Indic fonts and the first load stays light. Once allowed, it stays so for the visit.
 */
let indicAllowed = false;

/**
 * Lets the Noto faces apply to one Indic element (globals.css), so the browser fetches them. Each
 * element is marked, not <html>: the switch restyles those few lines instead of the whole page.
 */
const markIndic = (el: Element) => el.setAttribute("data-indic-fonts", "");

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

    let indic: IntersectionObserver | null = indicAllowed
      ? null
      : new IntersectionObserver(
          (entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            indicAllowed = true;
            document.querySelectorAll(INDIC).forEach(markIndic);
            indic?.disconnect();
            indic = null;
          },
          { rootMargin: "150% 0px" },
        );
    // Indic text that is here now, arrives later or gains its lang (the form's language select).
    const indicText = (el: Element) => {
      if (!el.matches(INDIC)) return;
      if (indicAllowed) markIndic(el);
      else indic?.observe(el);
    };
    document.querySelectorAll(INDIC).forEach(indicText);

    // Late arrivals: new elements, and existing elements that gain data-nv-reveal (React can reuse a node).
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") {
          if (!(r.target instanceof Element)) continue;
          if (r.attributeName === "lang") indicText(r.target);
          else if (r.target.matches(SELECTOR)) track(r.target);
          continue;
        }
        r.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) track(node);
          node.querySelectorAll(SELECTOR).forEach(track);
          indicText(node);
          node.querySelectorAll(INDIC).forEach(indicText);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-nv-reveal", "lang"] });

    return () => {
      mo.disconnect();
      io.disconnect();
      indic?.disconnect();
      root.removeAttribute("data-nv-reveal-ready");
    };
  }, []);
  return null;
}
