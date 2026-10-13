// Row <-> API payload mappers. The API keeps the camelCase shapes from the MVP spec.
import type { Booking, Package, Service, User, UserSummary } from "@/lib/types";

export interface ProfileRow {
  id: string;
  role: User["role"];
  name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  gender: User["gender"] | null;
  dob: string | null;
  addresses: unknown;
  specialization: string | null;
  qualifications: string | null;
  years_experience: number | null;
  registration_no: string | null;
  base_location: User["baseLocation"] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const clean = <T extends object>(o: T): T => {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === null || o[k] === undefined) delete o[k];
  return o;
};

export function profileToUser(p: ProfileRow): User {
  return clean({
    id: p.id,
    name: p.name ?? "",
    role: p.role,
    phone: p.phone,
    email: p.email,
    avatarUrl: p.avatar_url,
    gender: p.gender,
    dob: p.dob,
    addresses: Array.isArray(p.addresses) ? (p.addresses as User["addresses"]) : undefined,
    specialization: p.specialization,
    qualifications: p.qualifications,
    yearsExperience: p.years_experience,
    registrationNo: p.registration_no,
    baseLocation: p.base_location,
    isActive: p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }) as User;
}

/** Public fields only, as embedded on bookings. */
export function profileToSummary(p: ProfileRow | null | undefined): UserSummary | undefined {
  if (!p) return undefined;
  return clean({
    id: p.id,
    name: p.name ?? "",
    role: p.role,
    phone: p.phone,
    email: p.email,
    avatarUrl: p.avatar_url,
    gender: p.gender,
    specialization: p.specialization,
    qualifications: p.qualifications,
    yearsExperience: p.years_experience,
    registrationNo: p.registration_no,
    baseLocation: p.base_location,
  }) as UserSummary;
}

export interface ServiceRow {
  code: Service["code"];
  name: string;
  short_name: string;
  description: string;
  price: number;
  duration_min: number;
  requires_device: Service["requiresDevice"];
  icon: string | null;
  sort_order: number;
}

export const serviceToApi = (s: ServiceRow): Service & { sortOrder: number } => ({
  code: s.code,
  name: s.name,
  shortName: s.short_name,
  description: s.description,
  price: s.price,
  durationMin: s.duration_min,
  requiresDevice: s.requires_device,
  icon: s.icon ?? "",
  sortOrder: s.sort_order,
});

export interface PackageRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  service_codes: string[];
  price: number;
  mrp: number;
  popular: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const packageToApi = (p: PackageRow): Package => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  tagline: p.tagline,
  description: p.description,
  serviceCodes: p.service_codes as Package["serviceCodes"],
  price: p.price,
  mrp: p.mrp,
  popular: p.popular,
  isActive: p.is_active,
  sortOrder: p.sort_order,
});

export interface BookingRow {
  id: string;
  code: string;
  customer_id: string;
  patient: Booking["patient"];
  address: Booking["address"];
  package_id: string | null;
  service_codes: string[];
  scheduled_date: string;
  slot: string;
  amount: number;
  payment: Booking["payment"];
  status: Booking["status"];
  nurse_id: string | null;
  doctor_id: string | null;
  timeline: Booking["timeline"];
  nurse_location: Booking["nurseLocation"] | null;
  vitals: Booking["vitals"] | null;
  ecg: Booking["ecg"] | null;
  stethoscope: Booking["stethoscope"] | null;
  report: Booking["report"] | null;
  rating: Booking["rating"] | null;
  notes: string;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  // Populated by the `bookings_with_people` select (see server/bookings.ts).
  customer?: ProfileRow | null;
  nurse?: ProfileRow | null;
  doctor?: ProfileRow | null;
}

/** The booking JSON shared by REST responses and `booking:updated` broadcasts. */
export function bookingToApi(b: BookingRow, { lite = false } = {}): Booking {
  const ecg = b.ecg && lite ? { ...b.ecg, samples: undefined } : b.ecg;
  const steth = b.stethoscope && lite ? { ...b.stethoscope, samples: undefined } : b.stethoscope;
  return clean({
    id: b.id,
    code: b.code,
    customer: profileToSummary(b.customer) ?? b.customer_id,
    patient: b.patient,
    address: b.address,
    packageId: b.package_id,
    serviceCodes: b.service_codes,
    scheduledDate: b.scheduled_date,
    slot: b.slot,
    amount: b.amount,
    payment: b.payment,
    status: b.status,
    nurse: profileToSummary(b.nurse) ?? b.nurse_id,
    doctor: profileToSummary(b.doctor) ?? b.doctor_id,
    timeline: b.timeline ?? [],
    nurseLocation: b.nurse_location,
    vitals: b.vitals,
    ecg: ecg ? clean({ ...ecg }) : undefined,
    stethoscope: steth ? clean({ ...steth }) : undefined,
    report: b.report,
    rating: b.rating,
    notes: b.notes ?? "",
    cancelReason: b.cancel_reason,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  }) as unknown as Booking;
}
