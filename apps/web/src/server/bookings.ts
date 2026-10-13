import "server-only";
import type { Booking, BookingStatus, GeoPoint, Role } from "@/lib/types";
import { STATUS_LABELS, assertTransition, canAccessBooking, customerNotice, defaultNote, idOf, roleLabel, type Via } from "./booking-status";
import { conflict, forbidden, notFound } from "./errors";
import { bookingToApi, type BookingRow, type ProfileRow } from "./mappers";
import { emitBookingUpdated, notifyAdmins, notifyUsers } from "./realtime";
import { supabaseAdmin } from "./supabase";

/** Select with customer, nurse and doctor embedded (public profile fields are picked in the mapper). */
export const BOOKING_SELECT =
  "*, customer:profiles!bookings_customer_id_fkey(*), nurse:profiles!bookings_nurse_id_fkey(*), doctor:profiles!bookings_doctor_id_fkey(*)";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Load a booking with people populated. Throws 404. */
export async function loadBooking(id: string): Promise<Booking> {
  if (!UUID.test(String(id))) throw notFound("Booking not found");
  const { data, error } = await supabaseAdmin().from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Booking not found");
  return bookingToApi(data as unknown as BookingRow);
}

/** Re-read the booking, broadcast it and return the JSON payload. */
export async function publishBooking(id: string): Promise<Booking> {
  const booking = await loadBooking(id);
  await emitBookingUpdated(booking);
  return booking;
}

type Actor = { id: string; role: Role; name?: string };

/** Column-level patch for a booking row (snake_case keys, JSON values). */
export type RowPatch = Partial<
  Pick<
    BookingRow,
    | "status"
    | "payment"
    | "nurse_id"
    | "doctor_id"
    | "nurse_location"
    | "vitals"
    | "ecg"
    | "stethoscope"
    | "report"
    | "rating"
    | "cancel_reason"
  >
>;

/**
 * Atomically move a booking from its current status to `to`.
 * Validates against the status machine, appends a timeline entry and applies `set`.
 * The update is conditional on the status not having changed since it was read (no lost updates).
 */
export async function transition(
  booking: Booking,
  to: BookingStatus,
  {
    actor,
    via,
    note,
    set = {},
    noteContext = {},
  }: {
    actor: Actor;
    via: Via;
    note?: string;
    set?: RowPatch;
    noteContext?: { nurse?: { name?: string } | null; doctor?: { name?: string } | null; method?: string };
  },
): Promise<void> {
  assertTransition({ booking, to, user: actor, via });
  const entry = {
    status: to,
    at: new Date().toISOString(),
    by: actor.name || roleLabel(actor.role),
    note: note?.trim() || defaultNote(to, { ...noteContext, actor }),
  };
  const { data, error } = await supabaseAdmin()
    .from("bookings")
    .update({ ...set, status: to, timeline: [...(booking.timeline ?? []), entry] })
    .eq("id", booking.id)
    .eq("status", booking.status)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw conflict("This booking was just updated by someone else. Please refresh and try again.", "stale");
}

/** Apply a patch only while the booking is in one of `statuses`; 409 `stale` otherwise. */
export async function guardedSet(booking: Booking, statuses: BookingStatus[], set: RowPatch, action: string): Promise<Booking> {
  const { data, error } = await supabaseAdmin()
    .from("bookings")
    .update(set)
    .eq("id", booking.id)
    .in("status", statuses)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw conflict(`${action} is no longer possible, the booking status changed`, "stale");
  return publishBooking(booking.id);
}

/** Send notifications appropriate for a status change; `booking` is the populated payload. */
export async function notifyStatusChange(status: BookingStatus, booking: Booking, actor: Actor): Promise<void> {
  const customerId = idOf(booking.customer);
  const notice = customerNotice(status, booking);
  const jobs: Promise<void>[] = [];
  if (notice && !(status === "cancelled" && actor.role === "customer")) {
    jobs.push(notifyUsers([customerId], { ...notice, bookingId: booking.id }));
  }
  const doctorId = idOf(booking.doctor);
  const nurseId = idOf(booking.nurse);
  if (status === "consult" && doctorId) {
    jobs.push(
      notifyUsers([doctorId], {
        title: "Patient ready for consult",
        body: `${booking.patient?.name} (${booking.code}) is ready. Join the video consult.`,
        bookingId: booking.id,
      }),
    );
  }
  if (status === "reporting" && nurseId && actor.role !== "nurse") {
    jobs.push(notifyUsers([nurseId], { title: "Consult ended", body: `${booking.code}: the doctor is preparing the report.`, bookingId: booking.id }));
  }
  if (status === "cancelled") {
    jobs.push(notifyUsers([nurseId, doctorId], { title: "Visit cancelled", body: `${booking.code} for ${booking.patient?.name} was cancelled.`, bookingId: booking.id }));
    if (actor.role === "customer") {
      jobs.push(notifyAdmins({ title: "Booking cancelled", body: `${booking.code} was cancelled by the customer.`, bookingId: booking.id }));
    }
  }
  await Promise.all(jobs);
}

/** Shared cancel logic for POST /cancel and POST /status { status: "cancelled" }. */
export async function cancelBooking(bookingId: string, actor: Actor, reason?: string): Promise<Booking> {
  const booking = await loadBooking(bookingId);
  const set: RowPatch = {};
  const trimmed = reason?.trim();
  if (trimmed) set.cancel_reason = trimmed;
  if (booking.payment?.status === "paid") set.payment = { ...booking.payment, status: "refunded" };
  const note = trimmed ? `${defaultNote("cancelled", { actor })}: ${trimmed}` : undefined;
  await transition(booking, "cancelled", { actor, via: "cancel", note, set });
  const payload = await publishBooking(booking.id);
  await notifyStatusChange("cancelled", payload, actor);
  return payload;
}

// ---------------------------------------------------------------------------
// Shared helpers for the /api/bookings route handlers
// ---------------------------------------------------------------------------

export const SERVICE_CODES = ["BP", "ECG", "SUGAR", "HR", "SPO2", "STETH", "CONSULT"] as const;
export const RELATIONS = ["self", "parent", "spouse", "child", "other"] as const;
export const PAYMENT_METHODS = ["upi", "card", "netbanking", "cash"] as const;

/** Load a booking and ensure `user` may see it (403 `not_assigned` otherwise). */
export async function loadForUser(user: Actor, id: string): Promise<Booking> {
  const booking = await loadBooking(id);
  if (!canAccessBooking(user, booking)) throw forbidden("You do not have access to this booking", "not_assigned");
  return booking;
}

/** The actor must be the nurse or doctor assigned to the booking. */
export function assertAssigned(booking: Booking, user: Actor, role: "nurse" | "doctor"): void {
  const ref = role === "nurse" ? booking.nurse : booking.doctor;
  if (user.role !== role || idOf(ref) !== user.id) {
    throw forbidden(`Only the assigned ${role} can do this`, "not_assigned");
  }
}

/** 409 `invalid_state` unless the booking is in one of `statuses`. */
export function assertStatusIn(booking: Booking, statuses: BookingStatus[], what: string): void {
  if (!statuses.includes(booking.status)) {
    throw conflict(
      `${what} is only possible while the booking is ${statuses.map((s) => STATUS_LABELS[s].toLowerCase()).join(", ")} (currently ${STATUS_LABELS[booking.status].toLowerCase()})`,
      "invalid_state",
    );
  }
}

/** Fetch an active staff member of a given role, or null. */
export async function findActiveStaff(id: string, role: "nurse" | "doctor"): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", role)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export interface ListFilter {
  customerId?: string;
  nurseId?: string;
  doctorId?: string;
  statuses?: BookingStatus[] | null;
  date?: string;
}

/** List bookings with people populated, sorted by scheduled_date, slot, created_at. Lite payloads by default. */
export async function findBookings(filter: ListFilter, { lite = true } = {}): Promise<Booking[]> {
  let q = supabaseAdmin().from("bookings").select(BOOKING_SELECT);
  if (filter.customerId) q = q.eq("customer_id", filter.customerId);
  if (filter.nurseId) q = q.eq("nurse_id", filter.nurseId);
  if (filter.doctorId) q = q.eq("doctor_id", filter.doctorId);
  if (filter.statuses) q = q.in("status", filter.statuses);
  if (filter.date) q = q.eq("scheduled_date", filter.date);
  const { data, error } = await q
    .order("scheduled_date", { ascending: true })
    .order("slot", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as BookingRow[]).map((row) => bookingToApi(row, { lite }));
}

// Bangalore neighbourhood centroids (real coordinates), used as a geocode fallback for addresses
// that arrive without coordinates.
export const BANGALORE_CENTER: GeoPoint = { lat: 12.9716, lng: 77.5946 };

export const AREAS: Record<string, GeoPoint & { pincode: string }> = {
  Indiranagar: { lat: 12.9719, lng: 77.6412, pincode: "560038" },
  Koramangala: { lat: 12.9352, lng: 77.6245, pincode: "560034" },
  "HSR Layout": { lat: 12.9116, lng: 77.6474, pincode: "560102" },
  Whitefield: { lat: 12.9698, lng: 77.75, pincode: "560066" },
  Jayanagar: { lat: 12.9308, lng: 77.5838, pincode: "560041" },
  "JP Nagar": { lat: 12.9063, lng: 77.5857, pincode: "560078" },
  Malleshwaram: { lat: 13.0035, lng: 77.571, pincode: "560003" },
  "BTM Layout": { lat: 12.9166, lng: 77.6101, pincode: "560076" },
  Bellandur: { lat: 12.9257, lng: 77.6764, pincode: "560103" },
  Hebbal: { lat: 13.0358, lng: 77.597, pincode: "560024" },
};

const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

/** Best-effort centroid for an area name, falling back to the city centre. */
export function areaCentroid(area: unknown): GeoPoint {
  const a = norm(area);
  const key = Object.keys(AREAS).find((k) => norm(k) === a || (a && a.includes(norm(k))));
  return key ? { lat: AREAS[key].lat, lng: AREAS[key].lng } : { ...BANGALORE_CENTER };
}
