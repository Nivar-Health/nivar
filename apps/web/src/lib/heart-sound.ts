/**
 * Synthesized heart sounds (lub-dub) with WebAudio.
 *
 * S1 ("lub"): low, ~50-130 Hz fundamental, a damped sine pair plus low-passed noise, ~110 ms.
 * S2 ("dub"): slightly higher pitched, shorter (~70 ms) and softer.
 *
 * Beats are scheduled ahead on the AudioContext clock (lookahead scheduler),
 * so timing is sample-accurate and unaffected by main-thread jank.
 * `start()` must be called from a user gesture (click/tap), per browser
 * autoplay policies.
 */

export type HeartSound = {
  start(heartRate: number): Promise<void>;
  setHeartRate(bpm: number): void;
  /**
   * Play a lub-dub now and re-phase the internal clock to it. Call on each
   * detected S1 in a streamed signal to keep audio locked to the waveform;
   * if triggers stop arriving, playback continues free-running at the HR.
   */
  trigger(): void;
  setVolume(v: number): void;
  stop(): void;
  /** Current output level 0..1 (RMS-ish), for a volume meter. */
  getLevel(): number;
  readonly isPlaying: boolean;
};

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createHeartSound(): HeartSound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextBeat = 0;
  let hr = 74;
  let volume = 0.9;
  let playing = false;
  let beatCount = 0;
  let lastScheduled = -1;
  const levelBuf = new Float32Array(512);

  const ensureGraph = () => {
    const Ctor = getAudioCtor();
    if (!Ctor) throw new Error("WebAudio is not supported in this browser");
    if (!ctx) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      // A gentle low-pass keeps it sounding like a chest piece, not a speaker click.
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 420;
      tone.Q.value = 0.5;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      master.connect(tone).connect(comp).connect(analyser).connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 0.4);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  };

  /** One heart sound component at time `when`. */
  const thump = (when: number, opts: { f: number; f2: number; dur: number; gain: number; noise: number; cutoff: number }) => {
    if (!ctx || !master || !noiseBuffer) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.exponentialRampToValueAtTime(opts.gain, when + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, when + opts.dur);
    out.connect(master);

    for (const [freq, g] of [
      [opts.f, 1],
      [opts.f2, 0.55],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      // Slight downward pitch glide, like a tissue-damped valve closure.
      osc.frequency.setValueAtTime(freq * 1.25, when);
      osc.frequency.exponentialRampToValueAtTime(freq, when + opts.dur * 0.6);
      const og = ctx.createGain();
      og.gain.value = g;
      osc.connect(og).connect(out);
      osc.start(when);
      osc.stop(when + opts.dur + 0.05);
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = opts.cutoff;
    lp.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.value = opts.noise;
    src.connect(lp).connect(ng).connect(out);
    src.start(when, Math.random() * 0.2, opts.dur + 0.05);
  };

  const scheduleBeat = (when: number) => {
    const rr = 60 / hr;
    const s2Delay = Math.max(0.2, 0.36 * Math.sqrt(rr) - 0.01);
    const vary = 1 + 0.06 * Math.sin(beatCount * 0.7);
    // S1, two components (mitral then tricuspid)
    thump(when, { f: 55, f2: 128, dur: 0.12, gain: 0.95 * vary, noise: 0.55, cutoff: 230 });
    thump(when + 0.025, { f: 66, f2: 140, dur: 0.08, gain: 0.45 * vary, noise: 0.35, cutoff: 250 });
    // S2 (aortic then pulmonic)
    thump(when + s2Delay, { f: 78, f2: 168, dur: 0.075, gain: 0.62 * vary, noise: 0.4, cutoff: 320 });
    thump(when + s2Delay + 0.022, { f: 88, f2: 180, dur: 0.05, gain: 0.25 * vary, noise: 0.2, cutoff: 340 });
    beatCount++;
  };

  const pump = () => {
    if (!ctx) return;
    const horizon = ctx.currentTime + 0.25;
    if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.05;
    while (nextBeat < horizon) {
      scheduleBeat(nextBeat);
      lastScheduled = nextBeat;
      const rr = 60 / hr;
      nextBeat += rr * (1 + 0.025 * Math.sin(beatCount * 0.9));
    }
  };

  return {
    async start(heartRate: number) {
      hr = clamp(heartRate);
      const c = ensureGraph();
      if (c.state === "suspended") await c.resume();
      if (master) {
        master.gain.cancelScheduledValues(c.currentTime);
        master.gain.setTargetAtTime(volume, c.currentTime, 0.03);
      }
      if (playing) return;
      playing = true;
      nextBeat = c.currentTime + 0.08;
      pump();
      timer = setInterval(pump, 50);
    },
    setHeartRate(bpm: number) {
      hr = clamp(bpm);
    },
    trigger() {
      if (!ctx || !playing) return;
      const now = ctx.currentTime;
      const rr = 60 / hr;
      const when = now + 0.015;
      if (Math.abs(lastScheduled - when) > rr * 0.3) {
        scheduleBeat(when);
        lastScheduled = when;
      }
      // Free-running fallback only fires if the next trigger does not arrive.
      nextBeat = when + rr + 0.3;
    },
    setVolume(v: number) {
      volume = Math.min(1, Math.max(0, v));
      if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
    },
    stop() {
      playing = false;
      if (timer) clearInterval(timer);
      timer = null;
      if (ctx && master) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        const c = ctx;
        ctx = null;
        master = null;
        analyser = null;
        noiseBuffer = null;
        setTimeout(() => void c.close().catch(() => {}), 200);
      }
    },
    getLevel() {
      if (!analyser || !playing) return 0;
      analyser.getFloatTimeDomainData(levelBuf);
      let peak = 0;
      for (let i = 0; i < levelBuf.length; i++) {
        const a = Math.abs(levelBuf[i]);
        if (a > peak) peak = a;
      }
      return Math.min(1, peak * 1.6);
    },
    get isPlaying() {
      return playing;
    },
  };
}

function clamp(bpm: number) {
  if (!Number.isFinite(bpm) || bpm <= 0) return 74;
  return Math.min(200, Math.max(30, bpm));
}
