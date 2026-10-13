// Shared test helpers: tiny authed HTTP client, Supabase sign-in for staff and demo customers,
// a service-role client for cleanup, and booking fixtures.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Booking, User } from "../src/lib/types.ts";
import { addDays, todayIST } from "../src/server/time.ts";
import { BASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env.ts";

export const PASSWORD = "nivar123";
export const DEMO_OTP = "123456";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase test phone numbers (no SMS is sent, the OTP is always 123456). Nothing else can sign in. */
export const PHONES = {
  rahul: "9876543210",
  spare1: "9123400001",
  spare2: "9123400002",
} as const;

export const STAFF = {
  admin: "admin@nivar.health",
  priya: "priya@nivar.health",
  kavya: "kavya@nivar.health",
  meera: "meera@nivar.health",
  ananya: "ananya@nivar.health",
  vikram: "vikram@nivar.health",
} as const;

// ---- HTTP ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;
export interface Res {
  status: number;
  body: Json;
}

async function call(method: string, url: string, token: string | null, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: Json = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/** Tiny authed client: as(token).post(url, body) etc. Pass null for anonymous requests. */
export function as(token: string | null) {
  return {
    get: (url: string) => call("GET", url, token),
    post: (url: string, body: unknown = {}) => call("POST", url, token, body),
    put: (url: string, body: unknown = {}) => call("PUT", url, token, body),
    patch: (url: string, body: unknown = {}) => call("PATCH", url, token, body),
  };
}
export type Client = ReturnType<typeof as>;
export const anon = as(null);

// ---- Supabase clients ----

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let admin: SupabaseClient | null = null;
/** Service-role client, for cleanup and for resetting fixtures. Never used to exercise the API. */
export function serviceClient(): SupabaseClient {
  admin ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}

export interface Session {
  token: string;
  user: User;
}

/**
 * Refresh tokens by access token, so a realtime test client can hold a real Supabase session.
 * supabase-js prefers its own session over a hand-set realtime token, so a signed-out client
 * would join channels with the anon key.
 */
const refreshTokens = new Map<string, string>();
export const refreshTokenFor = (accessToken: string) => refreshTokens.get(accessToken);

async function me(token: string): Promise<User> {
  const res = await as(token).get("/api/auth/me");
  if (res.status !== 200) throw new Error(`GET /api/auth/me failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.user as User;
}

/** Sign a staff member in with email + password through Supabase Auth. */
export async function staffToken(email: string, password = PASSWORD): Promise<Session> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login ${email} failed: ${error?.message ?? "no session"}`);
  const token = data.session.access_token;
  refreshTokens.set(token, data.session.refresh_token);
  return { token, user: await me(token) };
}

/** Request an OTP through the API, then verify it with Supabase (test numbers only). */
export async function customerToken(phone: string): Promise<Session> {
  const req = await anon.post("/api/auth/otp/request", { phone });
  if (req.status !== 200) throw new Error(`otp request ${phone} failed: ${req.status} ${JSON.stringify(req.body)}`);
  const { data, error } = await anonClient().auth.verifyOtp({ phone: `+91${phone}`, token: DEMO_OTP, type: "sms" });
  if (error || !data.session) throw new Error(`otp verify ${phone} failed: ${error?.message ?? "no session"}`);
  const token = data.session.access_token;
  refreshTokens.set(token, data.session.refresh_token);
  return { token, user: await me(token) };
}

// ---- Service-role helpers ----

export async function findAuthUserByPhone(phone: string): Promise<{ id: string } | null> {
  const digits = `91${phone}`;
  const sb = serviceClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.phone ?? "").replace(/^\+/, "") === digits);
    if (hit) return { id: hit.id };
    if (data.users.length < 200) break;
  }
  return null;
}

export async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const sb = serviceClient();
  const wanted = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (hit) return { id: hit.id };
    if (data.users.length < 200) break;
  }
  return null;
}

/** Delete an auth user (and, via cascade or explicitly, its profile and bookings). */
export async function deleteAuthUser(id: string): Promise<void> {
  const sb = serviceClient();
  await sb.from("bookings").delete().eq("customer_id", id);
  await sb.from("profiles").delete().eq("id", id);
  const { error } = await sb.auth.admin.deleteUser(id);
  if (error && !/not found/i.test(error.message)) throw error;
}

export async function deleteBookings(ids: Iterable<string>): Promise<void> {
  const list = [...new Set(ids)];
  if (!list.length) return;
  const { error } = await serviceClient().from("bookings").delete().in("id", list);
  if (error) throw error;
}

/** Tracks bookings created by a test file so `after` can delete them with the service role. */
export class BookingTracker {
  ids = new Set<string>();
  track(id: string): string {
    this.ids.add(id);
    return id;
  }
  /** POST /api/bookings, assert 201 and remember the id. */
  async create(client: Client, body: unknown): Promise<Booking> {
    const res = await client.post("/api/bookings", body);
    if (res.status !== 201) throw new Error(`create booking failed: ${res.status} ${JSON.stringify(res.body)}`);
    const booking = res.body.booking as Booking;
    this.track(booking.id);
    return booking;
  }
  async cleanup(): Promise<void> {
    await deleteBookings(this.ids);
    this.ids.clear();
  }
}

// ---- Fixtures ----

export const daysFromToday = (n: number) => addDays(todayIST(), n);

export const sampleBooking = (overrides: Record<string, unknown> = {}) => ({
  patient: { name: "Rahul Mehta", age: 42, gender: "male", relation: "self" },
  address: {
    label: "Home",
    line1: "Flat 402, 100 Feet Road",
    area: "Indiranagar",
    city: "Bangalore",
    pincode: "560038",
    lat: 12.9784,
    lng: 77.6408,
  },
  serviceCodes: [] as string[],
  scheduledDate: daysFromToday(2),
  slot: "12:00-13:00",
  notes: "Mild headaches",
  ...overrides,
});

/** 10 seconds of a sine-ish "ECG" at 250 Hz (2500 samples), roughly `heartRate` beats per minute. */
export function fakeEcg(heartRate = 78, sampleRate = 250, seconds = 10): number[] {
  const period = (sampleRate * 60) / heartRate;
  return Array.from({ length: sampleRate * seconds }, (_, i) => {
    const phase = (i % period) / period;
    const spike = Math.exp(-Math.pow((phase - 0.5) * 30, 2));
    return Math.round((0.1 * Math.sin(2 * Math.PI * phase) + spike) * 1000) / 1000;
  });
}

export const statuses = (b: Booking) => b.timeline.map((t) => t.status);
