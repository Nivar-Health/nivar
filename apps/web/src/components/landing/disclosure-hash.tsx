"use client";

import { useEffect } from "react";

/**
 * Deep links into drop-downs (spec §1.11). Chrome 156 opens a closed <details> for a fragment inside its
 * content, but not for the <details> itself or its <summary> (probe-hash.json), and Safari's reveal is
 * partial. So the target's own and enclosing <details> open, and the page re-aligns only when one of them
 * had hidden the target. An unknown id does nothing, so #take-a-minute stays the corner's.
 */
export function openForHash(): void {
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = id ? document.getElementById(id) : null;
  if (!target) return;
  let hidden = false;
  // A target too near the end to reach its scroll margin yet: the browser stops (or, gliding, will stop) at
  // the end of the page, which the open then lengthens. Measured, not read from scrollY, because the glide
  // to a fragment on load is often still under way here.
  const clamped =
    scrollY + target.getBoundingClientRect().top - parseFloat(getComputedStyle(target).scrollMarginTop) >
    document.documentElement.scrollHeight - innerHeight + 1;
  let opened = false;
  for (let d = target.closest("details"); d; d = d.parentElement?.closest("details") ?? null) {
    if (d.open) continue;
    d.open = true;
    opened = true;
    // Its summary was in view all along when the target is the details or sits in that summary.
    if (d !== target && !d.querySelector(":scope > summary")?.contains(target)) hidden = true;
  }
  const align = () => target.scrollIntoView({ block: "start", behavior: "instant" });
  if (hidden) requestAnimationFrame(align);
  // The page grows over the 280 ms open, so a rAF is too early. Chrome's glide to the fragment, often still
  // under way then, carries an instant scroll on to the end of the page; the call a frame later lands it.
  else if (opened && clamped)
    window.setTimeout(() => {
      align();
      requestAnimationFrame(align);
    }, 320);
}

/** The guard on the phone-only rules in disclosure.css. Change both together. */
const NATIVE_PHONE_SHAPE = "(interpolate-size: allow-keywords) and selector(::details-content)";

/**
 * From 640px a phone-only disclosure reads as plain content. Where the CSS guard holds (Chromium) the
 * stylesheet does it alone. Elsewhere (Safari and Firefox today) this gives the same shape through the
 * `open` attribute, which every engine honours: each row opens and carries data-nv-forced, which hides
 * its summary (disclosure.css). The attribute's value remembers a row that was already open, so below
 * 640px only the rows this opened close again and the visitor's own stay open. No layout reads, no
 * observers. Call it again from an effect if phone-only rows ever mount in a client tree. Returns its cleanup.
 */
export function syncPhoneDisclosures(): () => void {
  if (CSS.supports(NATIVE_PHONE_SHAPE)) return () => {};
  const wide = matchMedia("(width >= 40rem)");
  const sync = () => {
    if (wide.matches) {
      document.querySelectorAll<HTMLDetailsElement>("details.nv-disc--phone:not([data-nv-forced])").forEach((d) => {
        d.setAttribute("data-nv-forced", d.open ? "open" : "");
        d.open = true;
      });
    } else {
      document.querySelectorAll<HTMLDetailsElement>("details[data-nv-forced]").forEach((d) => {
        if (d.getAttribute("data-nv-forced") !== "open") d.open = false;
        d.removeAttribute("data-nv-forced");
      });
    }
  };
  sync();
  wide.addEventListener("change", sync);
  return () => wide.removeEventListener("change", sync);
}

/** Mounted once, in app/(site)/layout.tsx next to RevealObserver. */
export function DisclosureHash(): null {
  useEffect(() => {
    // First, so from 640px the hash opener meets the phone-only rows already in their desktop shape.
    const unsync = syncPhoneDisclosures();
    openForHash();
    window.addEventListener("hashchange", openForHash);
    return () => {
      unsync();
      window.removeEventListener("hashchange", openForHash);
    };
  }, []);
  return null;
}
