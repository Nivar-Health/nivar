// Synthetic ECG (lead II-like PQRST) and phonocardiogram envelope generators for seed data.
import { createRng } from './random.js';

const round = (v, dp = 3) => Math.round(v * 10 ** dp) / 10 ** dp;
const gaussian = (t, mu, sigma, amp) => amp * Math.exp(-((t - mu) ** 2) / (2 * sigma ** 2));

/**
 * One heartbeat as a sum of Gaussians, with `t` in seconds relative to the R peak.
 * Wave timings scale gently with the RR interval (QT shortens as HR rises).
 */
function beatValue(t, rr, amp = 1) {
  const qtScale = Math.sqrt(rr); // Bazett-style
  return (
    gaussian(t, -0.2 * Math.min(1, rr / 0.8), 0.025, 0.12 * amp) + // P
    gaussian(t, -0.035, 0.01, -0.1 * amp) + // Q
    gaussian(t, 0, 0.011, 1.05 * amp) + // R
    gaussian(t, 0.033, 0.011, -0.22 * amp) + // S
    gaussian(t, 0.26 * qtScale, 0.05 * qtScale, 0.3 * amp) // T
  );
}

/**
 * Generate an ECG strip.
 * @param {object} opts
 * @param {number} opts.heartRate beats per minute
 * @param {number} [opts.seconds=10]
 * @param {number} [opts.sampleRate=250]
 * @param {number} [opts.noise=0.012] mV of white noise
 * @param {number} [opts.seed]
 * @returns {number[]} samples in mV (roughly -0.3 .. 1.2)
 */
export function generateEcg({ heartRate = 72, seconds = 10, sampleRate = 250, noise = 0.012, seed = 1 } = {}) {
  const rng = createRng(seed);
  const n = Math.round(seconds * sampleRate);
  const meanRr = 60 / heartRate;

  // Beat times with mild respiratory heart-rate variability.
  const beats = [];
  let tBeat = rng.float(0.15, 0.6);
  while (tBeat < seconds + 1) {
    beats.push({ at: tBeat, amp: rng.float(0.95, 1.05) });
    tBeat += meanRr * (1 + 0.035 * Math.sin(2 * Math.PI * 0.22 * tBeat) + rng.gauss(0, 0.01));
  }

  const wanderPhase = rng.float(0, Math.PI * 2);
  const samples = new Array(n);
  let b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    while (b + 1 < beats.length && Math.abs(beats[b + 1].at - t) < Math.abs(beats[b].at - t)) b++;
    let v = 0;
    for (let k = Math.max(0, b - 1); k <= Math.min(beats.length - 1, b + 1); k++) {
      const rr = k + 1 < beats.length ? beats[k + 1].at - beats[k].at : meanRr;
      v += beatValue(t - beats[k].at, rr, beats[k].amp);
    }
    v += 0.03 * Math.sin(2 * Math.PI * 0.25 * t + wanderPhase); // baseline wander
    v += rng.gauss(0, noise);
    samples[i] = round(v);
  }
  return samples;
}

/**
 * Phonocardiogram envelope (0..1): S1 ("lub") then S2 ("dub") each beat.
 * Downsampled to `sampleRate` Hz (default 50 Hz over 10 s = 500 points).
 */
export function generateStethEnvelope({ heartRate = 72, seconds = 10, sampleRate = 50, murmur = false, seed = 7 } = {}) {
  const rng = createRng(seed);
  const n = Math.round(seconds * sampleRate);
  const rr = 60 / heartRate;
  const s2Delay = Math.min(0.34, 0.42 * Math.sqrt(rr));
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const phase = t % rr;
    let v = gaussian(phase, 0.05, 0.022, 1) + gaussian(phase, 0.05 + s2Delay, 0.018, 0.68);
    if (murmur && phase > 0.09 && phase < 0.05 + s2Delay - 0.04) v += 0.12;
    v += Math.abs(rng.gauss(0, 0.025));
    out[i] = round(Math.min(1, v), 3);
  }
  return out;
}
