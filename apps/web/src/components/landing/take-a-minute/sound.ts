/* Sound (spec §5.12), off by default. The AudioContext is created inside the toggle's click (or
   the first press inside the experience, when it was left on last time), as an "ambient" audio
   session so the iOS silent switch is respected. Master gain (600 ms fade-in) → compressor
   (−18 dB, 3:1). Chimes are struck-bar tones: sine partials at f and 2.76f, decaying with
   τ 0.6 s, peak gain ≤ .06. No breath bed in v1, and never lib/heart-sound: a free-running beat
   could pull the taps of someone counting their pulse. */

export type Chime = "in" | "out" | "prompt" | "done" | "look-back";

const NOTES: Record<Chime, readonly number[]> = {
  in: [392], // G4
  out: [293.66], // D4
  prompt: [659.25], // E5
  done: [392, 493.88, 587.33], // G4, B4, D5
  "look-back": [587.33, 783.99], // D5, then G5
};
const STEP: Record<Chime, number> = { in: 0, out: 0, prompt: 0, done: 0.16, "look-back": 0.3 };

const PEAK = 0.06;
const TAU = 0.6;
const ATTACK = 0.012;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

class Sound {
  on = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private suspendTimer = 0;

  /** Turns sound on. Call from a click or key press: browsers only start audio from a gesture. */
  enable(): void {
    this.on = true;
    this.wake();
  }

  disable(): void {
    this.on = false;
    this.fadeOut(200);
  }

  /**
   * Starts (or resumes) the context while sound is on. Safe to call on every press. Without a gesture
   * (a deep link, Back, a touch before it lifts) it waits: browsers refuse to start audio then, and warn.
   */
  wake(): void {
    if (this.on) this.start();
  }

  /**
   * Starts the context for cue() alone, leaving `on` (and so every chime and tick) as it is: the Eyes
   * chime sounds with Sound off. Call it only inside a gesture, like wake().
   */
  prime(): void {
    this.start();
  }

  /** Gain to 0, then suspend (closing the experience: over its close, 280 ms at ×1). */
  fadeOut(ms: number): void {
    if (!this.ctx) return;
    this.ramp(0, ms);
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      this.ctx?.suspend().catch(() => {});
    }, ms + 30);
  }

  chime(kind: Chime): void {
    const ctx = this.ready();
    if (ctx) this.strike(ctx, kind);
  }

  /** A chime that plays whenever the context runs (primed or woken), whatever `on` says. */
  cue(kind: Chime): void {
    const ctx = this.ctx;
    if (ctx?.state === "running") this.strike(ctx, kind);
  }

  /** The Tap along tick: 30 ms of 880 Hz at gain .03. */
  tick(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const at = ctx.currentTime + 0.005;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.value = 880;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.03, at + 0.003);
    env.gain.setValueAtTime(0.03, at + 0.022);
    env.gain.linearRampToValueAtTime(0, at + 0.03);
    this.play(osc, env, at, at + 0.04);
  }

  private ready(): AudioContext | null {
    return this.on && this.ctx?.state === "running" ? this.ctx : null;
  }

  private start(): void {
    if (!(navigator.userActivation?.isActive ?? true) || !this.build()) return;
    window.clearTimeout(this.suspendTimer);
    const ctx = this.ctx!;
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    this.ramp(1, 600);
  }

  private strike(ctx: AudioContext, kind: Chime): void {
    const at = ctx.currentTime + 0.02;
    NOTES[kind].forEach((f, i) => this.voice(ctx, f, at + i * STEP[kind]));
  }

  private build(): boolean {
    if (this.ctx) return true;
    const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Context) return false;
    try {
      const session = (navigator as AudioSessionNavigator).audioSession;
      if (session) session.type = "ambient";
    } catch {
      // Older Safari: no audio session API.
    }
    try {
      const ctx = new Context();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 3;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return true;
    } catch {
      return false;
    }
  }

  private ramp(to: number, ms: number): void {
    const ctx = this.ctx;
    const gain = this.master?.gain;
    if (!ctx || !gain) return;
    const t = ctx.currentTime;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(gain.value, t);
    gain.linearRampToValueAtTime(to, t + ms / 1000);
  }

  private voice(ctx: AudioContext, f: number, at: number): void {
    // The fundamental rings; the 2.76f partial (a struck bar's second mode) is quieter and dies sooner.
    for (const [ratio, peak, tau] of [
      [1, PEAK, TAU],
      [2.76, PEAK * 0.28, TAU * 0.45],
    ] as const) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.value = f * ratio;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + ATTACK);
      env.gain.setTargetAtTime(0, at + ATTACK, tau);
      this.play(osc, env, at, at + ATTACK + tau * 6);
    }
  }

  private play(osc: OscillatorNode, env: GainNode, start: number, stop: number): void {
    osc.connect(env);
    env.connect(this.master!);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    osc.start(start);
    osc.stop(stop);
  }
}

/** One context for the page's lifetime: browsers cap how many can exist. */
export const sound = new Sound();
