"use client";

import { useEffect } from "react";

const SELECTOR = "[data-nv-reveal]:not([data-nv-revealed])";

/**
 * One observer for the whole landing page. Elements carry `data-nv-reveal` (see revealProps).
 * Hiding is CSS-only and applies only once <html data-nv-reveal-ready> is set here, and only under
 * prefers-reduced-motion: no-preference (landing.css). Rendered once by app/page.tsx.
 * Elements added (or marked) after mount are picked up too, so nothing stays hidden.
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    // On or above the screen: show at once. Below it: reveal when scrolled into view.
    const track = (el: Element) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute("data-nv-revealed", "");
      else io.observe(el);
    };
    document.querySelectorAll(SELECTOR).forEach(track);
    root.setAttribute("data-nv-reveal-ready", "");

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
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-nv-reveal"] });

    return () => {
      mo.disconnect();
      io.disconnect();
      root.removeAttribute("data-nv-reveal-ready");
    };
  }, []);
  return null;
}
