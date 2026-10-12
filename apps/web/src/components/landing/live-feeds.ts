"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import {
  createEcgSimulator,
  createStethSimulator,
  simulatorFeed,
  type EcgChunk,
  type Feed,
  type StethChunk,
} from "@/lib/device-sim";

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

/** True while the element is (nearly) on screen, so offscreen monitors stop drawing work. */
export function useInView(ref: RefObject<Element | null>, rootMargin = "160px"): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** A local simulated Smart ECG feed (multicast; runs only while subscribed). */
export function useEcgFeed(heartRate: number): Feed<EcgChunk> {
  const [feed] = useState(() => simulatorFeed(createEcgSimulator({ heartRate, noise: 0.015 })));
  return feed;
}

/** A local simulated Smart Stethoscope feed. */
export function useStethFeed(heartRate: number): Feed<StethChunk> {
  const [feed] = useState(() => simulatorFeed(createStethSimulator({ heartRate })));
  return feed;
}

/** Shows a "connecting" state briefly on mount, like a device pairing. */
export function usePairing(active: boolean, ms = 900): boolean {
  const [paired, setPaired] = useState(false);
  useEffect(() => {
    if (!active || paired) return;
    const t = window.setTimeout(() => setPaired(true), ms);
    return () => window.clearTimeout(t);
  }, [active, paired, ms]);
  return paired;
}
