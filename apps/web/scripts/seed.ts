// Idempotent seed for the Supabase project (migration spec section 6, MVP spec section 8).
//   pnpm --filter web seed      (reads apps/web/.env.local)
//
// Catalogue rows are upserted (services by code, packages by slug with a uuid v5 id), demo users are
// found by email or phone and reused so their ids never change, and bookings and leads are deleted
// and regenerated. The generated data is deterministic (seeded PRNG) apart from "now".
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient, type User as AuthUser } from "@supabase/supabase-js";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import type { Address, BookingStatus, Gender, Patient, PaymentMethod, Role, ServiceCode, SugarType } from "../src/lib/types";
import { DEMO_OTP, DEMO_PASSWORD } from "../src/server/demo";
import { SLOTS, addDays, istDateTime, istParts, slotStartMinutes } from "../src/server/time";
import {
  ADMIN,
  CUSTOMERS,
  DOCTORS,
  LEADS,
  NURSES,
  PACKAGES,
  RAHUL,
  RATING_COMMENTS,
  REPORTS,
  SERVICES,
  SYMPTOM_NOTES,
  type ClinicalProfile,
  type ReportTemplate,
  type SeedCustomer,
  type SeedStaff,
} from "./seed/data";
import { generateEcg, generateStethEnvelope } from "./seed/ecg";
import { createRng } from "./seed/random";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const CHUNK = 20;

/** Fixed namespace for stable ids derived from natural keys (package slugs, seed addresses). */
const NIVAR_NAMESPACE = "6f2b9c1e-3d5a-4f0e-9b7c-2a1d8e4f6c03";
const stableId = (key: string) => uuidv5(key, NIVAR_NAMESPACE);

const r1 = (v: number) => Math.round(v * 10) / 10;
const iso = (d: Date) => d.toISOString();

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to apps/web/.env.local (see .env.example).`);
  return v;
}

// ---------------------------------------------------------------------------
// Row shapes (snake_case, as inserted)
// ---------------------------------------------------------------------------
interface ProfileUpsert {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  gender: Gender | null;
  dob: string | null;
  addresses: Address[];
  specialization: string | null;
  qualifications: string | null;
  years_experience: number | null;
  registration_no: string | null;
  base_location: { lat: number; lng: number; label: string } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SeededUser {
  id: string;
  name: string;
  role: Role;
}

interface SeededCustomer extends SeededUser {
  phone: string;
  gender: Gender;
  dob: Date | null;
  addresses: Address[];
}

interface SeededPackage {
  id: string;
  slug: string;
  serviceCodes: ServiceCode[];
  price: number;
}

interface TimelineRow {
  status: BookingStatus;
  at: string;
  by: string;
  note: string;
}

interface Vitals {
  recordedAt: string;
  temperatureF?: number;
  weightKg?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  sugarType?: SugarType;
  sugar?: number;
  heartRate: number;
  spo2?: number;
}

interface BookingDoc {
  id: string;
  code?: string;
  customer_id: string;
  patient: Patient;
  address: Address;
  package_id: string | null;
  service_codes: ServiceCode[];
  scheduled_date: string;
  slot: string;
  amount: number;
  payment: { status: "pending" | "paid" | "refunded"; method?: PaymentMethod; txnId?: string; paidAt?: string };
  status: BookingStatus;
  nurse_id: string | null;
  doctor_id: string | null;
  timeline: TimelineRow[];
  nurse_location: { lat: number; lng: number; updatedAt: string } | null;
  vitals: Vitals | null;
  ecg: { samples: number[]; sampleRate: number; heartRate: number; rhythm: string; interpretation: string; capturedAt: string } | null;
  stethoscope: { heartRate: number; findings: string; samples: number[]; capturedAt: string } | null;
  report: ReportTemplate & { publishedAt: string } | null;
  rating: { score: number; comment: string; ratedAt: string } | null;
  notes: string;
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fail(context: string, error: unknown): never {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  throw new Error(`${context}: ${msg}`);
}

async function insertChunked(sb: SupabaseClient, table: string, rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) fail(`insert ${table}`, error);
  }
}

/** PostgREST refuses an unfiltered delete; every row has a created_at so this matches them all. */
async function deleteAll(sb: SupabaseClient, table: string): Promise<void> {
  const { error } = await sb.from(table).delete().gte("created_at", "1970-01-01");
  if (error) fail(`delete ${table}`, error);
}

/** Find an existing auth user by email or phone by paging through auth.admin.listUsers. */
async function findAuthUser(sb: SupabaseClient, match: { email?: string; phone?: string }): Promise<AuthUser | null> {
  const email = match.email?.toLowerCase();
  const phone = match.phone?.replace(/^\+/, "");
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail("auth.admin.listUsers", error);
    const hit = data.users.find((u) => (email && u.email?.toLowerCase() === email) || (phone && u.phone === phone));
    if (hit) return hit;
    if (!data.nextPage) return null;
  }
}

/**
 * Resolve the auth user id for a demo account: the existing profile (by email or phone), else an
 * existing auth user, else a freshly created one. Ids therefore survive reseeds.
 */
async function ensureAuthUser(
  sb: SupabaseClient,
  profilesByEmail: Map<string, string>,
  profilesByPhone: Map<string, string>,
  spec: { email?: string; phone?: string; name: string; role: Role },
): Promise<string> {
  const email = spec.email?.toLowerCase();
  const existing = (email && profilesByEmail.get(email)) || (spec.phone && profilesByPhone.get(spec.phone));
  if (existing) return existing;

  const attrs =
    spec.role === "customer"
      ? { phone: `+91${spec.phone}`, phone_confirm: true, user_metadata: { name: spec.name } }
      : { email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name: spec.name, role: spec.role } };
  const { data, error } = await sb.auth.admin.createUser(attrs);
  if (!error && data.user) return data.user.id;

  // The auth user exists without a profile (or with one under another key): reuse it.
  const found = await findAuthUser(sb, { email, phone: spec.phone ? `91${spec.phone}` : undefined });
  if (found) return found.id;
  return fail(`auth.admin.createUser ${email ?? spec.phone}`, error ?? new Error("no user returned"));
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
export async function runSeed({ log = console.log, now = new Date() }: { log?: (line: string) => void; now?: Date } = {}) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const sb = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

  const rng = createRng(20261012);
  const { date: today, minutes: nowMin } = istParts(now);
  const tomorrow = addDays(today, 1);

  // ---------- catalog ----------
  {
    const rows = SERVICES.map((s) => ({
      code: s.code,
      name: s.name,
      short_name: s.shortName,
      description: s.description,
      price: s.price,
      duration_min: s.durationMin,
      requires_device: s.requiresDevice,
      icon: s.icon,
      sort_order: s.sortOrder,
    }));
    const { error } = await sb.from("services").upsert(rows, { onConflict: "code" });
    if (error) fail("upsert services", error);
  }
  const priceOf = Object.fromEntries(SERVICES.map((s) => [s.code, s.price])) as Record<ServiceCode, number>;

  const packages: SeededPackage[] = [];
  {
    const { data: existing, error } = await sb.from("packages").select("id, slug");
    if (error) fail("select packages", error);
    const idBySlug = new Map((existing ?? []).map((p: { id: string; slug: string }) => [p.slug, p.id]));
    for (const p of PACKAGES) {
      // Id derives from the slug so a booking wizard opened before the seed keeps working.
      const id = idBySlug.get(p.slug) ?? stableId(`package:${p.slug}`);
      const row = {
        id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        service_codes: p.serviceCodes,
        price: p.price,
        mrp: p.mrp,
        popular: p.popular,
        is_active: true,
        sort_order: p.sortOrder,
      };
      const { error: upsertError } = await sb.from("packages").upsert(row, { onConflict: "id" });
      if (upsertError) fail(`upsert package ${p.slug}`, upsertError);
      packages.push({ id, slug: p.slug, serviceCodes: p.serviceCodes, price: p.price });
    }
  }
  const pkgBySlug = Object.fromEntries(packages.map((p) => [p.slug, p])) as Record<string, SeededPackage>;

  // ---------- users ----------
  const { data: profileRows, error: profilesError } = await sb.from("profiles").select("id, email, phone");
  if (profilesError) fail("select profiles", profilesError);
  const profilesByEmail = new Map<string, string>();
  const profilesByPhone = new Map<string, string>();
  for (const p of (profileRows ?? []) as { id: string; email: string | null; phone: string | null }[]) {
    if (p.email) profilesByEmail.set(p.email.toLowerCase(), p.id);
    if (p.phone) profilesByPhone.set(p.phone, p.id);
  }

  const profileUpserts: ProfileUpsert[] = [];
  const staffCreated = iso(new Date(now.getTime() - 120 * DAY));

  async function seedStaff(u: SeedStaff, role: Role): Promise<SeededUser> {
    const id = await ensureAuthUser(sb, profilesByEmail, profilesByPhone, { email: u.email, name: u.name, role });
    profileUpserts.push({
      id,
      role,
      name: u.name,
      phone: u.phone,
      email: u.email.toLowerCase(),
      gender: u.gender,
      dob: null,
      addresses: [],
      specialization: u.specialization ?? null,
      qualifications: u.qualifications ?? null,
      years_experience: u.yearsExperience ?? null,
      registration_no: u.registrationNo ?? null,
      base_location: u.baseLocation ?? null,
      is_active: true,
      created_at: staffCreated,
      updated_at: staffCreated,
    });
    return { id, name: u.name, role };
  }

  async function seedCustomer(c: SeedCustomer, daysAgo: number): Promise<SeededCustomer> {
    const id = await ensureAuthUser(sb, profilesByEmail, profilesByPhone, { phone: c.phone, name: c.name, role: "customer" });
    const created = iso(new Date(now.getTime() - daysAgo * DAY));
    const addresses: Address[] = c.addresses.map((a, i) => ({ ...a, id: stableId(`address:${c.phone}:${i}`) }));
    profileUpserts.push({
      id,
      role: "customer",
      name: c.name,
      phone: c.phone,
      email: null,
      gender: c.gender,
      dob: c.dob,
      addresses,
      specialization: null,
      qualifications: null,
      years_experience: null,
      registration_no: null,
      base_location: null,
      is_active: true,
      created_at: created,
      updated_at: created,
    });
    return { id, name: c.name, role: "customer", phone: c.phone, gender: c.gender, dob: c.dob ? new Date(`${c.dob}T00:00:00Z`) : null, addresses };
  }

  const admin = await seedStaff(ADMIN, "admin");
  const doctors: SeededUser[] = [];
  for (const d of DOCTORS) doctors.push(await seedStaff(d, "doctor"));
  const nurses: SeededUser[] = [];
  for (const n of NURSES) nurses.push(await seedStaff(n, "nurse"));
  const rahul = await seedCustomer(RAHUL, 45);
  const customers: SeededCustomer[] = [];
  for (const [i, c] of CUSTOMERS.entries()) customers.push(await seedCustomer(c, 60 - i * 4));

  // Bookings reference profiles, so clear them before any profile row could conflict.
  await deleteAll(sb, "bookings");
  await deleteAll(sb, "leads");

  {
    const { error } = await sb.from("profiles").upsert(profileUpserts, { onConflict: "id" });
    if (error) fail("upsert profiles", error);
  }

  const [ananya, vikram] = doctors;
  const [priya, kavya, meera] = nurses;

  // ---------- booking builder ----------
  const slotLoad = new Map<string, number>();
  const occupy = (date: string, slot: string) => slotLoad.set(`${date}|${slot}`, (slotLoad.get(`${date}|${slot}`) ?? 0) + 1);
  const load = (date: string, slot: string) => slotLoad.get(`${date}|${slot}`) ?? 0;
  const bookings: BookingDoc[] = [];

  const patientFor = (customer: SeededCustomer): Patient => {
    const age = customer.dob ? Math.floor((now.getTime() - customer.dob.getTime()) / (365.25 * DAY)) : 35;
    if (customer.name === "Rohan Gupta" && rng.chance(0.5)) {
      return { name: "Sunita Gupta", age: 62, gender: "female", relation: "parent" };
    }
    if (customer.name === "Sneha Iyer" && rng.chance(0.3)) {
      return { name: "Karthik Iyer", age: 36, gender: "male", relation: "spouse" };
    }
    return { name: customer.name, age, gender: customer.gender, relation: "self" };
  };

  type Purchase = { pkg?: SeededPackage; codes?: ServiceCode[] };
  const choosePurchase = (): Purchase => {
    const roll = rng.next();
    if (roll < 0.35) return { pkg: pkgBySlug["heart-check"] };
    if (roll < 0.55) return { pkg: pkgBySlug["complete-home-checkup"] };
    if (roll < 0.72) return { pkg: pkgBySlug["essential-vitals"] };
    if (roll < 0.87) return { pkg: pkgBySlug["diabetes-care"] };
    const options: ServiceCode[][] = [["BP", "SUGAR", "HR"], ["ECG", "HR", "CONSULT"], ["BP", "HR", "SPO2", "CONSULT"], ["ECG", "STETH", "CONSULT"]];
    return { codes: rng.pick(options) };
  };

  const pickProfile = (codes: ServiceCode[]): ClinicalProfile => {
    if (codes.includes("SUGAR") && rng.chance(0.28)) return "diabetes";
    if (codes.includes("BP") && rng.chance(0.28)) return "hypertension";
    if (rng.chance(0.08)) return "tachycardia";
    return "normal";
  };

  const pickTemplate = (profile: ClinicalProfile, codes: ServiceCode[]): ReportTemplate => {
    const list = REPORTS[profile];
    if (profile === "normal") return codes.includes("ECG") ? list[0] : list[1];
    return rng.pick(list);
  };

  function makeVitals(codes: ServiceCode[], profile: ClinicalProfile, template: ReportTemplate, at: Date): Vitals {
    const v: Vitals = { recordedAt: iso(at), temperatureF: r1(rng.float(97.6, 98.9)), heartRate: 0 };
    if (rng.chance(0.6)) v.weightKg = r1(rng.float(52, 88));
    if (codes.includes("BP")) {
      if (profile === "hypertension") {
        v.bpSystolic = rng.int(142, 162);
        v.bpDiastolic = rng.int(90, 102);
      } else {
        v.bpSystolic = rng.int(108, 128);
        v.bpDiastolic = rng.int(68, 84);
      }
    }
    if (codes.includes("SUGAR")) {
      const prediabetic = template.diagnosis.startsWith("Impaired fasting");
      const sugarType: SugarType = prediabetic ? "fasting" : rng.pick<SugarType>(["fasting", "random", "pp"]);
      v.sugarType = sugarType;
      const ranges: Partial<Record<SugarType, [number, number]>> =
        profile === "diabetes"
          ? prediabetic
            ? { fasting: [102, 122] }
            : { fasting: [132, 178], random: [185, 248], pp: [195, 262] }
          : { fasting: [78, 98], random: [92, 136], pp: [104, 138] };
      const [lo, hi] = ranges[sugarType] ?? [78, 98];
      v.sugar = rng.int(lo, hi);
    }
    v.heartRate = profile === "tachycardia" ? rng.int(104, 118) : rng.int(62, 88);
    if (codes.includes("SPO2")) v.spo2 = rng.int(96, 99);
    return v;
  }

  function adaptSummary(summary: string, codes: ServiceCode[]): string {
    return summary
      .split(/(?<=\.)\s+/)
      .filter((s) => (codes.includes("ECG") || !/ECG/.test(s)) && (codes.includes("STETH") || !/Heart sounds|murmur/i.test(s)))
      .join(" ");
  }

  function rhythmFor(hr: number): { rhythm: string; interpretation: string } {
    if (hr > 100) return { rhythm: "Sinus tachycardia", interpretation: `Sinus tachycardia at ${hr} bpm. Regular rhythm, normal axis, no acute ST-T changes.` };
    if (hr < 60) return { rhythm: "Sinus bradycardia", interpretation: `Sinus bradycardia at ${hr} bpm. Regular rhythm, no acute ST-T changes.` };
    return { rhythm: "Normal sinus rhythm", interpretation: `Normal sinus rhythm at ${hr} bpm. Normal axis, PR and QRS intervals normal, no ST-T changes.` };
  }

  type FinalStatus = "completed" | "cancelled" | "testing" | "assigned" | "confirmed" | "pending_payment";
  interface BuildOpts {
    customer: SeededCustomer;
    date: string;
    slot: string;
    finalStatus: FinalStatus;
    nurse?: SeededUser;
    doctor?: SeededUser;
    purchase?: Purchase;
    profile?: ClinicalProfile;
    template?: ReportTemplate;
    addressIndex?: number;
    createdAt?: Date;
    cancelFrom?: "pending_payment" | "confirmed";
    ratingScore?: number;
  }

  /** Build a booking row in memory (dates as Date for created_at/updated_at, ISO strings inside JSON). */
  function build({ customer, date, slot, finalStatus, nurse, doctor, purchase, profile, template, addressIndex = 0, createdAt, cancelFrom, ratingScore }: BuildOpts): BookingDoc {
    const address = customer.addresses[Math.min(addressIndex, customer.addresses.length - 1)];
    const { pkg, codes: rawCodes } = purchase ?? choosePurchase();
    const codes = pkg ? pkg.serviceCodes : (rawCodes as ServiceCode[]);
    const amount = pkg ? pkg.price : codes.reduce((s, c) => s + priceOf[c], 0);
    const slotStart = istDateTime(date, slot.slice(0, 5));
    const created = createdAt ?? new Date(Math.min(now.getTime() - 10 * MIN, slotStart.getTime() - rng.float(3 * HOUR, 40 * HOUR)));
    const method = rng.pick<PaymentMethod>(["upi", "upi", "upi", "card", "netbanking"]);
    const timeline: TimelineRow[] = [{ status: "pending_payment", at: iso(created), by: customer.name, note: "Booking placed" }];
    const doc: BookingDoc = {
      id: uuidv4(),
      customer_id: customer.id,
      patient: patientFor(customer),
      address: { id: address.id, label: address.label, line1: address.line1, area: address.area, city: address.city, pincode: address.pincode, lat: address.lat, lng: address.lng },
      package_id: pkg?.id ?? null,
      service_codes: codes,
      scheduled_date: date,
      slot,
      amount,
      payment: { status: "pending" },
      status: "pending_payment",
      nurse_id: null,
      doctor_id: null,
      timeline,
      nurse_location: null,
      vitals: null,
      ecg: null,
      stethoscope: null,
      report: null,
      rating: null,
      notes: rng.pick(SYMPTOM_NOTES),
      cancel_reason: null,
      created_at: created,
      updated_at: created,
    };
    const step = (status: BookingStatus, rawAt: Date, by: string, note: string) => {
      // Never write timeline entries in the future (relevant for today's in-progress visits).
      const at = new Date(Math.min(rawAt.getTime(), now.getTime() - MIN));
      timeline.push({ status, at: iso(at), by, note });
      doc.status = status;
      doc.updated_at = at;
    };

    if (finalStatus === "pending_payment" || cancelFrom === "pending_payment") {
      if (finalStatus === "cancelled") step("cancelled", new Date(created.getTime() + rng.int(20, 300) * MIN), customer.name, "Booking cancelled: payment not completed");
      return doc;
    }

    const paidAt = new Date(created.getTime() + rng.int(1, 4) * MIN);
    doc.payment = { status: "paid", method, txnId: `NVPAY${paidAt.getTime().toString(36).toUpperCase()}${rng.int(100, 999)}`, paidAt: iso(paidAt) };
    const methodLabel: Record<string, string> = { upi: "UPI", card: "card", netbanking: "net banking" };
    step("confirmed", paidAt, customer.name, `Payment received via ${methodLabel[method]}`);
    if (finalStatus === "confirmed") return doc;

    if (finalStatus === "cancelled" && cancelFrom === "confirmed") {
      const byAdmin = rng.chance(0.3);
      step(
        "cancelled",
        new Date(paidAt.getTime() + rng.int(30, 600) * MIN),
        byAdmin ? admin.name : customer.name,
        byAdmin ? "Booking cancelled by Nivar: patient unreachable" : rng.pick(["Booking cancelled: travelling that day", "Booking cancelled: will reschedule next week"]),
      );
      doc.payment.status = "refunded";
      doc.cancel_reason = "Customer request";
      return doc;
    }

    if (!nurse || !doctor) throw new Error(`Booking for ${customer.name} on ${date} needs a nurse and a doctor to reach ${finalStatus}`);
    const assignedAt = new Date(Math.min(paidAt.getTime() + rng.int(10, 90) * MIN, now.getTime() - 2 * MIN));
    doc.nurse_id = nurse.id;
    doc.doctor_id = doctor.id;
    step("assigned", assignedAt, admin.name, `${nurse.name} assigned as your nurse, ${doctor.name} as your doctor`);
    if (finalStatus === "assigned") return doc;

    const enRoute = new Date(Math.max(assignedAt.getTime() + MIN, slotStart.getTime() - rng.int(20, 35) * MIN));
    step("en_route", enRoute, nurse.name, "Nurse is on the way");
    const arrived = new Date(Math.max(enRoute.getTime() + 15 * MIN, slotStart.getTime() + rng.int(-5, 12) * MIN));
    step("arrived", arrived, nurse.name, `${nurse.name.split(" ")[0]} has arrived at your home`);
    doc.nurse_location = { lat: address.lat, lng: address.lng, updatedAt: iso(arrived) };
    const testing = new Date(arrived.getTime() + rng.int(3, 6) * MIN);
    step("testing", testing, nurse.name, "Tests in progress");

    const prof = profile ?? pickProfile(codes);
    const tpl = template ?? pickTemplate(prof, codes);
    const vitalsAt = new Date(testing.getTime() + rng.int(4, 9) * MIN);
    const vitals = makeVitals(codes, prof, tpl, vitalsAt);
    doc.vitals = vitals;
    const hr = vitals.heartRate;
    if (codes.includes("ECG")) {
      doc.ecg = { samples: generateEcg({ heartRate: hr, seed: rng.int(1, 1e9) }), sampleRate: 250, heartRate: hr, ...rhythmFor(hr), capturedAt: iso(new Date(vitalsAt.getTime() + 3 * MIN)) };
    }
    if (codes.includes("STETH")) {
      doc.stethoscope = {
        heartRate: hr,
        findings: prof === "tachycardia" ? "S1 S2 normal, rapid regular rhythm, no murmurs. Lungs clear." : "S1 S2 normal, no murmurs or added sounds. Lungs clear bilaterally.",
        samples: generateStethEnvelope({ heartRate: hr, seed: rng.int(1, 1e9) }),
        capturedAt: iso(new Date(vitalsAt.getTime() + 6 * MIN)),
      };
    }
    if (finalStatus === "testing") {
      // In-progress visit: only BP/HR captured so far.
      doc.vitals = { recordedAt: vitals.recordedAt, bpSystolic: vitals.bpSystolic, bpDiastolic: vitals.bpDiastolic, heartRate: hr };
      doc.ecg = null;
      doc.stethoscope = null;
      return doc;
    }

    const consult = new Date(testing.getTime() + rng.int(16, 24) * MIN);
    step("consult", consult, nurse.name, `Video consult started with ${doctor.name}`);
    const reporting = new Date(consult.getTime() + rng.int(9, 15) * MIN);
    step("reporting", reporting, doctor.name, `${doctor.name} is preparing your report`);
    const published = new Date(reporting.getTime() + rng.int(6, 14) * MIN);
    doc.report = {
      diagnosis: tpl.diagnosis,
      summary: adaptSummary(tpl.summary, codes),
      prescription: tpl.prescription,
      advice: tpl.advice,
      followUp: tpl.followUp,
      publishedAt: iso(published),
    };
    step("completed", published, doctor.name, "Report published");
    const score = ratingScore ?? (rng.chance(0.78) ? rng.pick([5, 5, 5, 4, 4, 3]) : null);
    if (score) doc.rating = { score, comment: rng.pick(RATING_COMMENTS[score]), ratedAt: iso(new Date(published.getTime() + rng.int(30, 600) * MIN)) };
    return doc;
  }

  const add = (doc: BookingDoc) => {
    occupy(doc.scheduled_date, doc.slot);
    bookings.push(doc);
    return doc;
  };

  // ---------- Rahul: three completed visits, nothing active ----------
  const rahulStory: { days: number; slot: string; pkg: string; profile: ClinicalProfile; template: ReportTemplate; score: number }[] = [
    { days: 26, slot: "08:00-09:00", pkg: "heart-check", profile: "hypertension", template: REPORTS.hypertension[0], score: 5 },
    {
      days: 11,
      slot: "09:00-10:00",
      pkg: "essential-vitals",
      profile: "normal",
      score: 5,
      template: {
        diagnosis: "Essential hypertension, well controlled on treatment",
        summary: "Follow-up visit. Blood pressure is now within target on Telmisartan 40 mg. Sugar, heart rate and oxygen saturation are normal.",
        prescription: [{ medicine: "Telmisartan 40 mg (Telma 40)", dosage: "1 tablet", frequency: "Once daily, morning", duration: "60 days", notes: "Continue the same dose" }],
        advice: ["Keep up the daily walks", "Continue the low-salt diet", "Check BP at home twice a week"],
        followUp: "Review in 2 months",
      },
    },
    { days: 4, slot: "07:00-08:00", pkg: "complete-home-checkup", profile: "normal", template: REPORTS.normal[0], score: 4 },
  ];
  for (const s of rahulStory) {
    const date = addDays(today, -s.days);
    add(build({ customer: rahul, date, slot: s.slot, finalStatus: "completed", nurse: priya, doctor: ananya, purchase: { pkg: pkgBySlug[s.pkg] }, profile: s.profile, template: s.template, ratingScore: s.score }));
  }

  // ---------- history: last 30 days, other customers ----------
  const pairs: [SeededUser, SeededUser][] = [[priya, ananya], [kavya, vikram], [meera, ananya], [kavya, ananya], [meera, vikram], [priya, vikram]];
  const HISTORY = 38;
  for (let i = 0; i < HISTORY; i++) {
    const daysAgo = 1 + Math.floor((i * 29) / HISTORY) + (rng.chance(0.3) ? 1 : 0);
    const date = addDays(today, -Math.min(daysAgo, 30));
    let slot = rng.pick(SLOTS);
    for (let k = 0; k < 5 && load(date, slot) >= 2; k++) slot = rng.pick(SLOTS);
    const customer = customers[i % customers.length];
    const [nurse, doctor] = rng.pick(pairs);
    const cancelled = i % 9 === 4;
    add(
      build({
        customer,
        date,
        slot,
        nurse,
        doctor,
        addressIndex: rng.int(0, customer.addresses.length - 1),
        finalStatus: cancelled ? "cancelled" : "completed",
        cancelFrom: cancelled ? rng.pick<"pending_payment" | "confirmed">(["pending_payment", "confirmed"]) : undefined,
      }),
    );
  }

  // ---------- today ----------
  const isFuture = (slot: string) => slotStartMinutes(slot) > nowMin + 20;
  const futureToday = SLOTS.filter(isFuture);
  const pastToday = SLOTS.filter((s) => slotStartMinutes(s) + 120 <= nowMin);
  const freeSlot = (date: string, candidates: string[], max = 1) => candidates.find((s) => load(date, s) < max);

  // Completed earlier today (only if those slots really are in the past).
  if (pastToday.length >= 2) {
    add(build({ customer: customers[1], date: today, slot: pastToday[0], finalStatus: "completed", nurse: meera, doctor: vikram }));
    add(build({ customer: customers[4], date: today, slot: pastToday[Math.min(2, pastToday.length - 1)], finalStatus: "completed", nurse: kavya, doctor: ananya, purchase: { pkg: pkgBySlug["heart-check"] } }));
  }

  // In progress right now (Kavya + Dr. Vikram), if within working hours.
  const currentSlot = SLOTS.find((s) => slotStartMinutes(s) <= nowMin && nowMin < slotStartMinutes(s) + 60);
  if (currentSlot) {
    add(build({ customer: customers[3], date: today, slot: currentSlot, finalStatus: "testing", nurse: kavya, doctor: vikram, purchase: { pkg: pkgBySlug["complete-home-checkup"] }, createdAt: new Date(now.getTime() - 26 * HOUR) }));
  }

  // Priya + Dr. Ananya: two assigned visits later today (fall back to the last slots of the day).
  const priyaSlots =
    futureToday.length >= 2
      ? [futureToday[Math.min(1, futureToday.length - 1)], futureToday[futureToday.length - 1]]
      : futureToday.length === 1
        ? [SLOTS[SLOTS.length - 2], futureToday[0]]
        : SLOTS.slice(-2);
  add(build({ customer: customers[0], date: today, slot: priyaSlots[0], finalStatus: "assigned", nurse: priya, doctor: ananya, purchase: { pkg: pkgBySlug["heart-check"] }, createdAt: new Date(now.getTime() - 20 * HOUR) }));
  add(build({ customer: customers[2], date: today, slot: priyaSlots[1], finalStatus: "assigned", nurse: priya, doctor: ananya, addressIndex: 1, purchase: { pkg: pkgBySlug["diabetes-care"] }, createdAt: new Date(now.getTime() - 9 * HOUR) }));

  // Needs assignment: confirmed but unassigned, today (if a slot remains) and tomorrow.
  const unassignedToday = freeSlot(today, futureToday);
  add(
    build({
      customer: customers[5],
      date: unassignedToday ? today : tomorrow,
      slot: unassignedToday ?? "10:00-11:00",
      finalStatus: "confirmed",
      addressIndex: 0,
      purchase: { pkg: pkgBySlug["complete-home-checkup"] },
      createdAt: new Date(now.getTime() - 3 * HOUR),
    }),
  );
  add(build({ customer: customers[3], date: tomorrow, slot: "08:00-09:00", finalStatus: "confirmed", addressIndex: 1, purchase: { pkg: pkgBySlug["heart-check"] }, createdAt: new Date(now.getTime() - 50 * MIN) }));

  // Tomorrow: already assigned visit, and an abandoned checkout.
  add(build({ customer: customers[4], date: tomorrow, slot: "11:00-12:00", finalStatus: "assigned", nurse: meera, doctor: vikram, purchase: { pkg: pkgBySlug["diabetes-care"] }, createdAt: new Date(now.getTime() - 5 * HOUR) }));
  add(build({ customer: customers[5], date: tomorrow, slot: "17:00-18:00", finalStatus: "pending_payment", addressIndex: 1, purchase: { codes: ["BP", "SUGAR", "HR"] }, createdAt: new Date(now.getTime() - 35 * MIN) }));

  // ---------- codes in creation order ----------
  bookings.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  const rows = bookings.map((b, i) => ({ ...b, code: `NV-${1001 + i}`, created_at: iso(b.created_at), updated_at: iso(b.updated_at) }));
  await insertChunked(sb, "bookings", rows);
  {
    const { error } = await sb.rpc("reset_booking_codes", { p_next: 1001 + bookings.length });
    if (error) fail("rpc reset_booking_codes", error);
  }

  await insertChunked(
    sb,
    "leads",
    LEADS.map((l, i) => ({ ...l, created_at: iso(new Date(now.getTime() - (i * 2 + 1) * DAY + rng.int(0, 600) * MIN)) })),
  );

  // ---------- summary ----------
  const byStatus: Partial<Record<BookingStatus, number>> = {};
  for (const b of bookings) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  log("");
  log(`Seeded ${url}`);
  log(`  ${SERVICES.length} services, ${packages.length} packages, ${bookings.length} bookings (${Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(", ")}), ${LEADS.length} leads`);
  log("");
  log("Demo credentials");
  log(`  Customer  Rahul Mehta   phone ${RAHUL.phone}   OTP ${DEMO_OTP}   (no active booking)`);
  log(`  Admin     ${ADMIN.email}   password ${DEMO_PASSWORD}`);
  for (const d of DOCTORS) log(`  Doctor    ${d.email.padEnd(22)} password ${DEMO_PASSWORD}   ${d.name}, ${d.specialization}`);
  for (const n of NURSES) log(`  Nurse     ${n.email.padEnd(22)} password ${DEMO_PASSWORD}   ${n.name}, hub ${n.baseLocation?.label.replace("Nivar Hub, ", "")}`);
  log("");
  log(`  Today (${today}): Priya + Dr. Ananya have visits at ${priyaSlots.join(" and ")}; ${bookings.filter((b) => b.status === "confirmed").length} bookings need assignment.`);
  return { bookings: bookings.length, byStatus, today };
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runSeed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
