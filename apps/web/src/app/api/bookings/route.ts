import crypto from "node:crypto";
import { z } from "zod";
import type { BookingStatus } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { ACTIVE_STATUSES, BOOKING_STATUSES, PAST_STATUSES } from "@/server/booking-status";
import { BOOKING_SELECT, RELATIONS, SERVICE_CODES, areaCentroid, findBookings, type ListFilter } from "@/server/bookings";
import { badRequest, conflict, json } from "@/server/errors";
import { bookingToApi, type BookingRow, type PackageRow, type ServiceRow } from "@/server/mappers";
import { emitBookingUpdated } from "@/server/realtime";
import { supabaseAdmin } from "@/server/supabase";
import { EXPRESS_SLOT, addDays, isSlotPast, todayIST } from "@/server/time";
import { addressInputSchema, dateSchema, genderSchema, parseBody, parseQuery, slotSchema } from "@/server/validate";

const MAX_ADVANCE_DAYS = 60;
const SLOT_CAPACITY = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- create ----------

const createSchema = z
  .object({
    patient: z.object({
      name: z.string().trim().min(1, "Patient name is required").max(80),
      age: z.coerce.number().int().min(0).max(120),
      gender: genderSchema,
      relation: z.enum(RELATIONS).optional().default("self"),
    }),
    address: addressInputSchema,
    packageId: z.string().trim().min(1).max(64).optional().nullable(),
    serviceCodes: z.array(z.enum(SERVICE_CODES)).optional().default([]),
    scheduledDate: dateSchema,
    slot: slotSchema,
    notes: z.string().trim().max(2000).optional().default(""),
  })
  .refine((b) => b.packageId || b.serviceCodes.length > 0, { message: "Choose a package or at least one test", path: ["serviceCodes"] });

export const POST = withAuth(
  async (req, { user }) => {
    const body = await parseBody(req, createSchema);
    const sb = supabaseAdmin();
    const today = todayIST();
    if (body.scheduledDate < today) throw badRequest("Pick today or a future date", "past_date");
    if (body.scheduledDate > addDays(today, MAX_ADVANCE_DAYS)) throw badRequest(`Bookings open up to ${MAX_ADVANCE_DAYS} days ahead`, "too_far");
    if (body.slot === EXPRESS_SLOT) {
      if (body.scheduledDate !== today) throw badRequest("Express visits are only available for today", "express_today_only");
    } else {
      if (isSlotPast(body.scheduledDate, body.slot)) throw conflict("That slot has already started, please pick a later one", "slot_unavailable");
      const { count, error } = await sb
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("scheduled_date", body.scheduledDate)
        .eq("slot", body.slot)
        .neq("status", "cancelled");
      if (error) throw error;
      if ((count ?? 0) >= SLOT_CAPACITY) throw conflict("That slot just filled up, please pick another", "slot_unavailable");
    }

    const { data: services, error: servicesError } = await sb.from("services").select("code, price");
    if (servicesError) throw servicesError;
    const priceOf: Record<string, number> = Object.fromEntries(((services ?? []) as Pick<ServiceRow, "code" | "price">[]).map((s) => [s.code, s.price]));

    let pkg: PackageRow | null = null;
    if (body.packageId) {
      // Accept the id or the slug (the landing page links by slug when the catalogue was unreachable).
      const column = UUID.test(body.packageId) ? "id" : "slug";
      const { data, error } = await sb.from("packages").select("*").eq(column, body.packageId).eq("is_active", true).maybeSingle();
      if (error) throw error;
      pkg = (data as PackageRow | null) ?? null;
      if (!pkg) throw badRequest("That package is no longer available. Please pick it again.", "invalid_package");
    }
    const codes = [...new Set([...(pkg?.service_codes || []), ...body.serviceCodes])].filter((c) => c in priceOf);
    if (!codes.length) throw badRequest("Choose at least one test", "no_tests");
    // Package price covers its tests; any extra tests are added at list price.
    const extras = codes.filter((c) => !pkg?.service_codes.includes(c));
    const amount = (pkg?.price || 0) + extras.reduce((sum, c) => sum + priceOf[c], 0);

    const { id: addressId, ...addr } = body.address;
    const coords = typeof addr.lat === "number" && typeof addr.lng === "number" ? { lat: addr.lat, lng: addr.lng } : areaCentroid(addr.area);

    const { data: created, error: insertError } = await sb
      .from("bookings")
      .insert({
        customer_id: user.id,
        patient: body.patient,
        address: { ...addr, ...coords, id: addressId || crypto.randomUUID() },
        package_id: pkg?.id ?? null,
        service_codes: SERVICE_CODES.filter((c) => codes.includes(c)),
        scheduled_date: body.scheduledDate,
        slot: body.slot,
        amount,
        notes: body.notes,
        status: "pending_payment",
        payment: { status: "pending" },
        timeline: [{ status: "pending_payment", at: new Date().toISOString(), by: user.name || "Customer", note: "Booking placed" }],
      })
      .select(BOOKING_SELECT)
      .single();
    if (insertError) throw insertError;
    const payload = bookingToApi(created as unknown as BookingRow);
    await emitBookingUpdated(payload);
    return json({ booking: payload }, 201);
  },
  { roles: ["customer"] },
);

// ---------- list ----------

const listSchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []))
    .refine((arr) => arr.every((s) => (BOOKING_STATUSES as string[]).includes(s)), "Unknown status"),
  date: dateSchema.optional(),
  scope: z.enum(["active", "past"]).optional(),
});

export const GET = withAuth(async (req, { user }) => {
  const { status, date, scope } = parseQuery(req, listSchema);
  const filter: ListFilter = {};
  if (user.role === "customer") filter.customerId = user.id;
  else if (user.role === "nurse") filter.nurseId = user.id;
  else if (user.role === "doctor") filter.doctorId = user.id;

  let statuses: BookingStatus[] | null = status.length ? (status as BookingStatus[]) : null;
  if (scope) {
    const scoped = scope === "active" ? ACTIVE_STATUSES : PAST_STATUSES;
    statuses = statuses ? statuses.filter((s) => scoped.includes(s)) : scoped;
  }
  if (statuses) filter.statuses = statuses;
  if (date) filter.date = date;

  const bookings = await findBookings(filter);
  return json({ bookings });
});
