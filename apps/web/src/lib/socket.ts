"use client";

import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { API_ORIGIN, api, errorMessage, tokenStore } from "@/lib/api";
import { bookingPathForRole, useAuth } from "@/lib/auth";
import type {
  Booking,
  DeviceKind,
  DeviceState,
  DeviceStatusEvent,
  EcgChunkEvent,
  NotifyEvent,
  NurseLocation,
  NurseLocationEvent,
  StethChunkEvent,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Singleton socket, keyed to the current tab's token.
// Reconnects when the token changes and disconnects on logout.
// ---------------------------------------------------------------------------

let socket: Socket | null = null;
let socketToken: string | null = null;
let tokenUnsubscribe: (() => void) | null = null;
const instanceListeners = new Set<() => void>();

/** Booking rooms this tab wants to be in, ref-counted across hooks. */
const bookingRooms = new Map<string, number>();

function createSocket(token: string): Socket {
  // An empty origin means same origin, which socket.io-client takes as `undefined`.
  const s = io(API_ORIGIN || undefined, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });
  // (Re)join every booking room on connect, which also covers reconnects.
  s.on("connect", () => {
    bookingRooms.forEach((_count, bookingId) => s.emit("booking:join", { bookingId }));
  });
  return s;
}

function syncSocket() {
  const token = tokenStore.get();
  if (token === socketToken && (socket !== null) === (token !== null)) return;
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socketToken = token;
  if (token) socket = createSocket(token);
  instanceListeners.forEach((l) => l());
}

function subscribeSocket(listener: () => void): () => void {
  instanceListeners.add(listener);
  if (!tokenUnsubscribe) tokenUnsubscribe = tokenStore.subscribe(syncSocket);
  syncSocket();
  return () => {
    instanceListeners.delete(listener);
  };
}

/** The current socket (creating it if a token exists), or null when signed out. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (!tokenUnsubscribe) tokenUnsubscribe = tokenStore.subscribe(syncSocket);
  syncSocket();
  return socket;
}

/** Fire-and-forget emit on the shared socket. Returns false when not connected. */
export function emit(event: string, payload: unknown): boolean {
  const s = getSocket();
  if (!s) return false;
  s.emit(event, payload);
  return s.connected;
}

/** React access to the shared socket instance. Null during SSR and when signed out. */
export function useSocket(): Socket | null {
  return useSyncExternalStore(
    subscribeSocket,
    () => socket,
    () => null,
  );
}

/** Whether the realtime connection is currently up. */
export function useSocketConnected(): boolean {
  const s = useSocket();
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!s) return () => {};
      s.on("connect", cb);
      s.on("disconnect", cb);
      return () => {
        s.off("connect", cb);
        s.off("disconnect", cb);
      };
    },
    [s],
  );
  return useSyncExternalStore(
    subscribe,
    () => s?.connected ?? false,
    () => false,
  );
}

/** Subscribes `handler` to a server event for the lifetime of the component. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  const s = useSocket();
  const onEvent = useEffectEvent(handler);
  useEffect(() => {
    if (!s) return;
    const fn = (payload: T) => onEvent(payload);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [s, event]);
}

function retainBookingRoom(bookingId: string) {
  const count = bookingRooms.get(bookingId) ?? 0;
  bookingRooms.set(bookingId, count + 1);
  if (count === 0) {
    const s = getSocket();
    if (s?.connected) s.emit("booking:join", { bookingId });
  }
}

function releaseBookingRoom(bookingId: string) {
  const count = bookingRooms.get(bookingId) ?? 0;
  if (count <= 1) {
    bookingRooms.delete(bookingId);
    if (socket?.connected) socket.emit("booking:leave", { bookingId });
  } else {
    bookingRooms.set(bookingId, count - 1);
  }
}

/**
 * Keeps this tab joined to `booking:<id>` while mounted (re-joins on reconnect,
 * leaves on unmount). Safe to call from several components for the same booking.
 */
export function useBookingRoom(bookingId: string | null | undefined): void {
  const s = useSocket();
  useEffect(() => {
    if (!s || !bookingId) return;
    retainBookingRoom(bookingId);
    return () => releaseBookingRoom(bookingId);
  }, [s, bookingId]);
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/**
 * Socket payloads may carry bare ids for customer / nurse / doctor. Keep the
 * populated object we already have when the id is unchanged.
 */
function mergeBooking(prev: Booking | null, next: Booking): { booking: Booking; stale: boolean } {
  if (!prev || prev.id !== next.id) {
    return { booking: next, stale: typeof next.customer === "string" };
  }
  let stale = false;
  const merged: Booking = { ...next };
  for (const key of ["customer", "nurse", "doctor"] as const) {
    const incoming = next[key];
    const existing = prev[key];
    if (typeof incoming === "string") {
      if (existing && typeof existing === "object" && existing.id === incoming) {
        (merged as unknown as Record<string, unknown>)[key] = existing;
      } else {
        stale = true;
      }
    }
  }
  return { booking: merged, stale };
}

interface BookingState {
  id: string | null;
  booking: Booking | null;
  error: string | null;
  status: number | null;
}

export interface UseBookingResult {
  booking: Booking | null;
  setBooking: (booking: Booking) => void;
  loading: boolean;
  error: string | null;
  /** HTTP status of the last failed load (e.g. 403, 404), if any. */
  errorStatus: number | null;
  reload: () => void;
}

/**
 * Loads GET /bookings/:id, joins the booking room and keeps the booking live
 * via `booking:updated`. Refetches after a socket reconnect to catch up.
 */
export function useBooking(bookingId: string | null | undefined): UseBookingResult {
  const [state, setState] = useState<BookingState>({
    id: null,
    booking: null,
    error: null,
    status: null,
  });
  const [nonce, setNonce] = useState(0);
  const s = useSocket();

  useBookingRoom(bookingId);

  useEffect(() => {
    if (!bookingId) return;
    const controller = new AbortController();
    api
      .get<{ booking: Booking }>(`/bookings/${bookingId}`, { signal: controller.signal })
      .then(({ booking }) =>
        setState({ id: bookingId, booking, error: null, status: null }),
      )
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          id: bookingId,
          // Keep showing the last good copy if a background reload fails.
          booking: prev.id === bookingId ? prev.booking : null,
          error: errorMessage(err, "Couldn't load this booking."),
          status: typeof err?.status === "number" ? err.status : null,
        }));
      });
    return () => controller.abort();
  }, [bookingId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const setBooking = useCallback(
    (next: Booking) => {
      setState((prev) => {
        const { booking } = mergeBooking(prev.id === next.id ? prev.booking : null, next);
        return { id: next.id, booking, error: null, status: null };
      });
    },
    [],
  );

  useSocketEvent<{ booking: Booking }>("booking:updated", (payload) => {
    const next = payload?.booking;
    if (!next || next.id !== bookingId) return;
    const { stale } = mergeBooking(state.id === bookingId ? state.booking : null, next);
    setBooking(next);
    if (stale) reload();
  });

  // Catch up on anything missed while disconnected.
  useEffect(() => {
    if (!s) return;
    const onReconnect = () => reload();
    s.io.on("reconnect", onReconnect);
    return () => {
      s.io.off("reconnect", onReconnect);
    };
  }, [s, reload]);

  const current = bookingId && state.id === bookingId ? state : null;
  return {
    booking: current?.booking ?? null,
    setBooking,
    loading: Boolean(bookingId) && (!current || (!current.booking && !current.error)),
    error: current?.error ?? null,
    errorStatus: current?.status ?? null,
    reload,
  };
}

// ---------------------------------------------------------------------------
// Nurse location
// ---------------------------------------------------------------------------

export interface LiveLocation {
  lat: number;
  lng: number;
  at: string;
}

/**
 * Latest nurse position for a booking: live `nurse:location` events, seeded
 * from `booking.nurseLocation` until the first event arrives.
 */
export function useNurseLocation(
  bookingId: string | null | undefined,
  seed?: NurseLocation | null,
): LiveLocation | null {
  const [live, setLive] = useState<(LiveLocation & { bookingId: string }) | null>(null);
  useBookingRoom(bookingId);
  useSocketEvent<NurseLocationEvent>("nurse:location", (e) => {
    if (!e || e.bookingId !== bookingId) return;
    const at = typeof e.at === "number" ? new Date(e.at).toISOString() : e.at;
    setLive({ bookingId: e.bookingId, lat: e.lat, lng: e.lng, at: at ?? new Date().toISOString() });
  });

  if (live && live.bookingId === bookingId) {
    return { lat: live.lat, lng: live.lng, at: live.at };
  }
  if (seed && typeof seed.lat === "number" && typeof seed.lng === "number") {
    return { lat: seed.lat, lng: seed.lng, at: seed.updatedAt ?? "" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

type StreamKind = "ecg" | "steth";
type ChunkFor<K extends StreamKind> = K extends "ecg" ? EcgChunkEvent : StethChunkEvent;

/**
 * Calls `onChunk` for every live device chunk of a booking (`device:ecg` or
 * `device:steth`). The handler may change between renders without resubscribing.
 */
export function useDeviceStream<K extends StreamKind>(
  bookingId: string | null | undefined,
  kind: K,
  onChunk: (chunk: ChunkFor<K>) => void,
): void {
  useBookingRoom(bookingId);
  useSocketEvent<ChunkFor<K>>(kind === "ecg" ? "device:ecg" : "device:steth", (chunk) => {
    if (chunk && chunk.bookingId === bookingId) onChunk(chunk);
  });
}

export type DeviceStatusMap = Record<DeviceKind, DeviceState | "idle">;

/** Live pairing / streaming state for each device of a booking. */
export function useDeviceStatus(bookingId: string | null | undefined): DeviceStatusMap {
  const [state, setState] = useState<{ bookingId: string | null; map: DeviceStatusMap }>({
    bookingId: null,
    map: { ecg: "idle", stethoscope: "idle" },
  });
  useBookingRoom(bookingId);
  useSocketEvent<DeviceStatusEvent>("device:status", (e) => {
    if (!e || e.bookingId !== bookingId || !bookingId) return;
    setState((prev) => ({
      bookingId,
      map: {
        ...(prev.bookingId === bookingId ? prev.map : { ecg: "idle", stethoscope: "idle" }),
        [e.device]: e.state,
      },
    }));
  });
  return state.bookingId === bookingId ? state.map : { ecg: "idle", stethoscope: "idle" };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Shows a toast for every `notify` event. Mount once per shell. */
export function useNotifications(): void {
  const router = useRouter();
  const { user } = useAuth();
  useSocketEvent<NotifyEvent>("notify", (e) => {
    if (!e?.title) return;
    const bookingId = e.bookingId;
    toast(e.title, {
      description: e.body,
      action:
        bookingId && user
          ? { label: "View", onClick: () => router.push(bookingPathForRole(user.role, bookingId)) }
          : undefined,
    });
  });
}
