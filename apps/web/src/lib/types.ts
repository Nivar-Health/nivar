// TypeScript mirror of the API data model (spec section 4).
// API responses expose `id` (string) instead of `_id`, and timestamps as ISO strings.

export type ISODate = string;

export type Role = "customer" | "nurse" | "doctor" | "admin";
export type StaffRole = Exclude<Role, "customer">;
export type Gender = "male" | "female" | "other";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  area: string;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  gender?: Gender;
  dob?: ISODate;
  addresses?: Address[];
  specialization?: string;
  qualifications?: string;
  yearsExperience?: number;
  registrationNo?: string;
  baseLocation?: GeoPoint & { label?: string };
  isActive?: boolean;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

/** Public profile of a user as populated on a booking (customer / nurse / doctor). */
export type UserSummary = Pick<User, "id" | "name" | "role"> &
  Partial<
    Pick<
      User,
      | "phone"
      | "email"
      | "avatarUrl"
      | "gender"
      | "specialization"
      | "qualifications"
      | "yearsExperience"
      | "registrationNo"
      | "baseLocation"
    >
  >;

export type ServiceCode = "BP" | "ECG" | "SUGAR" | "HR" | "SPO2" | "STETH" | "CONSULT";
export type DeviceKind = "ecg" | "stethoscope";

export interface Service {
  id?: string;
  code: ServiceCode;
  name: string;
  shortName: string;
  description: string;
  price: number;
  durationMin: number;
  requiresDevice: DeviceKind | null;
  icon: string;
}

export interface Package {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  serviceCodes: ServiceCode[];
  price: number;
  mrp: number;
  popular: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

export const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "assigned",
  "en_route",
  "arrived",
  "testing",
  "consult",
  "reporting",
  "completed",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Relation = "self" | "parent" | "spouse" | "child" | "other";

export interface Patient {
  name: string;
  age: number;
  gender: Gender;
  relation: Relation;
}

export type PaymentStatus = "pending" | "paid" | "refunded";
export type PaymentMethod = "upi" | "card" | "netbanking" | "cash";

export interface Payment {
  status: PaymentStatus;
  method?: PaymentMethod;
  txnId?: string;
  paidAt?: ISODate;
}

export interface TimelineEntry {
  status: BookingStatus;
  at: ISODate;
  by?: string;
  note?: string;
}

export interface NurseLocation extends GeoPoint {
  updatedAt?: ISODate;
}

export type SugarType = "fasting" | "random" | "pp";

export interface Vitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  sugar?: number;
  sugarType?: SugarType;
  heartRate?: number;
  spo2?: number;
  temperatureF?: number;
  weightKg?: number;
  recordedAt?: ISODate;
}

export interface Ecg {
  samples: number[];
  sampleRate: number;
  heartRate: number;
  rhythm: string;
  interpretation?: string;
  capturedAt?: ISODate;
}

export interface Stethoscope {
  heartRate: number;
  findings: string;
  samples: number[];
  capturedAt?: ISODate;
}

export interface PrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface Report {
  diagnosis: string;
  summary: string;
  prescription: PrescriptionItem[];
  advice: string[];
  followUp?: string;
  publishedAt?: ISODate;
}

export interface Rating {
  score: number;
  comment?: string;
}

export interface Booking {
  id: string;
  code: string;
  /** Populated on GET /bookings/:id; may be a bare id in list or socket payloads. */
  customer: UserSummary | string;
  patient: Patient;
  address: Address;
  packageId?: string | null;
  serviceCodes: ServiceCode[];
  scheduledDate: string; // YYYY-MM-DD
  slot: string; // "09:00-10:00"
  amount: number;
  payment: Payment;
  status: BookingStatus;
  nurse?: UserSummary | string | null;
  doctor?: UserSummary | string | null;
  timeline: TimelineEntry[];
  nurseLocation?: NurseLocation | null;
  vitals?: Vitals | null;
  ecg?: Ecg | null;
  stethoscope?: Stethoscope | null;
  report?: Report | null;
  rating?: Rating | null;
  notes?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Slot {
  slot: string; // "09:00-10:00", or "express" (today only, nurse within 60 minutes)
  available: boolean;
  express?: boolean;
}

export interface SlotsResponse {
  date: string;
  slots: Slot[];
}

export interface Catalog {
  services: Service[];
  packages: Package[];
}

export interface AdminStats {
  today: { bookings: number; completed: number; inProgress: number };
  revenue: { today: number; month: number; total: number };
  counts: { customers: number; nurses: number; doctors: number };
  statusBreakdown: Partial<Record<BookingStatus, number>>;
  last7Days: { date: string; bookings: number; revenue: number }[];
}

export type StaffMember = User & { activeBookings: number };
export type CustomerRow = User & { bookingCount: number };

export interface Lead {
  id: string;
  name: string;
  phone: string;
  city: string;
  message?: string;
  createdAt: ISODate;
  updatedAt?: ISODate;
}

// ---- Auth payloads ----

export interface AuthResponse {
  token: string;
  user: User;
}

export interface OtpRequestResponse {
  ok: boolean;
  demoOtp?: string;
  isNewUser: boolean;
}

// ---- Realtime payloads (spec section 6) ----

export type DeviceState = "connecting" | "streaming" | "stopped";

export interface NurseLocationEvent extends GeoPoint {
  bookingId: string;
  at: ISODate | number;
}

export interface EcgChunkEvent {
  bookingId: string;
  samples: number[];
  sampleRate: number;
  heartRate: number;
  t: number;
}

export interface StethChunkEvent {
  bookingId: string;
  samples: number[];
  heartRate: number;
  t: number;
}

export interface DeviceStatusEvent {
  bookingId: string;
  device: DeviceKind;
  state: DeviceState;
}

export interface NotifyEvent {
  title: string;
  body: string;
  bookingId?: string;
}

// ---- Helpers for refs that may or may not be populated ----

/** Returns the populated user for a booking ref, or null when it is missing or a bare id. */
export function populated(ref: UserSummary | string | null | undefined): UserSummary | null {
  return ref && typeof ref === "object" ? ref : null;
}

/** Returns the id of a ref whether or not it is populated. */
export function refId(ref: { id: string } | string | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
