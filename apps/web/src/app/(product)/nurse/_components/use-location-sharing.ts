"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haversineKm, simulateDrive, type LatLng } from "@/components/live";
import { api } from "@/lib/api";
import { demoMode } from "@/lib/features";
import { emit } from "@/lib/socket";

const PREF_KEY = "nivar_nurse_simulate_drive";
/** Further than this from the patient and GPS is clearly not the nurse's real trip (demo laptop). */
const FAR_KM = 30;
const GPS_TIMEOUT_MS = 8000;
const DRIVE_MS = 45_000;
/** The position is persisted (PUT /bookings/:id/location) at most this often. */
const PERSIST_MS = 3000;

/**
 * idle: not watching yet; locating: waiting for the first fix; ok: sharing a real fix;
 * unavailable: no fix (timeout, no GPS); denied: the browser blocks location for this site;
 * far: the fix is nowhere near the patient (demo only); off: the nurse chose not to share.
 */
export type GpsState = "idle" | "locating" | "ok" | "unavailable" | "denied" | "far" | "off";

/** The browser's location permission for this site, as far as it tells us. */
export type LocationPermission = "granted" | "prompt" | "denied" | "unknown";

function readPref(): boolean | null {
  if (!demoMode) return null;
  try {
    const v = window.localStorage.getItem(PREF_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function writePref(v: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, v ? "1" : "0");
  } catch {
    // Storage blocked: the choice still applies for this page.
  }
}

export interface LocationSharing {
  /** Latest position we shared (or the starting point before the trip). */
  position: LatLng | null;
  /** The latest position from this trip (real or simulated), or null before the first one. */
  live: LatLng | null;
  /** True when the simulated drive (demo mode only) is driving the location. */
  simulate: boolean;
  setSimulate: (on: boolean) => void;
  gps: GpsState;
  permission: LocationPermission;
  /**
   * Whether real location is shared on this trip: true once the nurse agreed (or the browser already
   * allows it), false when she chose not to, null while undecided. Always true in demo mode.
   */
  consent: boolean | null;
  setConsent: (on: boolean) => void;
  /** 0..1 progress of the simulated drive. */
  progress: number;
  /** True once the simulated drive reached the patient. */
  reached: boolean;
  /** True while location is being shared. */
  sharing: boolean;
}

/**
 * Shares the nurse's location for a booking while `active` (status en_route).
 *
 * Real use (demo mode off): real GPS only, and only once the nurse has agreed to share it on this
 * trip (or the browser already allows location for the site). Nothing is ever simulated.
 *
 * Demo mode: real GPS when location permission is already granted and the fix is within 30 km of
 * the patient. Otherwise (no geolocation, permission not granted, slow, or far away, e.g. a demo
 * laptop) it runs a simulated drive from `from` to `to`, and GPS mode falls back to the simulation
 * on error or timeout. The "Simulate drive" switch flips between them; the choice is remembered.
 */
export function useLocationSharing({
  bookingId,
  active,
  from,
  to,
}: {
  bookingId: string;
  active: boolean;
  from: LatLng | null;
  to: LatLng;
}): LocationSharing {
  const [pref, setPref] = useState<boolean | null>(() => (typeof window === "undefined" ? null : readPref()));
  const [autoSimulate, setAutoSimulate] = useState<boolean | null>(() =>
    demoMode && typeof navigator !== "undefined" && !("geolocation" in navigator) ? true : null,
  );
  const [permission, setPermission] = useState<LocationPermission>("unknown");
  const [choice, setChoice] = useState<boolean | null>(null);
  const [gps, setGps] = useState<GpsState>("idle");
  const [livePos, setLivePos] = useState<LatLng | null>(null);
  const [progress, setProgress] = useState(0);
  const [reached, setReached] = useState(false);

  const positionRef = useRef<LatLng | null>(null);
  const fromRef = useRef(from);
  const toRef = useRef(to);
  useEffect(() => {
    fromRef.current = from;
    toRef.current = to;
  });

  // Demo-friendly default: simulate unless we already know GPS works near the patient.
  const simulate = demoMode && (pref ?? autoSimulate ?? true);
  // Real use asks before the browser does; a site the nurse already allowed needs no second question.
  const consent = demoMode ? true : (choice ?? (permission === "granted" ? true : null));

  // Follow the browser's permission, without prompting.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const read = () => {
      if (status && !cancelled) setPermission(status.state);
    };
    navigator.permissions
      .query({ name: "geolocation" })
      .then((s) => {
        status = s;
        read();
        s.addEventListener("change", read);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      status?.removeEventListener("change", read);
    };
  }, []);

  // Demo: probe GPS without prompting, only when permission is already granted.
  useEffect(() => {
    if (!demoMode || autoSimulate !== null || pref !== null || permission !== "granted") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAutoSimulate(haversineKm(p, toRef.current) > FAR_KM);
      },
      () => {
        if (!cancelled) setAutoSimulate(true);
      },
      { timeout: GPS_TIMEOUT_MS, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [autoSimulate, pref, permission]);

  // Every point is broadcast live to the booking channel; the server never sees the
  // broadcast, so the latest point is also persisted, throttled to one request per 3 s.
  const lastPersistAt = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    },
    [],
  );
  const persist = useCallback(
    (p: LatLng) => {
      const send = () => {
        lastPersistAt.current = Date.now();
        persistTimer.current = null;
        // A missed point is replaced by the next one a few seconds later.
        api.put(`/bookings/${bookingId}/location`, { lat: p.lat, lng: p.lng }).catch(() => {});
      };
      const wait = PERSIST_MS - (Date.now() - lastPersistAt.current);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (wait <= 0) send();
      else persistTimer.current = setTimeout(send, wait);
    },
    [bookingId],
  );

  const share = useCallback(
    (p: LatLng) => {
      positionRef.current = p;
      setLivePos(p);
      emit("nurse:location", { bookingId, lat: p.lat, lng: p.lng, at: new Date().toISOString() });
      persist(p);
    },
    [bookingId, persist],
  );

  // Simulated drive (demo mode only).
  useEffect(() => {
    if (!active || !simulate) return;
    const start = positionRef.current ?? fromRef.current;
    const dest = toRef.current;
    if (!start) return;
    const stop = simulateDrive(start, dest, {
      durationMs: DRIVE_MS,
      intervalMs: 1000,
      onPoint: (p, { progress: pr, done }) => {
        share(p);
        setProgress(pr);
        if (done) setReached(true);
      },
    });
    return stop;
  }, [active, simulate, share]);

  // Real GPS (in demo mode it also decides the automatic default on the first fix or failure).
  const watch = active && !simulate && consent === true;
  useEffect(() => {
    if (!watch) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setGps("unavailable"));
      return;
    }
    let lastSent = 0;
    let gotFix = false;
    const fallback = window.setTimeout(() => {
      if (!gotFix) {
        setGps("unavailable");
        if (demoMode) setAutoSimulate(true);
      }
    }, GPS_TIMEOUT_MS);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true;
        window.clearTimeout(fallback);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (demoMode && haversineKm(p, toRef.current) > FAR_KM) {
          setGps("far");
          setAutoSimulate(true);
          return;
        }
        setGps("ok");
        if (demoMode) setAutoSimulate(false);
        const now = Date.now();
        if (now - lastSent >= 1000) {
          lastSent = now;
          share(p);
        }
      },
      (err) => {
        window.clearTimeout(fallback);
        setGps(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
        if (demoMode) setAutoSimulate(true);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: GPS_TIMEOUT_MS },
    );
    // Shown while we wait for the first fix; set from a callback-free microtask to keep effects pure.
    queueMicrotask(() => {
      if (!gotFix) setGps((g) => (g === "idle" || g === "off" ? "locating" : g));
    });
    return () => {
      window.clearTimeout(fallback);
      navigator.geolocation.clearWatch(id);
    };
  }, [watch, share]);

  const setSimulate = useCallback((on: boolean) => {
    writePref(on);
    setPref(on);
    if (on) setReached(false);
  }, []);

  const setConsent = useCallback((on: boolean) => {
    setChoice(on);
    if (!on) setGps("off");
  }, []);

  return {
    position: livePos ?? from,
    live: livePos,
    simulate,
    setSimulate,
    gps: consent === false && !simulate ? "off" : permission === "denied" && !simulate ? "denied" : gps,
    permission,
    consent,
    setConsent,
    progress,
    reached,
    sharing: active && (simulate || (consent === true && gps === "ok")),
  };
}
