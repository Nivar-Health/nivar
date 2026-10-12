/**
 * Synthetic medical device signals for demos and local development.
 *
 * - ECG: Lead II style PQRST morphology built from a sum of Gaussians, with
 *   respiratory sinus arrhythmia, random beat-to-beat variability, baseline
 *   wander and a little noise. Units are millivolts.
 * - Stethoscope: phonocardiogram amplitude envelope (0..1) with S1 ("lub")
 *   and S2 ("dub") bursts locked to the same beat clock.
 *
 * Simulators are driven by wall-clock elapsed time (not timer tick counts), so
 * a throttled background tab catches up instead of drifting.
 */

export type EcgChunk = {
  /** Samples in millivolts. */
  samples: number[];
  sampleRate: number;
  heartRate: number;
  /** Epoch milliseconds of the first sample in the chunk. */
  t: number;
};

export type StethChunk = {
  /** Phonocardiogram amplitude envelope, 0..1. */
  samples: number[];
  heartRate: number;
  /** Epoch milliseconds of the first sample in the chunk. */
  t: number;
  /** Envelope samples per second (defaults to 1000 when absent). */
  sampleRate?: number;
};

export type DeviceSimulator<C> = {
  start(onChunk: (chunk: C) => void): void;
  stop(): void;
  setHeartRate(bpm: number): void;
  readonly heartRate: number;
};

const CHUNK_MS = 100;
/** If the tab was asleep for longer than this, skip ahead instead of flooding. */
const MAX_CATCH_UP_S = 2;

/* ------------------------------------------------------------------------- */
/* Shared helpers                                                            */
/* ------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianFrom(rand: () => number) {
  // Box-Muller
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampHr(bpm: number) {
  if (!Number.isFinite(bpm)) return 74;
  return Math.min(220, Math.max(25, bpm));
}

/**
 * Beat clock: produces R-peak times (seconds) with HRV.
 * RR = 60/HR * (1 + RSA + jitter).
 */
class BeatClock {
  private peaks: number[] = [];
  private nextPeak: number;
  constructor(
    public heartRate: number,
    private rand: () => number,
    firstPeak = 0.35,
  ) {
    this.nextPeak = firstPeak;
  }

  private rr(at: number) {
    const base = 60 / this.heartRate;
    const rsa = 0.035 * Math.sin(2 * Math.PI * 0.22 * at);
    const jitter = 0.018 * gaussianFrom(this.rand);
    return Math.max(0.25, base * (1 + rsa + jitter));
  }

  /** Ensure peaks are generated up to `until` and drop those before `from`. */
  window(from: number, until: number) {
    while (this.nextPeak <= until) {
      this.peaks.push(this.nextPeak);
      this.nextPeak += this.rr(this.nextPeak);
    }
    while (this.peaks.length > 0 && this.peaks[0] < from) this.peaks.shift();
    return this.peaks;
  }

  /** Jump the clock forward (after long tab sleep). */
  skipTo(time: number) {
    this.peaks = this.peaks.filter((p) => p >= time - 1);
    if (this.nextPeak < time) this.nextPeak = time + 0.2;
  }
}

/* ------------------------------------------------------------------------- */
/* ECG                                                                       */
/* ------------------------------------------------------------------------- */

type Wave = { a: number; mu: number; sigma: number };

/** PQRST waves relative to the R peak (seconds), adapted to RR via Bazett-like scaling. */
function pqrst(rr: number): Wave[] {
  const s = Math.sqrt(Math.min(1.6, Math.max(0.3, rr)));
  return [
    { a: 0.14, mu: -0.17 * Math.min(1, s + 0.1), sigma: 0.022 }, // P
    { a: -0.11, mu: -0.032, sigma: 0.009 }, // Q
    { a: 1.12, mu: 0, sigma: 0.0105 }, // R
    { a: -0.27, mu: 0.034, sigma: 0.011 }, // S
    { a: 0.03, mu: 0.09 * s, sigma: 0.03 }, // ST lift
    { a: 0.31, mu: 0.27 * s, sigma: 0.052 * s }, // T
    { a: 0.025, mu: 0.42 * s, sigma: 0.03 }, // U (tiny)
  ];
}

function ecgValueAt(time: number, peaks: number[], heartRate: number) {
  const rr = 60 / heartRate;
  let v = 0;
  for (const p of peaks) {
    const dt = time - p;
    if (dt < -0.35 || dt > 0.75) continue;
    for (const w of pqrst(rr)) {
      const x = (dt - w.mu) / w.sigma;
      if (x > -6 && x < 6) v += w.a * Math.exp(-0.5 * x * x);
    }
  }
  return v;
}

class EcgGenerator {
  private clock: BeatClock;
  private rand: () => number;
  private sampleIndex = 0;
  constructor(
    heartRate: number,
    readonly sampleRate: number,
    private noise: number,
    seed = 7,
  ) {
    this.rand = mulberry32(seed);
    this.clock = new BeatClock(clampHr(heartRate), this.rand);
  }

  get heartRate() {
    return this.clock.heartRate;
  }
  set heartRate(bpm: number) {
    this.clock.heartRate = clampHr(bpm);
  }

  get position() {
    return this.sampleIndex;
  }

  skipTo(sampleIndex: number) {
    if (sampleIndex <= this.sampleIndex) return;
    this.sampleIndex = sampleIndex;
    this.clock.skipTo(sampleIndex / this.sampleRate);
  }

  next(count: number) {
    const out = new Array<number>(count);
    const start = this.sampleIndex / this.sampleRate;
    const end = (this.sampleIndex + count) / this.sampleRate;
    const peaks = this.clock.window(start - 0.8, end + 0.4);
    for (let i = 0; i < count; i++) {
      const t = (this.sampleIndex + i) / this.sampleRate;
      const wander =
        0.045 * Math.sin(2 * Math.PI * 0.22 * t + 0.4) + 0.02 * Math.sin(2 * Math.PI * 0.061 * t);
      const n = this.noise * gaussianFrom(this.rand) + 0.004 * Math.sin(2 * Math.PI * 50 * t);
      const v = ecgValueAt(t, peaks, this.clock.heartRate) + wander + n;
      out[i] = Math.round(v * 1000) / 1000;
    }
    this.sampleIndex += count;
    return out;
  }
}

export type EcgSimulatorOptions = {
  heartRate?: number;
  sampleRate?: number;
  noise?: number;
};

export function createEcgSimulator({
  heartRate = 74,
  sampleRate = 250,
  noise = 0.02,
}: EcgSimulatorOptions = {}): DeviceSimulator<EcgChunk> {
  const gen = new EcgGenerator(heartRate, sampleRate, noise, Math.floor(Math.random() * 1e9));
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;

  const tick = (onChunk: (c: EcgChunk) => void) => {
    const elapsed = (Date.now() - startedAt) / 1000;
    let target = Math.floor(elapsed * sampleRate);
    if (target - gen.position > MAX_CATCH_UP_S * sampleRate) {
      gen.skipTo(target - Math.round((CHUNK_MS / 1000) * sampleRate));
    }
    const chunkSize = Math.round((CHUNK_MS / 1000) * sampleRate);
    // Emit in regular ~100 ms chunks, even when catching up.
    while (target - gen.position >= chunkSize) {
      const t = startedAt + (gen.position / sampleRate) * 1000;
      onChunk({ samples: gen.next(chunkSize), sampleRate, heartRate: Math.round(gen.heartRate), t });
      target = Math.floor(((Date.now() - startedAt) / 1000) * sampleRate);
    }
  };

  return {
    start(onChunk) {
      if (timer) return;
      startedAt = Date.now() - (gen.position / sampleRate) * 1000;
      timer = setInterval(() => tick(onChunk), CHUNK_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setHeartRate(bpm) {
      gen.heartRate = bpm;
    },
    get heartRate() {
      return gen.heartRate;
    },
  };
}

/** Static ECG capture, e.g. for a report strip. Deterministic for a given seed. */
export function generateEcgSamples(
  seconds: number,
  heartRate = 74,
  sampleRate = 250,
  seed = 42,
): number[] {
  const gen = new EcgGenerator(heartRate, sampleRate, 0.012, seed);
  return gen.next(Math.max(0, Math.round(seconds * sampleRate)));
}

/* ------------------------------------------------------------------------- */
/* Stethoscope (phonocardiogram envelope)                                    */
/* ------------------------------------------------------------------------- */

export const STETH_SAMPLE_RATE = 1000;

function burst(dt: number, center: number, width: number) {
  const x = (dt - center) / width;
  return x > -5 && x < 5 ? Math.exp(-0.5 * x * x) : 0;
}

class StethGenerator {
  private clock: BeatClock;
  private rand: () => number;
  private sampleIndex = 0;
  private smoothed = 0;
  constructor(
    heartRate: number,
    readonly sampleRate: number,
    seed = 11,
  ) {
    this.rand = mulberry32(seed);
    this.clock = new BeatClock(clampHr(heartRate), this.rand);
  }
  get heartRate() {
    return this.clock.heartRate;
  }
  set heartRate(bpm: number) {
    this.clock.heartRate = clampHr(bpm);
  }
  get position() {
    return this.sampleIndex;
  }
  skipTo(sampleIndex: number) {
    if (sampleIndex <= this.sampleIndex) return;
    this.sampleIndex = sampleIndex;
    this.clock.skipTo(sampleIndex / this.sampleRate);
  }

  next(count: number) {
    const out = new Array<number>(count);
    const start = this.sampleIndex / this.sampleRate;
    const end = (this.sampleIndex + count) / this.sampleRate;
    const peaks = this.clock.window(start - 1, end + 0.2);
    const rr = 60 / this.clock.heartRate;
    // S2 follows S1 by roughly the systolic interval, which shortens with HR.
    const s2Delay = Math.max(0.2, 0.36 * Math.sqrt(rr) - 0.01);
    for (let i = 0; i < count; i++) {
      const t = (this.sampleIndex + i) / this.sampleRate;
      let env = 0;
      for (const p of peaks) {
        const dt = t - p;
        if (dt < -0.1 || dt > 0.9) continue;
        // S1: mitral + tricuspid closure, two close components, stronger.
        env += 0.92 * burst(dt, 0.04, 0.022) + 0.55 * burst(dt, 0.068, 0.018);
        // S2: aortic + pulmonic closure, shorter and softer.
        env += 0.62 * burst(dt, s2Delay, 0.015) + 0.3 * burst(dt, s2Delay + 0.025, 0.012);
      }
      // Vibration texture inside the bursts and a faint noise floor.
      const texture = 0.72 + 0.28 * Math.abs(Math.sin(2 * Math.PI * 47 * t + 3 * Math.sin(2 * Math.PI * 9 * t)));
      const floor = 0.035 + 0.02 * Math.abs(gaussianFrom(this.rand));
      const raw = Math.min(1, env * texture + floor);
      this.smoothed += (raw - this.smoothed) * 0.55;
      out[i] = Math.round(this.smoothed * 1000) / 1000;
    }
    this.sampleIndex += count;
    return out;
  }
}

export type StethSimulatorOptions = {
  heartRate?: number;
  /** Envelope samples per second. 1000 => 100 samples per 100 ms chunk. */
  sampleRate?: number;
};

export function createStethSimulator({
  heartRate = 74,
  sampleRate = STETH_SAMPLE_RATE,
}: StethSimulatorOptions = {}): DeviceSimulator<StethChunk> {
  const gen = new StethGenerator(heartRate, sampleRate, Math.floor(Math.random() * 1e9));
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;
  const chunkSize = Math.round((CHUNK_MS / 1000) * sampleRate);

  const tick = (onChunk: (c: StethChunk) => void) => {
    let target = Math.floor(((Date.now() - startedAt) / 1000) * sampleRate);
    if (target - gen.position > MAX_CATCH_UP_S * sampleRate) {
      gen.skipTo(target - chunkSize);
    }
    while (target - gen.position >= chunkSize) {
      const t = startedAt + (gen.position / sampleRate) * 1000;
      onChunk({ samples: gen.next(chunkSize), heartRate: Math.round(gen.heartRate), t, sampleRate });
      target = Math.floor(((Date.now() - startedAt) / 1000) * sampleRate);
    }
  };

  return {
    start(onChunk) {
      if (timer) return;
      startedAt = Date.now() - (gen.position / sampleRate) * 1000;
      timer = setInterval(() => tick(onChunk), CHUNK_MS);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setHeartRate(bpm) {
      gen.heartRate = bpm;
    },
    get heartRate() {
      return gen.heartRate;
    },
  };
}

/** Static phonocardiogram capture. */
export function generateStethSamples(
  seconds: number,
  heartRate = 74,
  sampleRate = STETH_SAMPLE_RATE,
  seed = 42,
): number[] {
  const gen = new StethGenerator(heartRate, sampleRate, seed);
  return gen.next(Math.max(0, Math.round(seconds * sampleRate)));
}

/* ------------------------------------------------------------------------- */
/* Feed helpers                                                              */
/* ------------------------------------------------------------------------- */

/** A subscription: register a callback, get an unsubscribe function back. */
export type Feed<C> = (cb: (chunk: C) => void) => () => void;

/**
 * Wrap a simulator as a multicast feed. The simulator runs while there is at
 * least one subscriber.
 */
export function simulatorFeed<C>(sim: DeviceSimulator<C>): Feed<C> {
  const subs = new Set<(c: C) => void>();
  return (cb) => {
    subs.add(cb);
    if (subs.size === 1) sim.start((c) => subs.forEach((s) => s(c)));
    return () => {
      subs.delete(cb);
      if (subs.size === 0) sim.stop();
    };
  };
}
