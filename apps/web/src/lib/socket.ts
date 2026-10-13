"use client";

// Realtime layer on Supabase Realtime Broadcast (spec section 4).
//
// Topics (private channels, authorised by RLS on realtime.messages):
//   booking:<id>  participants and admins: booking:updated, nurse:location, device:*, rtc:*
//   user:<uid>    that user: booking:updated, notify
//   admin         admins: booking:updated, notify
//
// Every hook keeps the signature it had on Socket.io. Internally one Supabase client
// holds the channels; `emit(event, payload)` broadcasts on `booking:<payload.bookingId>`.

import { useCallback, useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { bookingPathForRole, useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type {
  Booking,
  DeviceKind,
  DeviceState,
  DeviceStatusEvent,
  EcgChunkEvent,
  NotifyEvent,
  NurseLocation,
  NurseLocationEvent,
  Role,
  StethChunkEvent,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Channel manager (module singleton)
// ---------------------------------------------------------------------------

type TopicStatus = "joining" | "subscribed" | "closed" | "error";

interface Identity {
  uid: string;
  role: Role;
  token: string;
}

interface Entry {
  topic: string;
  channel: RealtimeChannel;
  status: TopicStatus;
  /** Set once the channel has been subscribed, so a later SUBSCRIBED is a resubscribe. */
  everSubscribed: boolean;
}

type EventHandler = (payload: unknown, topic: string) => void;
/** Where a handler listens: the user and admin channels, every booking channel, or one topic. */
type Scope = "user" | "booking" | { topic: string };

interface Binding {
  event: string;
  scope: Scope;
  handler: EventHandler;
}

const USER_EVENTS = new Set(["booking:updated", "notify"]);

const topics = {
  user: (uid: string) => `user:${uid}`,
  booking: (id: string) => `booking:${id}`,
  admin: "admin",
};

let identity: Identity | null = null;
const entries = new Map<string, Entry>();
const bindings = new Set<Binding>();
/** Booking rooms this tab wants to be in, ref-counted across hooks. */
const bookingRooms = new Map<string, number>();

/** Re-render trigger for hooks reading connection or topic state. */
let version = 0;
const storeListeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();
const topicListeners = new Map<string, Set<(status: TopicStatus) => void>>();

function bump() {
  version += 1;
  storeListeners.forEach((l) => l());
}

function subscribeStore(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

function scopeMatches(scope: Scope, topic: string): boolean {
  if (scope === "user") return topic.startsWith("user:") || topic === topics.admin;
  if (scope === "booking") return topic.startsWith("booking:");
  return scope.topic === topic;
}

function dispatch(topic: string, event: string, payload: unknown) {
  bindings.forEach((b) => {
    if (b.event === event && scopeMatches(b.scope, topic)) {
      try {
        b.handler(payload, topic);
      } catch (err) {
        console.warn(`[realtime] handler for ${event} failed`, err);
      }
    }
  });
}

function setTopicStatus(entry: Entry, status: TopicStatus) {
  const resubscribed = status === "subscribed" && entry.everSubscribed && entry.status !== "subscribed";
  entry.status = status;
  if (status === "subscribed") entry.everSubscribed = true;
  topicListeners.get(entry.topic)?.forEach((l) => l(status));
  // The user channel is always joined while signed in, so it stands for "the connection".
  if (resubscribed && identity && entry.topic === topics.user(identity.uid)) {
    reconnectListeners.forEach((l) => l());
  }
  bump();
}

function openTopic(topic: string) {
  if (!identity || entries.has(topic)) return;
  const supabase = getSupabase();
  const channel = supabase.channel(topic, {
    config: { private: true, broadcast: { self: false, ack: false } },
  });
  const entry: Entry = { topic, channel, status: "joining", everSubscribed: false };
  entries.set(topic, entry);
  channel.on("broadcast", { event: "*" }, (message) => {
    dispatch(topic, String(message.event), message.payload);
  });
  const token = identity.token;
  // The channel join carries the access token so the RLS policies see auth.uid().
  void supabase.realtime
    .setAuth(token)
    .catch(() => {})
    .then(() => {
      if (entries.get(topic) !== entry) return; // closed meanwhile
      channel.subscribe((status, err) => {
        if (entries.get(topic) !== entry) return;
        if (status === "SUBSCRIBED") setTopicStatus(entry, "subscribed");
        else if (status === "CLOSED") setTopicStatus(entry, "closed");
        else {
          if (err) console.warn(`[realtime] ${topic}: ${status}`, err.message);
          setTopicStatus(entry, "error");
        }
      });
    });
  bump();
}

function closeTopic(topic: string) {
  const entry = entries.get(topic);
  if (!entry) return;
  entries.delete(topic);
  void getSupabase()
    .removeChannel(entry.channel)
    .catch(() => {});
  bump();
}

function wantedTopics(id: Identity): string[] {
  const list = [topics.user(id.uid)];
  if (id.role === "admin") list.push(topics.admin);
  bookingRooms.forEach((_count, bookingId) => list.push(topics.booking(bookingId)));
  return list;
}

function reconcile() {
  const wanted = new Set(identity ? wantedTopics(identity) : []);
  [...entries.keys()].forEach((topic) => {
    if (!wanted.has(topic)) closeTopic(topic);
  });
  wanted.forEach(openTopic);
}

/**
 * Called by hooks with the signed-in user. A different user (or sign out) tears every
 * channel down and rebuilds the wanted set; a refreshed token is pushed to the socket.
 */
function setIdentity(next: Identity | null) {
  if (identity && next && identity.uid === next.uid && identity.role === next.role) {
    if (identity.token !== next.token) {
      identity = next;
      void getSupabase()
        .realtime.setAuth(next.token)
        .catch(() => {});
    }
    return;
  }
  if (!identity && !next) return;
  identity = next;
  [...entries.keys()].forEach(closeTopic);
  reconcile();
}

function retainBookingRoom(bookingId: string) {
  const count = bookingRooms.get(bookingId) ?? 0;
  bookingRooms.set(bookingId, count + 1);
  if (count === 0) reconcile();
}

function releaseBookingRoom(bookingId: string) {
  const count = bookingRooms.get(bookingId) ?? 0;
  if (count <= 1) {
    bookingRooms.delete(bookingId);
    reconcile();
  } else {
    bookingRooms.set(bookingId, count - 1);
  }
}

function addBinding(event: string, scope: Scope, handler: EventHandler): () => void {
  const binding: Binding = { event, scope, handler };
  bindings.add(binding);
  return () => {
    bindings.delete(binding);
  };
}

function onTopicStatus(topic: string, listener: (status: TopicStatus) => void): () => void {
  const set = topicListeners.get(topic) ?? new Set<(status: TopicStatus) => void>();
  topicListeners.set(topic, set);
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) topicListeners.delete(topic);
  };
}

function topicStatus(topic: string): TopicStatus | null {
  return entries.get(topic)?.status ?? null;
}

function isConnected(): boolean {
  return identity !== null && topicStatus(topics.user(identity.uid)) === "subscribed";
}

function broadcast(topic: string, event: string, payload: unknown): boolean {
  const entry = entries.get(topic);
  if (!entry) return false;
  void entry.channel.send({ type: "broadcast", event, payload }).catch(() => {});
  return entry.status === "subscribed";
}

/** Keeps the channel manager in sync with the signed-in user. Called by every hook. */
function useRealtimeIdentity(): Identity | null {
  const { user, token } = useAuth();
  const next = useMemo<Identity | null>(
    () => (user && token ? { uid: user.id, role: user.role, token } : null),
    [user, token],
  );
  useEffect(() => {
    setIdentity(next);
  }, [next]);
  return next;
}

// ---------------------------------------------------------------------------
// Public API (same names as the Socket.io version)
// ---------------------------------------------------------------------------

/** Thin stand-in for the old socket instance. */
export interface RealtimeHandle {
  /** Whether the realtime connection is currently up. */
  readonly connected: boolean;
  /** Fire-and-forget broadcast on `booking:<payload.bookingId>`. */
  emit: (event: string, payload: { bookingId: string } & Record<string, unknown>) => boolean;
  /** Listen to an event; returns the unsubscribe function. */
  on: (event: string, handler: (payload: unknown) => void) => () => void;
}

let handleVersion = -1;
let handle: RealtimeHandle | null = null;

function currentHandle(): RealtimeHandle | null {
  if (!identity) return null;
  if (handleVersion !== version || !handle) {
    handleVersion = version;
    handle = {
      connected: isConnected(),
      emit: (event, payload) => emit(event, payload),
      on: (event, handler) => addBinding(event, USER_EVENTS.has(event) ? "user" : "booking", handler),
    };
  }
  return handle;
}

/** The current realtime handle, or null during SSR and when signed out. */
export function getSocket(): RealtimeHandle | null {
  if (typeof window === "undefined") return null;
  return currentHandle();
}

/**
 * Fire-and-forget broadcast on the booking channel of `payload.bookingId`.
 * Returns false when not joined to that booking (or signed out).
 */
export function emit(event: string, payload: unknown): boolean {
  if (typeof window === "undefined" || !identity) return false;
  const bookingId = (payload as { bookingId?: unknown } | null)?.bookingId;
  if (typeof bookingId !== "string" || !bookingId) return false;
  return broadcast(topics.booking(bookingId), event, payload);
}

/** React access to the realtime handle. Null during SSR and when signed out. */
export function useSocket(): RealtimeHandle | null {
  useRealtimeIdentity();
  return useSyncExternalStore(subscribeStore, currentHandle, () => null);
}

/** Whether the realtime connection is currently up. */
export function useSocketConnected(): boolean {
  useRealtimeIdentity();
  return useSyncExternalStore(subscribeStore, isConnected, () => false);
}

/**
 * Runs `fn` after the realtime connection comes back (the user channel resubscribes),
 * so a long-open screen can catch up on anything it missed.
 */
export function useOnReconnect(fn: () => void): void {
  useRealtimeIdentity();
  const run = useEffectEvent(fn);
  useEffect(() => {
    const listener = () => run();
    reconnectListeners.add(listener);
    return () => {
      reconnectListeners.delete(listener);
    };
  }, []);
}

/**
 * Subscribes `handler` to a realtime event for the lifetime of the component.
 * `booking:updated` and `notify` arrive on the user channel (and `admin` for admins);
 * booking-scoped events arrive from every booking channel this tab has joined.
 */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void): void {
  useRealtimeIdentity();
  const onEvent = useEffectEvent(handler);
  useEffect(
    () => addBinding(event, USER_EVENTS.has(event) ? "user" : "booking", (payload) => onEvent(payload as T)),
    [event],
  );
}

/**
 * Keeps this tab joined to `booking:<id>` while mounted (re-joins on reconnect,
 * leaves on unmount). Safe to call from several components for the same booking.
 */
export function useBookingRoom(bookingId: string | null | undefined): void {
  const id = useRealtimeIdentity();
  useEffect(() => {
    if (!id || !bookingId) return;
    retainBookingRoom(bookingId);
    return () => releaseBookingRoom(bookingId);
  }, [id, bookingId]);
}

/** Resolves once `topic` is subscribed (immediately if it already is). */
function whenSubscribed(topic: string): Promise<void> {
  if (topicStatus(topic) === "subscribed") return Promise.resolve();
  return new Promise((resolve) => {
    const off = onTopicStatus(topic, (status) => {
      if (status === "subscribed") {
        off();
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// WebRTC signalling (spec section 4)
// ---------------------------------------------------------------------------

/**
 * Transport for the consult video call. Events travel on the booking channel:
 *   rtc:join      { bookingId, peerId, name, role }         joiner announces itself
 *   rtc:peer-here { bookingId, to, peerId, name, role }     each peer already in the call replies
 *   rtc:signal    { bookingId, to, from, data }             SDP, ICE and media state
 *   rtc:leave     { bookingId, peerId }
 * Receivers ignore messages not addressed to them. The sender never receives its own broadcasts.
 */
export interface Signalling {
  /** Random id for this tab's participant. */
  peerId: string;
  on(event: string, handler: (payload: unknown) => void): () => void;
  send(event: string, payload: { bookingId: string } & Record<string, unknown>): void;
  /** Joins the booking channel and resolves once subscribed. */
  join(bookingId: string): Promise<void>;
  leave(bookingId: string): void;
  /** Fires with the booking channel state; a `true` after a `false` means the call should rejoin. */
  onConnectionChange(cb: (connected: boolean) => void): () => void;
}

function newPeerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSignalling(): Signalling {
  const joined = new Set<string>();
  const connectionListeners = new Set<(connected: boolean) => void>();
  const statusUnsubs = new Map<string, () => void>();

  const connected = () => joined.size > 0 && [...joined].every((id) => topicStatus(topics.booking(id)) === "subscribed");
  const notify = () => {
    const c = connected();
    connectionListeners.forEach((l) => l(c));
  };

  return {
    peerId: newPeerId(),
    on: (event, handler) => addBinding(event, "booking", (payload) => handler(payload)),
    send: (event, payload) => {
      emit(event, payload);
    },
    join: (bookingId) => {
      if (!joined.has(bookingId)) {
        joined.add(bookingId);
        retainBookingRoom(bookingId);
        statusUnsubs.set(bookingId, onTopicStatus(topics.booking(bookingId), notify));
      }
      return whenSubscribed(topics.booking(bookingId));
    },
    leave: (bookingId) => {
      if (!joined.delete(bookingId)) return;
      statusUnsubs.get(bookingId)?.();
      statusUnsubs.delete(bookingId);
      releaseBookingRoom(bookingId);
    },
    onConnectionChange: (cb) => {
      connectionListeners.add(cb);
      return () => {
        connectionListeners.delete(cb);
      };
    },
  };
}

/** A signalling adapter bound to the current session (stable per sign in). Null when signed out. */
export function useSignalling(): Signalling | null {
  const id = useRealtimeIdentity();
  const uid = id?.uid ?? null;
  return useMemo(() => (uid ? createSignalling() : null), [uid]);
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/**
 * Broadcast payloads may carry bare ids for customer / nurse / doctor. Keep the
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
 * Loads GET /bookings/:id, joins the booking channel and keeps the booking live
 * via `booking:updated`. Refetches after the channel resubscribes to catch up.
 */
export function useBooking(bookingId: string | null | undefined): UseBookingResult {
  const [state, setState] = useState<BookingState>({
    id: null,
    booking: null,
    error: null,
    status: null,
  });
  const [nonce, setNonce] = useState(0);

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

  // Live updates from the booking channel itself (the user channel copy is for lists).
  const onUpdated = useEffectEvent((payload: { booking: Booking }) => {
    const next = payload?.booking;
    if (!next || next.id !== bookingId) return;
    const { stale } = mergeBooking(state.id === bookingId ? state.booking : null, next);
    setBooking(next);
    if (stale) reload();
  });
  useEffect(() => {
    if (!bookingId) return;
    return addBinding("booking:updated", { topic: topics.booking(bookingId) }, (payload) =>
      onUpdated(payload as { booking: Booking }),
    );
  }, [bookingId]);

  // Catch up on anything missed while the channel was down.
  useEffect(() => {
    if (!bookingId) return;
    let wasDown = false;
    return onTopicStatus(topics.booking(bookingId), (status) => {
      if (status === "closed" || status === "error") {
        wasDown = true;
      } else if (status === "subscribed" && wasDown) {
        wasDown = false;
        reload();
      }
    });
  }, [bookingId, reload]);

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
