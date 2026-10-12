/** Geo helpers for live tracking. Pure functions, safe on the server. */

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Rough city driving ETA in whole minutes (minimum 1). Straight-line distance
 * is inflated by a road-network factor of 1.3.
 */
export function etaMinutes(km: number, avgKmph = 22): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.max(1, Math.round(((km * 1.3) / avgKmph) * 60));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1)} km`;
}

/** Deterministic pseudo-random from coordinates, so the same trip draws the same route. */
function seeded(a: LatLng, b: LatLng) {
  let h = 2166136261;
  for (const n of [a.lat, a.lng, b.lat, b.lng]) {
    const s = Math.round(n * 1e5);
    h ^= s;
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/**
 * Plausible city route: offset waypoints along the trip plus right-angle
 * "street corners" between some of them. Deterministic for a given from/to.
 */
export function buildRoute(from: LatLng, to: LatLng): LatLng[] {
  const rand = seeded(from, to);
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  // Perpendicular unit-ish vector in degree space.
  const len = Math.hypot(dLat, dLng) || 1e-9;
  const px = -dLng / len;
  const py = dLat / len;
  const fractions = [0.16, 0.34, 0.52, 0.7, 0.86];
  const offsets = [0.07, -0.05, 0.06, -0.035, 0.025];
  const pts: LatLng[] = [from];
  fractions.forEach((f, i) => {
    const off = offsets[i] * len * (0.7 + rand() * 0.6);
    pts.push({ lat: from.lat + dLat * f + py * off, lng: from.lng + dLng * f + px * off });
  });
  pts.push(to);

  const route: LatLng[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    // Every other leg turns a corner, like following a grid of streets.
    if (i % 2 === 1 && i < pts.length - 1) {
      route.push(rand() > 0.5 ? { lat: b.lat, lng: a.lng } : { lat: a.lat, lng: b.lng });
    }
    route.push(b);
  }
  return route;
}

function pointAlong(route: LatLng[], cum: number[], d: number): LatLng {
  if (d <= 0) return route[0];
  const total = cum[cum.length - 1];
  if (d >= total) return route[route.length - 1];
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / seg;
  const a = route[i - 1];
  const b = route[i];
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export type DriveOptions = {
  durationMs?: number;
  intervalMs?: number;
  onPoint: (point: LatLng, info: { progress: number; done: boolean }) => void;
};

/**
 * Simulates a nurse driving from `from` to `to`. Emits a point immediately and
 * then every `intervalMs`; position is derived from elapsed wall-clock time so
 * throttled background tabs stay on schedule. Returns `stop()`.
 */
export function simulateDrive(
  from: LatLng,
  to: LatLng,
  { durationMs = 45000, intervalMs = 1000, onPoint }: DriveOptions,
): () => void {
  const route = buildRoute(from, to);
  const cum = [0];
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + haversineKm(route[i - 1], route[i]));
  const total = cum[cum.length - 1];
  const startedAt = Date.now();
  let stopped = false;

  // Ease in/out with gentle "traffic" speed variation.
  const progressAt = (p: number) => {
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const mix = 0.35 * eased + 0.65 * p;
    const traffic = 0.018 * Math.sin(p * Math.PI * 6) * Math.sin(p * Math.PI);
    return Math.min(1, Math.max(0, mix + traffic));
  };

  const emit = () => {
    if (stopped) return;
    const p = Math.min(1, (Date.now() - startedAt) / durationMs);
    const done = p >= 1;
    onPoint(pointAlong(route, cum, progressAt(p) * total), { progress: p, done });
    if (done) stop();
  };

  const timer = setInterval(emit, intervalMs);
  const stop = () => {
    stopped = true;
    clearInterval(timer);
  };
  emit();
  return stop;
}
