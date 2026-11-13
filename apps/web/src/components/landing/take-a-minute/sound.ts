/* Sound. The top bar's control keeps it per tool: Breathe's pacing chimes are off until asked for, and
   the chime that ends an eye break or a rest is on. The AudioContext is created inside a press (the
   toggle, or the first press inside the experience while sound is on), as an "ambient" audio session so
   the iOS silent switch is respected. Master gain → a limiter (−10 dB, 12:1). Chimes are struck-bar
   tones: sine partials at f and 2.76f, decaying with τ 0.6 s, between 440 and 880 Hz so a phone speaker
   carries them, peak gain .18. No breath bed, and never lib/heart-sound: a free-running beat could pull
   the taps of someone counting their pulse. */

export type Chime = "in" | "out" | "prompt" | "done" | "look-back";

const NOTES: Record<Chime, readonly number[]> = {
  in: [587.33], // D5
  out: [440], // A4, a fourth below
  prompt: [659.25], // E5
  done: [587.33, 739.99, 880], // D5, F♯5, A5
  "look-back": [587.33, 783.99], // D5, then G5
};
const STEP: Record<Chime, number> = { in: 0, out: 0, prompt: 0, done: 0.16, "look-back": 0.3 };

const PEAK = 0.18;
const TAU = 0.6;
const ATTACK = 0.012;
/** The master gain's fade-in when the context starts; the preview chime needs it up at once. */
const FADE_IN_MS = 600;
const PREVIEW_FADE_MS = 40;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

class Sound {
  on = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private suspendTimer = 0;
  /** Faded out on purpose (the sheet closed, or Sound went off): revive() leaves the context asleep. */
  private parked = true;

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
    if (this.on) this.start(FADE_IN_MS);
  }

  /**
   * Sound switched on: the "in" chime at once, so the person hears that it works before they start.
   * Call it inside the press that switched it on.
   */
  preview(): void {
    this.on = true;
    this.start(PREVIEW_FADE_MS);
    const ctx = this.ctx;
    if (!ctx) return;
    const strike = () => {
      if (this.on && ctx.state === "running") this.strike(ctx, "in");
    };
    if (ctx.state === "running") strike();
    else ctx.resume().then(strike, () => {});
  }

  /** Gain to 0, then suspend (closing the experience: over its close, 280 ms at ×1). */
  fadeOut(ms: number): void {
    this.parked = true;
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

  private start(fadeMs: number): void {
    if (!(navigator.userActivation?.isActive ?? true) || !this.build()) return;
    const ctx = this.ctx!;
    // The gain fades in only out of a parked state: every press inside the sheet lands here, and a
    // fade restarted by one would swallow the chime that is ringing.
    if (this.parked) {
      window.clearTimeout(this.suspendTimer);
      this.parked = false;
      this.ramp(1, fadeMs);
    }
    if (ctx.state !== "running") ctx.resume().catch(() => {});
  }

  /**
   * A phone call, the lock screen or another app can leave the context suspended, and a rest's last
   * chimes would then stay silent. While sound is on and the sheet is open, it is resumed whenever the
   * page shows again or the context changes state.
   */
  private revive = (): void => {
    const ctx = this.ctx;
    if (!ctx || !this.on || this.parked || ctx.state === "running" || ctx.state === "closed") return;
    ctx.resume().catch(() => {});
  };

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
      // A limiter: single chimes pass untouched, and the three notes of "done" cannot clip together.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(limiter);
      limiter.connect(ctx.destination);
      ctx.addEventListener("statechange", this.revive);
      document.addEventListener("visibilitychange", this.revive);
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
