"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  createEcgSimulator,
  createStethSimulator,
  simulatorFeed,
  type EcgChunk,
  type Feed,
  type StethChunk,
} from "@/lib/device-sim";

export { usePrefersReducedMotion } from "./motion";

/** True while the element is (nearly) on screen, so offscreen monitors stop drawing work. */
export function useInView(ref: RefObject<Element | null>, rootMargin = "160px"): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** True from the first time the element comes within `rootMargin` of the screen: the cue to fetch what it will need. */
export function useNear(ref: RefObject<Element | null>, rootMargin = "600px"): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setNear(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return near;
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
