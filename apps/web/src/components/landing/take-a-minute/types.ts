import type { FC, ReactNode } from "react";

/* Take a minute: the contracts between the shell (experience.tsx), the tools (tools/) and the timer
   (engine.ts). Spec §5.2. */

export type ToolId = "breathe" | "rest" | "pulse" | "eyes";

/** Orb tint per tool: breathe mint, rest sky, pulse rose, eyes pearl (config.ts TOOL_TONE). */
export type Tone = "mint" | "sky" | "rose" | "pearl";

/** Everything Take a minute remembers (localStorage nivar.minute.v1). Nothing about the body. */
export type Prefs = {
  v: 1;
  tool: ToolId;
  breatheMinutes: 1 | 3 | 5;
  pulseMode: "count" | "tap";
  sound: boolean;
  vibration: boolean;
  /** Eyes: a soft chime when it's time to look back, even with Sound off. Off by default. */
  eyesChime: boolean;
  completed: number;
};

export type SessionPhase = "idle" | "leadin" | "running" | "paused" | "done";

/** Options for useSession (engine.ts). */
export type SessionOptions = {
  /**
   * true: a hidden tab pauses the session (pausedByVisibility; Resume replays the lead-in) and a
   * frame gap over 1 s is not counted. false (Rest): wall-clock time, so it is right on return.
   */
  pauseWhenHidden: boolean;
  /** Lead-in before running ("Get ready", 3, 2, 1). Default 3000. */
  leadInMs?: number;
  /**
   * When Resume replays the lead-in, running time moves on to the next multiple of this, so the
   * session picks up at the start of a whole cycle (Breathe: one breath in and out). The countdown
   * only moves down; with no whole cycle left, Resume ends the session.
   */
  resumeAlignMs?: number;
  /** Every animation frame while running: write the ring and orb through the api, never React state. */
  onFrame?(elapsedMs: number, totalMs: number): void;
  onDone?(): void;
};

/** What useSession returns. Methods are stable across renders. */
export type Session = {
  phase: SessionPhase;
  /** ceil((total − elapsed) / 1000). Re-renders once a second. 0 while idle. */
  secondsLeft: number;
  /** 3, 2, 1 during the lead-in; 0 otherwise. */
  leadInLeft: number;
  /** The session paused because the tab was hidden (the "Paused while you were away." banner). */
  pausedByVisibility: boolean;
  /** Current length in ms, including any extend(). 0 while idle. */
  totalMs: number;
  /** Starts from idle or done (or restarts). leadIn defaults to true. */
  start(totalMs: number, o?: { leadIn?: boolean }): void;
  pause(): void;
  resume(): void;
  /** Back to idle. */
  stop(): void;
  /** Adds time. From done it continues running from where it ended (Breathe "Keep going"). */
  extend(addMs: number): void;
  /** Running time so far in ms (0 during a first lead-in). */
  getElapsed(): number;
};

export type ExperienceApi = {
  orb: {
    setScale(v: number): void;
    spring(v: number, o?: { visualDuration?: number; bounce?: number }): void;
    setTone(t: Tone): void;
    setGlow(v: number): void;
    recede(on: boolean): void;
    flash(): void;
  };
  ring: { setRemaining(f: number): void; refill(f: number, ms?: number): void };
  field: { setBreath(v: number): void; setDim(v: number): void; setMotes(on: boolean): void; brighten(): void };
  sound: {
    enabled: boolean;
    chime(k: "in" | "out" | "prompt" | "done" | "look-back"): void;
    tick(): void;
    /** A cue that sounds when prefs.sound || prefs.eyesChime, whatever Sound says. */
    cue(k: "look-back"): void;
  };
  haptics: { supported: boolean; enabled: boolean; buzz(k: "in" | "out" | "tap" | "done"): void };
  /** Polite live region; phase words at least 5 s apart. */
  announce(text: string, o?: { force?: boolean }): void;
  /** Hides tabs and chips and blocks swipe while a session is active. */
  setSessionActive(active: boolean): void;
  reducedMotion: boolean;
  coarse: boolean;
  /** Viewport height < 700. */
  compactHeight: boolean;
  prefs: Prefs;
  setPrefs(p: Partial<Prefs>): void;
  switchTool(id: ToolId): void;
  close(): void;
};

export type LayoutSlots = {
  /** The orb's text layer (word, numeral, figure). It never scales. */
  orb: ReactNode;
  /** Turns the orb into a real <button> (Pulse, Tap along). onPress runs on pointerdown and Space/Enter. */
  orbButton?: { label: string; onPress(): void };
  readout?: ReactNode;
  prompt?: ReactNode;
  /** Chips, mode radios, Rest's ticks and the Eyes chime switch. Leaves the layout during a session. */
  options?: ReactNode;
  /** Safety lines: never collapse, always directly above the controls. */
  always?: ReactNode;
  /** Start, or Pause/Resume and Stop in one .nv-minute-row. Docked at the bottom on portrait phones. */
  controls: ReactNode;
  /** Links shown under the dock. */
  after?: ReactNode;
  /** Technique and sources: "About this exercise", closed on phones and when compactHeight. */
  fine?: ReactNode;
};

export type ToolProps = { api: ExperienceApi; Layout: FC<LayoutSlots> };

/** detail of the MINUTE_OPEN_EVENT (open.ts). tool "" or undefined opens the last-used tool. */
export type MinuteOpenDetail = { tool?: ToolId | ""; origin?: HTMLElement | null };
