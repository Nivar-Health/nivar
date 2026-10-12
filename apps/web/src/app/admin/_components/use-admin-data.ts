"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useSocket, useSocketEvent } from "@/lib/socket";
import type { AdminStats, Booking, StaffMember } from "@/lib/types";

interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Re-runs `fn` after a socket reconnect so a long-open console catches up. */
function useOnReconnect(fn: () => void) {
  const s = useSocket();
  const run = useEffectEvent(fn);
  useEffect(() => {
    if (!s) return;
    const onReconnect = () => run();
    s.io.on("reconnect", onReconnect);
    return () => {
      s.io.off("reconnect", onReconnect);
    };
  }, [s]);
}

/**
 * GET a JSON resource and keep it fresh: re-fetches (debounced) on every
 * `booking:updated` when `liveDebounceMs` is set, and after reconnects.
 */
export function useAdminResource<T>(path: string | null, liveDebounceMs?: number): Resource<T> {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({
    path: null,
    data: null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api
      .get<T>(path, { signal: controller.signal })
      .then((data) => setState({ path, data, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          path,
          data: prev.path === path ? prev.data : null,
          error: errorMessage(err, "Couldn't load this data."),
        }));
      });
    return () => controller.abort();
  }, [path, nonce]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useSocketEvent("booking:updated", () => {
    if (liveDebounceMs === undefined) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(reload, liveDebounceMs);
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useOnReconnect(reload);

  const current = state.path === path ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: Boolean(path) && !current,
    reload,
  };
}

export function useAdminStats() {
  return useAdminResource<AdminStats>("/admin/stats", 500);
}

export function useStaff(role: "nurse" | "doctor" | null, live = true) {
  const res = useAdminResource<{ staff: StaffMember[] }>(
    role ? `/admin/staff?role=${role}` : "/admin/staff",
    live ? 800 : undefined,
  );
  return { ...res, staff: res.data?.staff ?? null };
}

export type BookingChange = (next: Booking, prev: Booking | undefined) => void;

/**
 * Every booking (admin scope), upserted live from `booking:updated`.
 * `onChange` receives each live update together with the previous copy.
 */
export function useAdminBookings(onChange?: BookingChange) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  /** Last known copy of each booking, for diffing live updates. */
  const known = useRef(new Map<string, Booking>());
  /** Ids updated live in the last couple of seconds, for a brief row highlight. */
  const [flashing, setFlashing] = useState<ReadonlySet<string>>(() => new Set());
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ bookings: Booking[] }>("/bookings", { signal: controller.signal })
      .then(({ bookings }) => {
        known.current = new Map(bookings.map((b) => [b.id, b]));
        setBookings(bookings);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err, "Couldn't load bookings."));
      });
    return () => controller.abort();
  }, [nonce]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useSocketEvent<{ booking: Booking }>("booking:updated", (payload) => {
    const next = payload?.booking;
    if (!next?.id) return;
    const prev = known.current.get(next.id);
    // Keep populated refs when a payload carries bare ids.
    const merged: Booking = { ...next };
    for (const key of ["customer", "nurse", "doctor"] as const) {
      const incoming = next[key];
      const existing = prev?.[key];
      if (typeof incoming === "string" && existing && typeof existing === "object" && existing.id === incoming) {
        (merged as unknown as Record<string, unknown>)[key] = existing;
      }
    }
    known.current.set(next.id, merged);
    setBookings((list) => {
      if (!list) return list;
      const idx = list.findIndex((b) => b.id === next.id);
      if (idx === -1) return [...list, merged];
      const copy = list.slice();
      copy[idx] = merged;
      return copy;
    });
    setFlashing((f) => new Set(f).add(next.id));
    setTimeout(() => {
      setFlashing((f) => {
        const copy = new Set(f);
        copy.delete(next.id);
        return copy;
      });
    }, 2200);
    onChangeRef.current?.(merged, prev);
  });

  useOnReconnect(reload);

  return { bookings, error, loading: bookings === null && !error, reload, flashing };
}

/** A clock that re-renders every `ms` for relative timestamps. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
