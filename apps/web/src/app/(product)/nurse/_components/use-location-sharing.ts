"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { haversineKm, simulateDrive, type LatLng } from "@/components/live";
import { api } from "@/lib/api";
import { emit } from "@/lib/socket";

const PREF_KEY = "nivar_nurse_simulate_drive";
/** Further than this from the patient and GPS is clearly not the nurse's real trip (demo laptop). */
const FAR_KM = 30;
const GPS_TIMEOUT_MS = 8000;
const DRIVE_MS = 45_000;
/** The position is persisted (PUT /bookings/:id/location) at most this often. */
const PERSIST_MS = 3000;

export type GpsState = "idle" | "locating" | "ok" | "unavailable" | "far";

function readPref(): boolean | null {
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
  /** True when the simulated drive (demo mode) is driving the location. */
  simulate: boolean;
  setSimulate: (on: boolean) => void;
  gps: GpsState;
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
 * Uses real GPS (watchPosition) when location permission is already granted
 * and the fix is within 30 km of the patient. Otherwise (no geolocation,
 * permission not granted, slow, or far away, e.g. a demo laptop) it runs a
 * simulated drive from `from` to `to`. GPS mode also falls back to the
 * simulation on error or timeout. The nurse can flip the "Simulate drive"
 * toggle any time; the choice is remembered.
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
    typeof navigator !== "undefined" && !("geolocation" in navigator) ? true : null,
  );
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
  const simulate = pref ?? autoSimulate ?? true;

  // Probe GPS without prompting: only when permission is already granted.
  useEffect(() => {
    if (autoSimulate !== null || pref !== null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((perm) => {
        if (cancelled || perm.state !== "granted") return;
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [autoSimulate, pref]);

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

  // Simulated drive.
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

  // Real GPS (also decides the automatic default on the first fix or failure).
  useEffect(() => {
    if (!active || simulate) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let lastSent = 0;
    let gotFix = false;
    const fallback = window.setTimeout(() => {
      if (!gotFix) {
        setGps("unavailable");
        setAutoSimulate(true);
      }
    }, GPS_TIMEOUT_MS);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true;
        window.clearTimeout(fallback);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (haversineKm(p, toRef.current) > FAR_KM) {
          setGps("far");
          setAutoSimulate(true);
          return;
        }
        setGps("ok");
        setAutoSimulate(false);
        const now = Date.now();
        if (now - lastSent >= 1000) {
          lastSent = now;
          share(p);
        }
      },
      () => {
        window.clearTimeout(fallback);
        setGps("unavailable");
        setAutoSimulate(true);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: GPS_TIMEOUT_MS },
    );
    // Shown while we wait for the first fix; set from a callback-free microtask to keep effects pure.
    queueMicrotask(() => {
      if (!gotFix) setGps((g) => (g === "idle" ? "locating" : g));
    });
    return () => {
      window.clearTimeout(fallback);
      navigator.geolocation.clearWatch(id);
    };
  }, [active, simulate, share]);

  const setSimulate = useCallback((on: boolean) => {
    writePref(on);
    setPref(on);
    if (on) setReached(false);
  }, []);

  return {
    position: livePos ?? from,
    simulate,
    setSimulate,
    gps,
    progress,
    reached,
    sharing: active && (simulate || gps === "ok"),
  };
}
