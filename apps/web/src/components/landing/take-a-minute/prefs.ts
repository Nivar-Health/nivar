import type { Prefs, ToolId } from "./types";

/* What Take a minute remembers between visits: Prefs only, in localStorage nivar.minute.v1. They are
   the person's own choices (length, pace, sound, vibration, how to count), plus one flag so the sound
   tip shows once. Nothing about the body (no taps, counts or readings), which tool was used or how
   often is ever stored, and nothing is sent anywhere. Storage can be blocked or full, so every access
   is wrapped, and anything malformed falls back to the defaults field by field. */

const KEY = "nivar.minute.v1";

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  breatheMinutes: 1,
  breatheCounts: 5,
  pulseMode: "count",
  toolSound: { breathe: false, eyes: true, rest: true, pulse: false },
  vibration: false,
  tipShown: false,
};

function valid(raw: unknown): Prefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const p = raw as Record<string, unknown>;
  if (p.v !== 1) return DEFAULT_PREFS;
  const stored = (p.toolSound && typeof p.toolSound === "object" ? p.toolSound : {}) as Record<string, unknown>;
  const soundFor = (id: ToolId, fallback: boolean) => (typeof stored[id] === "boolean" ? (stored[id] as boolean) : fallback);
  return {
    v: 1,
    breatheMinutes: p.breatheMinutes === 3 || p.breatheMinutes === 5 ? p.breatheMinutes : 1,
    breatheCounts: p.breatheCounts === 4 ? 4 : 5,
    pulseMode: p.pulseMode === "tap" ? "tap" : "count",
    toolSound: {
      // Records from before Sound was kept per tool hold one `sound` switch, off unless the person turned
      // it on: an "on" carries over to Breathe, and an "off" nobody chose never overrides a default.
      breathe: soundFor("breathe", p.sound === true),
      eyes: soundFor("eyes", DEFAULT_PREFS.toolSound.eyes),
      rest: soundFor("rest", DEFAULT_PREFS.toolSound.rest),
      pulse: soundFor("pulse", DEFAULT_PREFS.toolSound.pulse),
    },
    vibration: p.vibration === true,
    tipShown: p.tipShown === true,
  };
}

let cached: Prefs | null = null;

/** The remembered prefs (read once per page load). */
export function loadPrefs(): Prefs {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? valid(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    cached = DEFAULT_PREFS;
  }
  return cached;
}

/** Merges a change, validates it and stores it. Returns what is now remembered. */
export function savePrefs(patch: Partial<Prefs>): Prefs {
  const next = valid({ ...loadPrefs(), ...patch, v: 1 });
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: keep it for this page load only.
  }
  return next;
}
