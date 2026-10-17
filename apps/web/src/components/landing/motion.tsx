"use client";

import { useEffect, useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the visitor asked the OS for reduced motion. False during SSR. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/**
 * Whether landing motion should rest: the visitor's OS reduced-motion preference. Mirrors it onto
 * <html data-motion>, which landing CSS also keys off to stop every .motion-loop.
 */
export function useMotionPaused(): boolean {
  const paused = usePrefersReducedMotion();
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "paused" : "playing";
  }, [paused]);
  return paused;
}
