import { MINUTE_SOURCES } from "../../health-sources";
import { PROVERBS } from "../../l10n";

/* Every line the tools show or announce, apart from Pulse's (pulse-copy.ts, in Pulse's own chunk, so
   its unreviewed lines never reach production). The health sentences (technique, posture, readings and
   every `always` safety line) are sourced and were clinically checked: where they show can change, their
   words cannot without a new check. Sources come from MINUTE_SOURCES (health-sources.ts), so "All
   sources" on the page lists the same links. */

/** A sentence with links in it: plain strings and { text, href } parts, in reading order. */
export type Rich = readonly (string | { text: string; href: string })[];

/** Shared by every tool. */
export const COMMON = {
  getReady: "Get ready",
  settleIn: "Settle in",
  leadInLine: "Sit comfortably and let your shoulders drop.",
  away: "Paused while you were away.",
  backPaused: "Paused. Go back again to close.",
  paused: "Paused",
  pause: "Pause",
  resume: "Resume",
  stop: "Stop",
  end: "End",
  again: "Again",
  done: "Done",
  timeLeft: "Time left",
  /** Under the orb while paused: "0:39 left". */
  left: (clock: string) => `${clock} left`,
  /** Time in words, once a minute: never seconds. */
  aboutLeft: (minutes: number) => `About ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`,
  underAMinute: "Less than a minute left",
  screenMayOff: "Your screen may switch off before the end. The time will still be right when you come back.",
  about: "About this exercise",
  sources: "Sources",
  call112: "Call 112",
  call108: "Call 108 (ambulance)",
} as const;

export const ANNOUNCE = {
  paused: "Paused",
  resumed: "Resumed",
  doneMinutes: (n: number) => `Done. That was ${n} ${n === 1 ? "minute" : "minutes"}.`,
} as const;

const MINUTES_WORD: Record<1 | 3 | 5, string> = { 1: "one", 3: "three", 5: "five" };

const BREATHE_ALWAYS = "Feel dizzy or unwell? Stop and breathe normally.";

export const BREATHE = {
  word: "Breathe",
  technique: "In through your nose, out through your mouth, without forcing it.",
  chips: [1, 3, 5] as const,
  chip: (m: number) => `${m} min`,
  chipsLabel: "Length",
  /** The pace, one quiet button: what is so now, then what a press does. Five's caveat is the NHS's own. */
  pace: {
    5: { now: "You may not reach five at first.", press: "Try four counts." },
    4: { now: "Counting to four.", press: "Back to five." },
  },
  /** Announced when the pace changes, as the button under focus only changes its words. */
  paceSaid: { 5: "Five counts in, five counts out.", 4: "Four counts in, four counts out." },
  start: "Start breathing",
  restLink: "Before a blood pressure reading? Use the 5-minute rest.",
  breatheOut: "Let your breath out.",
  inhale: "Breathe in",
  exhale: "Breathe out",
  done: (m: 1 | 3 | 5) => `That's ${MINUTES_WORD[m]} calm ${m === 1 ? "minute" : "minutes"}. Notice how you feel.`,
  proverb: PROVERBS[0],
  stay: (m: number) => `Stay a little longer · ${m} min`,
  soundTip: "Tip: turn on sound to follow with your eyes closed.",
  always: BREATHE_ALWAYS,
  /**
   * About this exercise: the source, the safety line and what is kept. The safety line is listed here only
   * on the done screen; before that it is the quiet line under the button (breathe.tsx).
   */
  fine: [
    [
      "Technique: ",
      { text: "NHS, Breathing exercises for stress", href: MINUTE_SOURCES.nhsBreathing.url },
      ". The NHS suggests at least 5 minutes.",
    ],
    [BREATHE_ALWAYS],
    ["Nothing you do here is saved or sent. Your choices stay on this device."],
  ] satisfies readonly Rich[],
  announceStart: "Starting. Let your breath out.",
} as const;

export const REST = {
  idleTitle: "Five quiet minutes before a blood pressure reading.",
  idleBody: "Your nurse asks for this before every reading. Sit like this, then rest.",
  /** The posture list, plain (nothing to tick): how to sit first, then what to have done before sitting. */
  groups: [
    { label: "How to sit", items: ["Back supported", "Feet flat, legs uncrossed", "Arm on a table, at chest height", "Cuff on bare skin", "No talking"] },
    { label: "Before you sit", items: ["Bladder emptied", "Nothing to eat, drink or smoke, and no exercise, in the last 30 minutes"] },
  ],
  start: "Start the 5-minute rest",
  announceStart: "Starting. Sit comfortably and let your shoulders drop.",
  /** Under Start, following the top bar's Sound. */
  phoneDown: {
    on: "You can put your phone down. A chime tells you when the five minutes are up.",
    off: "You can put your phone down. The screen shows when the five minutes are up.",
  },
  word: "Rest",
  /** Reopened while a rest that was closed mid-way is still running. */
  stillRunning: "Your rest is still running.",
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
  /** Heads the high-reading guidance on the done screen. */
  highLabel: "If a reading is higher than 180/120",
  again: "Rest again",
  always:
    "Higher than 180/120 with chest pain, shortness of breath, back pain, numbness, weakness, a change in vision or difficulty speaking? Call 112 (or 108 for an ambulance) now.",
  /** The text button that opens `always` in place before and during the rest. */
  alwaysLabel: "When a high reading is an emergency",
  sources: [
    "How to sit, rest and take readings: ",
    { text: "US CDC", href: MINUTE_SOURCES.cdcMeasureBp.url },
    ". High readings: ",
    { text: "American Heart Association", href: MINUTE_SOURCES.ahaCrisis.url },
    ".",
  ] satisfies Rich,
} as const;

export const EYES = {
  idleNum: "20",
  idleWord: "seconds",
  idleBody: "Every 20 minutes, look at something at least 20 feet (about 6 metres) away for at least 20 seconds.",
  start: "Start a 20-second break",
  /** Under Start, following the top bar's Sound (on by default for this tool). */
  cue: {
    on: "A chime tells you when to look back.",
    off: "Sound is off. Glance back when you think 20 seconds have passed.",
  },
  leadIn: "In a moment, look out of a window or to the far end of the room.",
  running: "Look away now: out of a window, or to the far end of the room.",
  /** Done: the first words in the orb, the rest under it. */
  welcome: "Welcome back",
  blink: "Blink a few times before you go on.",
  fine: [
    ["Source: ", { text: "American Academy of Ophthalmology", href: MINUTE_SOURCES.aaoEyeStrain.url }, "."],
  ] satisfies readonly Rich[],
  always: "If your eyes stay sore or your vision changes, see an eye doctor.",
  announceStart: "Look away now. 20 seconds.",
  announceDone: "Done. You can look back.",
} as const;
