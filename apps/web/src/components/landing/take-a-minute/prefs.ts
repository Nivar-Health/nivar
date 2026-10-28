import { enabledTool } from "./config";
import type { Prefs } from "./types";

/* What Take a minute remembers between visits (spec §5.12): Prefs only, in localStorage
   nivar.minute.v1. Nothing about the body (no taps, counts or readings) is ever stored or sent.
   Storage can be blocked or full, so every access is wrapped, and anything malformed falls back to
   the defaults field by field. */

const KEY = "nivar.minute.v1";

export const DEFAULT_PREFS: Prefs = {
  v: 1,
  tool: "breathe",
  breatheMinutes: 1,
  pulseMode: "count",
  sound: false,
  vibration: false,
  eyesChime: false,
  completed: 0,
};

function valid(raw: unknown): Prefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const p = raw as Record<string, unknown>;
  if (p.v !== 1) return DEFAULT_PREFS;
  const completed = typeof p.completed === "number" && Number.isInteger(p.completed) && p.completed > 0 ? p.completed : 0;
  return {
    v: 1,
    tool: enabledTool(p.tool),
    breatheMinutes: p.breatheMinutes === 3 || p.breatheMinutes === 5 ? p.breatheMinutes : 1,
    pulseMode: p.pulseMode === "tap" ? "tap" : "count",
    sound: p.sound === true,
    vibration: p.vibration === true,
    eyesChime: p.eyesChime === true,
    completed: Math.min(completed, 1_000_000),
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
