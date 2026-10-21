"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EcgChunk, Feed, StethChunk } from "@/lib/device-sim";
import { api, errorMessage } from "@/lib/api";
import { useDeviceStream, useOnReconnect, useSocketEvent } from "@/lib/socket";
import type { Booking, BookingStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Live device feed
// ---------------------------------------------------------------------------

/** How long without a chunk before a device counts as silent. */
const SILENCE_MS = 2500;

type ChunkOf<K extends "ecg" | "steth"> = K extends "ecg" ? EcgChunk : StethChunk;

export interface LiveFeed<C> {
  /** Stable multicast feed for <EcgMonitor>/<StethMonitor>. */
  feed: Feed<C>;
  /** True while chunks are arriving. */
  live: boolean;
  /** Latest heart rate reported by the device, while live. */
  heartRate: number | null;
}

/**
 * Turns the booking room's `device:ecg` / `device:steth` events into a stable,
 * memoized feed and tracks whether the device is currently streaming.
 */
export function useLiveFeed<K extends "ecg" | "steth">(
  bookingId: string | null | undefined,
  kind: K,
): LiveFeed<ChunkOf<K>> {
  const subs = useRef(new Set<(c: ChunkOf<K>) => void>());
  const [feed] = useState<Feed<ChunkOf<K>>>(() => (cb: (c: ChunkOf<K>) => void) => {
    subs.current.add(cb);
    return () => {
      subs.current.delete(cb);
    };
  });
  const [live, setLive] = useState(false);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useDeviceStream(bookingId, kind, (chunk) => {
    const c = chunk as unknown as ChunkOf<K>;
    subs.current.forEach((s) => s(c));
    setLive(true);
    if (Number.isFinite(chunk.heartRate) && chunk.heartRate > 0) {
      const hr = Math.round(chunk.heartRate);
      setHeartRate((prev) => (prev === hr ? prev : hr));
    }
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      setLive(false);
      setHeartRate(null);
    }, SILENCE_MS);
  });

  useEffect(
    () => () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    },
    [],
  );

  return { feed, live, heartRate: live ? heartRate : null };
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

/** Current time, re-rendering every `intervalMs` while `enabled`. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

/** "04:07" or "1:02:09" */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Time of the most recent timeline entry for `status`, as epoch ms. */
export function statusAt(booking: Booking, status: BookingStatus): number | null {
  for (let i = booking.timeline.length - 1; i >= 0; i--) {
    const entry = booking.timeline[i];
    if (entry.status === status) {
      const t = new Date(entry.at).getTime();
      return Number.isFinite(t) ? t : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Doctor's bookings, kept live
// ---------------------------------------------------------------------------

export interface DoctorBookings {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Ids that just moved into a live status, for a brief highlight. */
  justWentLive: Set<string>;
}

const LIVE: BookingStatus[] = ["testing", "consult"];

/**
 * All bookings assigned to the signed-in doctor, upserted from
 * `booking:updated` (which the API sends to the doctor's user room).
 */
export function useDoctorBookings(): DoctorBookings {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [justWentLive, setJustWentLive] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ bookings: Booking[] }>("/bookings", { signal: controller.signal })
      .then(({ bookings }) => {
        setBookings(bookings);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err, "Couldn't load your consults."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useOnReconnect(reload);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const highlight = useCallback((id: string) => {
    setJustWentLive((prev) => new Set(prev).add(id));
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setJustWentLive((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 6000),
    );
  }, []);

  useSocketEvent<{ booking: Booking }>("booking:updated", (payload) => {
    const next = payload?.booking;
    if (!next?.id) return;
    const old = bookings.find((b) => b.id === next.id);
    if (LIVE.includes(next.status) && old?.status !== next.status) highlight(next.id);
    setBookings((prev) => {
      const idx = prev.findIndex((b) => b.id === next.id);
      if (idx === -1) return [...prev, next];
      const existingBooking = prev[idx];
      const merged: Booking = { ...next };
      // Keep populated refs when the payload carries bare ids.
      for (const key of ["customer", "nurse", "doctor"] as const) {
        const incoming = next[key];
        const existing = existingBooking[key];
        if (typeof incoming === "string" && existing && typeof existing === "object" && existing.id === incoming) {
          (merged as unknown as Record<string, unknown>)[key] = existing;
        }
      }
      const copy = prev.slice();
      copy[idx] = merged;
      return copy;
    });
  });

  return { bookings, loading, error, reload, justWentLive };
}
