import "server-only";
import { z } from "zod";
import type { StaffMember } from "@/lib/types";
import { STAFF_ACTIVE_STATUSES } from "@/server/booking-status";
import { SERVICE_CODES } from "@/server/bookings";
import { HttpError } from "@/server/errors";
import { profileToUser, type ProfileRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";
import { phoneSchema } from "@/server/validate";

export const STAFF_ROLES = ["nurse", "doctor", "admin"] as const;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const staffFields = {
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: z.enum(STAFF_ROLES),
  phone: phoneSchema.optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  specialization: z.string().trim().max(120).optional(),
  qualifications: z.string().trim().max(200).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  registrationNo: z.string().trim().max(60).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  baseLocation: z.object({ lat: z.number(), lng: z.number(), label: z.string().trim().max(80).optional() }).optional(),
};

type StaffInput = Partial<z.output<z.ZodObject<typeof staffFields>>> & { isActive?: boolean };

/** camelCase staff input -> profiles columns (only the keys that were sent). */
export function staffPatch(data: StaffInput): Partial<ProfileRow> {
  const map: Record<string, keyof ProfileRow> = {
    name: "name",
    email: "email",
    role: "role",
    phone: "phone",
    gender: "gender",
    specialization: "specialization",
    qualifications: "qualifications",
    yearsExperience: "years_experience",
    registrationNo: "registration_no",
    avatarUrl: "avatar_url",
    baseLocation: "base_location",
    isActive: "is_active",
  };
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "password" || v === undefined || !(k in map)) continue;
    patch[map[k]] = v;
  }
  return patch as Partial<ProfileRow>;
}

/** Attach `activeBookings` (visits the staff member is committed to) to each profile. */
export async function withActiveCounts(rows: ProfileRow[]): Promise<StaffMember[]> {
  const counts: Record<string, number> = {};
  if (rows.length) {
    const { data, error } = await supabaseAdmin().from("bookings").select("nurse_id, doctor_id").in("status", STAFF_ACTIVE_STATUSES);
    if (error) throw error;
    for (const b of (data ?? []) as { nurse_id: string | null; doctor_id: string | null }[]) {
      for (const id of [b.nurse_id, b.doctor_id]) if (id) counts[id] = (counts[id] || 0) + 1;
    }
  }
  return rows.map((r) => ({ ...profileToUser(r), activeBookings: counts[r.id] || 0 }));
}

export const packageFields = {
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Slug may contain a-z, 0-9 and dashes").max(80),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  serviceCodes: z.array(z.enum(SERVICE_CODES)).min(1, "Add at least one test"),
  price: z.number().min(0),
  mrp: z.number().min(0),
  popular: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
};

/** camelCase package input -> packages columns (only the keys that were sent). */
export function packagePatch(data: Partial<z.output<z.ZodObject<typeof packageFields>>>): Record<string, unknown> {
  const map: Record<string, string> = {
    slug: "slug",
    name: "name",
    tagline: "tagline",
    description: "description",
    serviceCodes: "service_codes",
    price: "price",
    mrp: "mrp",
    popular: "popular",
    isActive: "is_active",
    sortOrder: "sort_order",
  };
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined && k in map) patch[map[k]] = v;
  return patch;
}

/**
 * Map a Postgres unique violation (or Supabase Auth's "already registered") to the 409 `duplicate`
 * error the old API produced; anything else is rethrown.
 */
export function rethrowDuplicate(err: unknown, field: string): never {
  const e = err as { code?: string | number; status?: number; message?: string } | null;
  const unique = e?.code === "23505" || e?.code === "email_exists" || e?.code === "phone_exists";
  const authDup = e?.status === 422 && /already|exists|registered/i.test(e?.message ?? "");
  if (unique || authDup) throw new HttpError(409, `That ${field} is already in use`, "duplicate");
  throw err;
}
