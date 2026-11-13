import type { FC, ReactNode } from "react";

/* Take a minute: the contracts between the shell (experience.tsx), the tools (tools/) and the timer
   (engine.ts). */

export type ToolId = "breathe" | "rest" | "pulse" | "eyes";

/** Orb tint per tool: breathe mint, rest sky, pulse rose, eyes pearl (config.ts TOOL_TONE). */
export type Tone = "mint" | "sky" | "rose" | "pearl";

/**
 * Everything Take a minute remembers (localStorage nivar.minute.v1): the person's own choices, and that
 * the sound tip has been shown. Nothing about the body, and no record of what was done or how often.
 */
export type Prefs = {
  v: 1;
  breatheMinutes: 1 | 3 | 5;
  /** Counts each way: five (the NHS exercise) or a gentler four. */
  breatheCounts: 5 | 4;
  pulseMode: "count" | "tap";
  /**
   * The top bar's Sound, kept per tool: Breathe's pacing chimes (off until asked for), and the chime that
   * ends an eye break or a rest (on, as both ask the person to look away or put the phone down).
   */
  toolSound: Readonly<Record<ToolId, boolean>>;
  vibration: boolean;
  /** The one-time "turn on sound" tip has been shown (Breathe's first done screen with sound off). */
  tipShown: boolean;
};

export type SessionPhase = "idle" | "leadin" | "running" | "paused" | "done";

/** Options for useSession (engine.ts). */
export type SessionOptions = {
  /**
   * true: a hidden tab pauses the session (pausedByVisibility; Resume replays the lead-in) and a
   * frame gap over 1 s is not counted. false (Rest): wall-clock time, so it is right on return.
   */
  pauseWhenHidden: boolean;
  /** The lead-in before running, in ms. Default 3000. */
  leadInMs?: number;
  /**
   * A lead-in of this length before every Resume, however the pause came about (Breathe: a breath out
   * before the next one in). Unset: only a pause during the lead-in or by a hidden tab replays it, at leadInMs.
   */
  resumeLeadInMs?: number;
  /**
   * When Resume replays the lead-in, running time moves on to the next multiple of this, so the
   * session picks up at the start of a whole cycle (Breathe: one breath in and out). The countdown
   * only moves down; with no whole cycle left, Resume ends the session.
   */
  resumeAlignMs?: number;
  /**
   * What drives the clock. "frame" (default): every animation frame, for paced motion (Breathe). A
   * number: a timer that many ms apart, for a session where only the ring moves. Timers also fire in a
   * hidden page (about once a second), so a wall-clock session still ends on time there.
   */
  tick?: "frame" | number;
  /** Every tick while running: write the ring and orb through the api, never React state. */
  onFrame?(elapsedMs: number, totalMs: number): void;
  onDone?(): void;
};

/** What useSession returns. Methods are stable across renders. */
export type Session = {
  phase: SessionPhase;
  /** ceil((total − elapsed) / 1000). Re-renders once a second. 0 while idle. */
  secondsLeft: number;
  /** Whole seconds left of the lead-in, counting down to 1; 0 otherwise. */
  leadInLeft: number;
  /** The session paused because the tab was hidden (the "Paused while you were away." line). */
  pausedByVisibility: boolean;
  /** Current length in ms, including any extend(). 0 while idle. */
  totalMs: number;
  /**
   * The screen wake lock while counting: true once held, false when the browser has none or refused
   * it (the screen may switch off mid-session), null before it answers and while idle.
   */
  screenHeld: boolean | null;
  /**
   * Starts from idle or done (or restarts). leadIn defaults to true. `at`: already this far in (ms), so
   * it runs at once from there (a rest that kept its time while the sheet was closed).
   */
  start(totalMs: number, o?: { leadIn?: boolean; at?: number }): void;
  pause(): void;
  resume(): void;
  /** Back to idle. */
  stop(): void;
  /** Adds time. From done it continues running from where it ended (Breathe "Stay a little longer"). */
  extend(addMs: number): void;
  /** Running time so far in ms (0 during a first lead-in). */
  getElapsed(): number;
};

export type ExperienceApi = {
  orb: {
    setScale(v: number): void;
    spring(v: number, o?: { visualDuration?: number; bounce?: number }): void;
    setTone(t: Tone): void;
    /** The orb's light, 0 to 1 (1 at rest): the orb, its rim and its halo fade with it. Reduced motion paces Breathe this way. */
    setGlow(v: number): void;
    recede(on: boolean): void;
    flash(): void;
    /** One soft ripple from the orb, the opening's: the wordless end of a session. Nothing under reduced motion. */
    ripple(): void;
  };
  ring: {
    /** `glideMs`: the arc eases to `f` over that long (a session that ticks on a timer). 0 writes it at once. */
    setRemaining(f: number, glideMs?: number): void;
    refill(f: number, ms?: number): void;
  };
  field: { setBreath(v: number): void; setDim(v: number): void; brighten(): void };
  sound: {
    /** Sound is on for this tool (the top bar's control). */
    enabled: boolean;
    chime(k: "in" | "out" | "prompt" | "done" | "look-back"): void;
    tick(): void;
  };
  haptics: { supported: boolean; enabled: boolean; buzz(k: "in" | "out" | "tap" | "done"): void };
  /** Polite live region; phase words at least 5 s apart. */
  announce(text: string, o?: { force?: boolean }): void;
  /**
   * While a session is active the tabs and everything that is not the session step aside, and swipe is
   * off. `onBack` is asked when Back is pressed: true when it paused the session instead, so the sheet
   * stays open and the next Back closes it.
   */
  setSessionActive(active: boolean, o?: { onBack?(): boolean }): void;
  reducedMotion: boolean;
  coarse: boolean;
  /** Viewport height < 700. */
  compactHeight: boolean;
  prefs: Prefs;
  setPrefs(p: Partial<Prefs>): void;
  switchTool(id: ToolId): void;
  /** Brings the sheet back to its top, as a session's start and end do: a result is read from its first line. */
  scrollToTop(): void;
  /**
   * Runs `listener` each time the sheet opens, and at once if it is open now. Every close mounts fresh
   * tools, hidden, for the next open, so this is how one picks up on reopening (a rest still running).
   * Returns a cancel.
   */
  onOpen(listener: () => void): () => void;
  close(): void;
};

export type LayoutSlots = {
  /** The orb's text layer (word, pacing dots, figure). It never scales. */
  orb: ReactNode;
  /** Turns the orb into a real <button> (Pulse, Tap along). onPress runs on pointerdown and Space/Enter. */
  orbButton?: { label: string; onPress(): void };
  /**
   * A tap or click on the resting orb: Start's pointer shortcut. The Start button stays the control
   * for the keyboard and assistive technology, so nothing here is focusable or named.
   */
  onOrbTap?(): void;
  readout?: ReactNode;
  prompt?: ReactNode;
  /** Chips, mode radios, Before BP's posture list. Leaves the layout during a session. */
  options?: ReactNode;
  /**
   * Safety guidance in the flow before the controls (parts.tsx safetySlots): in full, or quiet where the
   * dock's one line is the tool's own note.
   */
  safety?: ReactNode;
  /** Start, or Pause/Resume and Stop in one .nv-minute-row. Docked at the bottom on portrait phones. */
  controls: ReactNode;
  /** The one quiet line under the controls, docked with them: a note, a safety line or a text button, never a box. */
  quiet?: ReactNode;
  /**
   * "sticky" (default): the controls dock at the bottom of the sheet while content runs past them.
   * "flow": they follow the content (done, entry and result states), so the result is read first.
   */
  dock?: "sticky" | "flow";
  /** Links shown under the dock. Leaves during a session. */
  after?: ReactNode;
  /** Technique and sources: a disclosure, closed on phones and when compactHeight. */
  fine?: ReactNode;
  /** That disclosure's title. Default "About this exercise". */
  fineTitle?: string;
};

export type ToolProps = { api: ExperienceApi; Layout: FC<LayoutSlots> };

/** detail of the MINUTE_OPEN_EVENT (open.ts). tool "" or undefined opens Breathe. */
export type MinuteOpenDetail = { tool?: ToolId | ""; origin?: HTMLElement | null };
