import "server-only";
import type { Booking, BookingStatus, Role } from "@/lib/types";
import { assertTransition, customerNotice, defaultNote, idOf, roleLabel, type Via } from "./booking-status";
import { conflict, notFound } from "./errors";
import { bookingToApi, type BookingRow } from "./mappers";
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
