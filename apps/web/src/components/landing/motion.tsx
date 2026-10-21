"use client";

import { useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
/** The visitor's own pause (MotionToggle), per browser. Only "paused" is ever stored. */
const STORAGE_KEY = "nivar.motion";

type State = { osReduced: boolean; userPaused: boolean };

let state: State | null = null;
let detach: (() => void) | null = null;
const listeners = new Set<() => void>();

/** The stored pause, or null when storage is blocked (the choice then lives in memory only). */
function readStored(): boolean | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "paused";
  } catch {
    return null;
  }
}

function read(): State {
  state ??= { osReduced: window.matchMedia(REDUCED_QUERY).matches, userPaused: readStored() ?? false };
  return state;
}

/** <html data-motion>: landing CSS keys every .motion-loop, reveal and pressed scale off it. */
function mirror({ osReduced, userPaused }: State) {
  document.documentElement.dataset.motion = osReduced || userPaused ? "paused" : "playing";
}

function update(next: Partial<State>) {
  const prev = read();
  const merged = { ...prev, ...next };
  if (merged.osReduced === prev.osReduced && merged.userPaused === prev.userPaused) return;
  state = merged;
  mirror(merged);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!detach) {
    const mq = window.matchMedia(REDUCED_QUERY);
    const onChange = () => update({ osReduced: mq.matches });
    // The switch flipped in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) update({ userPaused: readStored() ?? read().userPaused });
    };
    mq.addEventListener("change", onChange);
    window.addEventListener("storage", onStorage);
    detach = () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
    update({ osReduced: mq.matches, userPaused: readStored() ?? read().userPaused });
    mirror(read());
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && detach) {
      detach();
      detach = null;
    }
  };
}

const onServer = () => false;

/** True when the visitor asked the OS for reduced motion. False during SSR. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => read().osReduced, onServer);
}

/** True when the visitor paused the page's animations with MotionToggle. False during SSR. */
export function useUserMotionPaused(): boolean {
  return useSyncExternalStore(subscribe, () => read().userPaused, onServer);
}

/**
 * Whether landing motion should rest: the OS reduced-motion preference or the visitor's own pause.
 * One store for the page; it mirrors the answer onto <html data-motion>.
 */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      const { osReduced, userPaused } = read();
      return osReduced || userPaused;
    },
    onServer,
  );
}

/** Pauses or plays every landing animation for this visitor, and remembers it where storage allows. */
export function setUserMotionPaused(paused: boolean): void {
  try {
    if (paused) window.localStorage.setItem(STORAGE_KEY, "paused");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: the choice holds for this page view.
  }
  update({ userPaused: paused });
}
