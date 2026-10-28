import { MINUTE_SOURCES } from "../../health-sources";
import { PROVERBS } from "../../l10n";

/* Every line the four tools show or announce, verbatim from spec §3.12. Sources come from
   MINUTE_SOURCES (health-sources.ts), so "All sources" on the page lists the same links. */

/** A sentence with links in it: plain strings and { text, href } parts, in reading order. */
export type Rich = readonly (string | { text: string; href: string })[];

/** Shared by every tool. */
export const COMMON = {
  getReady: "Get ready",
  leadInLine: "Sit comfortably and let your shoulders drop.",
  away: "Paused while you were away.",
  paused: "Paused",
  pause: "Pause",
  resume: "Resume",
  stop: "Stop",
  again: "Again",
  done: "Done",
  timeLeft: "Time left",
} as const;

export const ANNOUNCE = {
  paused: "Paused",
  resumed: "Resumed",
  doneMinutes: (n: number) => `Done. That was ${n} ${n === 1 ? "minute" : "minutes"}.`,
} as const;

const MINUTES_WORD: Record<1 | 3 | 5, string> = { 1: "one", 3: "three", 5: "five" };

export const BREATHE = {
  word: "Breathe",
  idleSub: "Five counts in, five counts out",
  chips: [1, 3, 5] as const,
  chip: (m: number) => `${m} min`,
  chipsLabel: "Length",
  start: "Start breathing",
  restLink: "Before a blood pressure reading? Use the 5-minute rest.",
  welcome: "Welcome back.",
  inhale: "Breathe in",
  exhale: "Breathe out",
  left: (m: number) => `left of ${m} ${m === 1 ? "minute" : "minutes"}`,
  done: (m: 1 | 3 | 5) => `That's ${MINUTES_WORD[m]} calm ${m === 1 ? "minute" : "minutes"}. Notice how you feel.`,
  proverb: PROVERBS[0],
  keepGoing: (m: number) => `Keep going for ${m} minutes`,
  fine: [
    ["In through your nose, out through your mouth, without forcing it. You may not reach 5 at first."],
    [
      "Technique: ",
      { text: "NHS, Breathing exercises for stress", href: MINUTE_SOURCES.nhsBreathing.url },
      ". The NHS suggests at least 5 minutes.",
    ],
  ] satisfies readonly Rich[],
  always: "Feel dizzy or unwell? Stop and breathe normally.",
} as const;

export type RestPart = "bladder" | "back" | "feet" | "arm" | "cuff" | "clock" | "mouth";

export const REST = {
  idleTitle: "Five quiet minutes before a blood pressure reading.",
  idleBody: "Your nurse asks for this before every reading. Sit like this, then rest.",
  ticks: [
    { part: "bladder", text: "Bladder emptied" },
    { part: "back", text: "Back supported" },
    { part: "feet", text: "Feet flat, legs uncrossed" },
    { part: "arm", text: "Arm on a table, at chest height" },
    { part: "cuff", text: "Cuff on bare skin" },
    { part: "clock", text: "Nothing to eat, drink or smoke, and no exercise, for 30 minutes" },
    { part: "mouth", text: "No talking" },
  ] satisfies readonly { part: RestPart; text: string }[],
  start: "Start the 5-minute rest",
  word: "Rest",
  left: "left of 5 minutes",
  firstLine: "Breathe normally. Nothing to do.",
  /** Shown from that many seconds left, newest last. */
  prompts: [
    { from: 240, text: "Rest your arm on a table, at chest height." },
    { from: 180, text: "Let your shoulders drop." },
    { from: 120, text: "Breathe normally. Nothing to do." },
    { from: 60, text: "One more minute." },
  ],
  doneTitle: "Five minutes. You're ready for the reading.",
  doneBody: [
    "If you have a home blood pressure monitor, take two readings, 1 to 2 minutes apart, and note both. One high reading isn't a diagnosis.",
    "Not pregnant, and higher than 180/120? Wait at least a minute and measure again. Still that high, with no symptoms? Contact your doctor as soon as possible.",
    "Pregnant? Ask your doctor which readings need urgent care.",
  ],
  always:
    "Higher than 180/120 with chest pain, shortness of breath, back pain, numbness, weakness, a change in vision or difficulty speaking? Call 112 (or 108 for an ambulance) now.",
  sources: [
    "How to sit, rest and take readings: ",
    { text: "US CDC", href: MINUTE_SOURCES.cdcMeasureBp.url },
    ". High readings: ",
    { text: "American Heart Association", href: MINUTE_SOURCES.ahaCrisis.url },
    ".",
  ] satisfies Rich,
} as const;

export const PULSE = {
  idleTitle: "Find your pulse first.",
  idleBody:
    "Sit and rest for at least 10 minutes. Put your index and middle fingers on the inside of your other wrist, just below the base of your thumb, and press lightly until you feel the beat. Use your wrist, not your neck.",
  modeLegend: "How do you want to count?",
  modes: { count: "Just count", tap: "Tap along" },
  start: "Start the 30-second count",
  leadIn: "Fingers on your wrist",
  countWord: "Count each beat",
  left: "left of 30 seconds",
  entryLabel: "How many beats did you count?",
  seeResult: "See result",
  entryError: "Enter the number of beats you counted, like 36.",
  tapWord: "Tap with each beat",
  tapHint: "The 30 seconds start with your first tap. Space or Enter works too.",
  taps: (n: number) => `${n} ${n === 1 ? "tap" : "taps"}`,
  /** "About {bpm} beats a minute.", set around the numeral in the orb. */
  resultWords: { before: "About", after: "beats a minute." },
  result: (bpm: number) => `About ${bpm} beats a minute.`,
  resultCount: (n: number, mode: "count" | "tap") => `(${n} ${mode === "tap" ? "taps" : "beats"} in 30 seconds)`,
  general:
    "A resting adult pulse is usually 60 to 100 beats a minute; in well-trained athletes it can be 40 to 60. Counting can miss or add a beat, so treat this as a rough count.",
  outOfRange:
    "That's outside the usual resting range of 60 to 100. Rest for 10 minutes and count again. If you get a similar number again, talk to a doctor.",
  fewTaps: (n: number) => `Only ${n} ${n === 1 ? "tap" : "taps"}. Rest a moment and try again, or switch to Just count.`,
  again: "Count again",
  always:
    "If the rhythm feels irregular, tell a doctor. Fast or irregular with chest pain, breathlessness, dizziness or fainting? Call 112 (or 108 for an ambulance) now.",
  sources: [
    "Sources: ",
    { text: "MedlinePlus, Pulse", href: MINUTE_SOURCES.medlinePulse.url },
    "; ",
    { text: "NHS, Atrial fibrillation", href: MINUTE_SOURCES.nhsAf.url },
    ".",
  ] satisfies Rich,
  announceStart: "Started, 30 seconds",
  announceTen: "10 seconds left",
} as const;

export const EYES = {
  idleNum: "20",
  idleWord: "seconds",
  idleBody: "Every 20 minutes, look at something at least 20 feet (about 6 metres) away for at least 20 seconds.",
  start: "Start a 20-second break",
  chime: "Chime when it's time to look back",
  leadIn: "When the count ends, look out of a window or to the far end of the room.",
  running: "Look away now: out of a window, or to the far end of the room.",
  left: "left of 20 seconds",
  done: "Welcome back. Blink a few times before you go on.",
  fine: [
    ["Source: ", { text: "American Academy of Ophthalmology", href: MINUTE_SOURCES.aaoEyeStrain.url }, "."],
  ] satisfies readonly Rich[],
  always: "If your eyes stay sore or your vision changes, see an eye doctor.",
  announceStart: "Look away now. 20 seconds.",
  announceDone: "Done. You can look back.",
} as const;
