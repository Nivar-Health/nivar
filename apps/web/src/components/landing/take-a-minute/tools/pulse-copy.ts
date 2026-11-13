import { MINUTE_SOURCES } from "../../health-sources";
import type { Rich } from "./copy";

/* Pulse's lines (see copy.ts for the rest). Pulse waits on a doctor's sign-off, so they live with it in
   its own chunk, which production never loads (tools/index.ts). Sourced: where they show can change,
   their words cannot without a new check. */

/** Pulse's safety line is two sentences: the first shows as the quiet line, the second opens from a text button. */
const PULSE_ALWAYS = {
  line: "If the rhythm feels irregular, tell a doctor.",
  emergency: "Fast or irregular with chest pain, breathlessness, dizziness or fainting? Call 112 (or 108 for an ambulance) now.",
} as const;

export const PULSE = {
  idleTitle: "Find your pulse first.",
  /** The how-to, word for word, one sentence a line, for reading with one hand on a wrist. */
  idleBody: [
    "Sit and rest for at least 10 minutes.",
    "Put your index and middle fingers on the inside of your other wrist, just below the base of your thumb, and press lightly until you feel the beat.",
    "Use your wrist, not your neck.",
  ],
  modeLegend: "How do you want to count?",
  modes: { count: "Just count", tap: "Tap along" },
  start: "Start the 30-second count",
  leadIn: "Fingers on your wrist",
  countWord: "Count each beat",
  entryLabel: "How many beats did you count?",
  seeResult: "See result",
  entryError: "Enter the number of beats you counted, like 36.",
  tapWord: "Tap with each beat",
  tapHint: "The 30 seconds start with your first tap.",
  /** Added to tapHint where there is a keyboard (a fine pointer). */
  tapKeys: "Space or Enter works too.",
  taps: (n: number) => `${n} ${n === 1 ? "tap" : "taps"}`,
  /** "About {bpm} beats a minute.", set around the numeral in the orb. */
  resultWords: { before: "About", after: "beats a minute." },
  result: (bpm: number) => `About ${bpm} beats a minute.`,
  resultCount: (n: number, mode: "count" | "tap") => `${n} ${mode === "tap" ? "taps" : "beats"} in 30 seconds`,
  general:
    "A resting adult pulse is usually 60 to 100 beats a minute; in well-trained athletes it can be 40 to 60. Counting can miss or add a beat, so treat this as a rough count.",
  outOfRange:
    "That's outside the usual resting range of 60 to 100. Rest for 10 minutes and count again. If you get a similar number again, talk to a doctor.",
  fewTaps: (n: number) => `Only ${n} ${n === 1 ? "tap" : "taps"}. Rest a moment and try again, or switch to Just count.`,
  again: "Count again",
  always: `${PULSE_ALWAYS.line} ${PULSE_ALWAYS.emergency}`,
  alwaysLine: PULSE_ALWAYS.line,
  alwaysEmergency: PULSE_ALWAYS.emergency,
  /** The text button that opens the emergency sentence in place until the result. */
  alwaysLabel: "When to call 112",
  sources: [
    "Sources: ",
    { text: "MedlinePlus, Pulse", href: MINUTE_SOURCES.medlinePulse.url },
    "; ",
    { text: "NHS, Atrial fibrillation", href: MINUTE_SOURCES.nhsAf.url },
    ".",
  ] satisfies Rich,
  announceStart: "Started, 30 seconds",
} as const;
