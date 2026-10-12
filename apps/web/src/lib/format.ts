import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
} from "date-fns";
import {
  Activity,
  BadgeCheck,
  CircleCheck,
  CircleX,
  CreditCard,
  FileHeart,
  FilePenLine,
  House,
  Navigation,
  UserRoundCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus, SugarType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** ₹1,499 / ₹1,25,000 */
export function formatINR(amount: number | null | undefined): string {
  return inr.format(Math.round(amount ?? 0));
}

/** 1,25,000 */
export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(n ?? 0);
}

/** Compact INR for charts and KPI tiles: ₹950, ₹12.4K, ₹3.2L, ₹1.1Cr. */
export function formatINRCompact(amount: number | null | undefined): string {
  const n = Math.round(amount ?? 0);
  const abs = Math.abs(n);
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(n / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(n / 1e3)}K`;
  return formatINR(n);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : typeof input === "number" ? new Date(input) : parseISO(input);
  return isValid(d) ? d : null;
}

/** "Mon, 12 Oct" (adds the year when it is not the current year). */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "EEE, d MMM" : "d MMM yyyy");
}

/** "12 Oct 2026" */
export function formatDateLong(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, "d MMM yyyy") : "";
}

/** "9:42 AM" */
export function formatTime(input: DateInput): string {
  const d = toDate(input);
  return d ? format(d, "h:mm a") : "";
}

/** "12 Oct, 9:42 AM" */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMM, h:mm a" : "d MMM yyyy, h:mm a");
}

/** "5 minutes ago", "in 2 hours". */
export function relative(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  if (Math.abs(Date.now() - d.getTime()) < 45_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** "Today", "Tomorrow", "Yesterday" or "Wed, 14 Oct" for a YYYY-MM-DD date. */
export function dayLabel(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDate(d);
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function parseHM(hm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

function hm12(h: number, m: number): { text: string; period: "AM" | "PM" } {
  const period = h >= 12 && h < 24 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { text: `${hour}:${String(m).padStart(2, "0")}`, period };
}

/** "09:00-10:00" -> "9:00 - 10:00 AM"; "11:00-12:00" -> "11:00 AM - 12:00 PM". */
/** Same-day visit where the nurse arrives within 60 minutes (API slot value). */
export const EXPRESS_SLOT = "express";

export function slotLabel(slot: string | null | undefined): string {
  if (!slot) return "";
  if (slot === EXPRESS_SLOT) return "Express, within 60 min";
  const [startRaw, endRaw] = slot.split("-");
  const start = startRaw ? parseHM(startRaw) : null;
  const end = endRaw ? parseHM(endRaw) : null;
  if (!start) return slot;
  const s = hm12(start.h, start.m);
  if (!end) return `${s.text} ${s.period}`;
  const e = hm12(end.h, end.m);
  return s.period === e.period
    ? `${s.text} - ${e.text} ${e.period}`
    : `${s.text} ${s.period} - ${e.text} ${e.period}`;
}

/** "Today, 9:00 - 10:00 AM" */
export function scheduleLabel(date: string, slot: string): string {
  return `${dayLabel(date)}, ${slotLabel(slot)}`;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** "Rahul Mehta" -> "RM" */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, "").trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** "9876543210" -> "+91 98765 43210" */
export function formatPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone ?? "";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").replace(/^(dr\.?)\s+/i, "").trim().split(/\s+/)[0] ?? "";
}

// ---------------------------------------------------------------------------
// Booking status
// ---------------------------------------------------------------------------

export interface StatusMeta {
  /** Short label shown to patients. */
  patientLabel: string;
  /** One-line explanation for patients (spec 4.1). */
  patientDescription: string;
  /** Short label for nurse, doctor and admin screens. */
  staffLabel: string;
  icon: LucideIcon;
  /** Badge classes (background, text, ring). */
  badgeClass: string;
  /** Solid dot colour class. */
  dotClass: string;
  /** Text colour class. */
  textClass: string;
  /** Index into BOOKING_STEPS; -1 for cancelled. */
  step: number;
  /** True while a visit is underway and should feel "live". */
  live: boolean;
}

export const STATUS_META: Record<BookingStatus, StatusMeta> = {
  pending_payment: {
    patientLabel: "Payment pending",
    patientDescription: "Complete payment to confirm your visit.",
    staffLabel: "Awaiting payment",
    icon: CreditCard,
    badgeClass: "bg-amber-50 text-amber-800 ring-amber-200",
    dotClass: "bg-amber-500",
    textClass: "text-amber-700",
    step: 0,
    live: false,
  },
  confirmed: {
    patientLabel: "Confirmed",
    patientDescription: "Booking confirmed. We are assigning your care team.",
    staffLabel: "Needs assignment",
    icon: CircleCheck,
    badgeClass: "bg-orange-50 text-orange-800 ring-orange-200",
    dotClass: "bg-orange-500",
    textClass: "text-orange-700",
    step: 1,
    live: false,
  },
  assigned: {
    patientLabel: "Care team assigned",
    patientDescription: "Your nurse and doctor are assigned for this visit.",
    staffLabel: "Assigned",
    icon: UserRoundCheck,
    badgeClass: "bg-violet-50 text-violet-800 ring-violet-200",
    dotClass: "bg-violet-500",
    textClass: "text-violet-700",
    step: 2,
    live: false,
  },
  en_route: {
    patientLabel: "Nurse on the way",
    patientDescription: "Your nurse is on the way. Track them live on the map.",
    staffLabel: "En route",
    icon: Navigation,
    badgeClass: "bg-sky-50 text-sky-800 ring-sky-200",
    dotClass: "bg-sky-500",
    textClass: "text-sky-700",
    step: 3,
    live: true,
  },
  arrived: {
    patientLabel: "Nurse arrived",
    patientDescription: "Your nurse has arrived and is setting up.",
    staffLabel: "Arrived",
    icon: House,
    badgeClass: "bg-cyan-50 text-cyan-800 ring-cyan-200",
    dotClass: "bg-cyan-500",
    textClass: "text-cyan-700",
    step: 4,
    live: true,
  },
  testing: {
    patientLabel: "Tests in progress",
    patientDescription: "Your nurse is recording vitals. Readings appear here live.",
    staffLabel: "Testing",
    icon: Activity,
    badgeClass: "bg-teal-50 text-teal-800 ring-teal-200",
    dotClass: "bg-teal-500",
    textClass: "text-teal-700",
    step: 5,
    live: true,
  },
  consult: {
    patientLabel: "Doctor consult",
    patientDescription: "Your doctor is ready. Join the video consult.",
    staffLabel: "In consult",
    icon: Video,
    badgeClass: "bg-primary text-primary-foreground ring-primary",
    dotClass: "bg-primary",
    textClass: "text-primary",
    step: 6,
    live: true,
  },
  reporting: {
    patientLabel: "Preparing report",
    patientDescription: "Your doctor is preparing your report.",
    staffLabel: "Reporting",
    icon: FilePenLine,
    badgeClass: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    dotClass: "bg-indigo-500",
    textClass: "text-indigo-700",
    step: 7,
    live: true,
  },
  completed: {
    patientLabel: "Report ready",
    patientDescription: "Your report is ready.",
    staffLabel: "Completed",
    icon: BadgeCheck,
    badgeClass: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    step: 8,
    live: false,
  },
  cancelled: {
    patientLabel: "Cancelled",
    patientDescription: "This booking was cancelled.",
    staffLabel: "Cancelled",
    icon: CircleX,
    badgeClass: "bg-red-50 text-red-700 ring-red-200",
    dotClass: "bg-red-500",
    textClass: "text-red-700",
    step: -1,
    live: false,
  },
};

/** The ordered journey shown by <BookingStepper>. */
export const BOOKING_STEPS: {
  status: BookingStatus;
  label: string;
  longLabel: string;
  icon: LucideIcon;
}[] = [
  { status: "pending_payment", label: "Booked", longLabel: "Booking placed", icon: CreditCard },
  { status: "confirmed", label: "Confirmed", longLabel: "Payment received, booking confirmed", icon: CircleCheck },
  { status: "assigned", label: "Team assigned", longLabel: "Nurse and doctor assigned", icon: UserRoundCheck },
  { status: "en_route", label: "On the way", longLabel: "Nurse on the way", icon: Navigation },
  { status: "arrived", label: "Arrived", longLabel: "Nurse arrived", icon: House },
  { status: "testing", label: "Tests", longLabel: "Tests in progress", icon: Activity },
  { status: "consult", label: "Consult", longLabel: "Video consult with doctor", icon: Video },
  { status: "reporting", label: "Report", longLabel: "Doctor preparing report", icon: FilePenLine },
  { status: "completed", label: "Done", longLabel: "Report ready", icon: FileHeart },
];

/** Statuses during which the patient can still cancel (spec 4.1). */
export const CANCELLABLE_STATUSES: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "assigned",
  "en_route",
];

export const ACTIVE_STATUSES: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "assigned",
  "en_route",
  "arrived",
  "testing",
  "consult",
  "reporting",
];

// ---------------------------------------------------------------------------
// Vitals
// ---------------------------------------------------------------------------

export type VitalKind = "bp" | "sugar" | "heartRate" | "spo2" | "temperature";
export type VitalLevel = "normal" | "high" | "low";

export interface VitalAssessment {
  level: VitalLevel;
  /** Human label, e.g. "Normal", "Elevated", "High", "Low". */
  label: string;
}

export const VITAL_INFO: Record<VitalKind, { label: string; unit: string; normalRange: string }> = {
  bp: { label: "Blood pressure", unit: "mmHg", normalRange: "Below 120/80" },
  sugar: { label: "Blood sugar", unit: "mg/dL", normalRange: "70-99 fasting, below 140 random" },
  heartRate: { label: "Heart rate", unit: "bpm", normalRange: "60-100" },
  spo2: { label: "SpO2", unit: "%", normalRange: "95-100" },
  temperature: { label: "Temperature", unit: "°F", normalRange: "97-99.5" },
};

export const SUGAR_TYPE_LABEL: Record<SugarType, string> = {
  fasting: "Fasting",
  random: "Random",
  pp: "Post meal",
};

/** Normal range text for a sugar reading of a given type. */
export function sugarNormalRange(type: SugarType | undefined): string {
  return type === "fasting" ? "70-99" : "70-139";
}

export const VITAL_LEVEL_META: Record<VitalLevel, { label: string; className: string; dotClass: string }> = {
  normal: { label: "Normal", className: "bg-emerald-50 text-emerald-800 ring-emerald-200", dotClass: "bg-emerald-500" },
  high: { label: "High", className: "bg-red-50 text-red-700 ring-red-200", dotClass: "bg-red-500" },
  low: { label: "Low", className: "bg-amber-50 text-amber-800 ring-amber-200", dotClass: "bg-amber-500" },
};

/** Classes for a vital assessment; "Elevated" BP gets a softer amber tone than "High". */
export function vitalToneClass(a: VitalAssessment): string {
  if (a.label === "Elevated") return "bg-amber-50 text-amber-800 ring-amber-200";
  return VITAL_LEVEL_META[a.level].className;
}

export type BpValue = { systolic: number; diastolic: number };

/**
 * Assess a reading against adult reference ranges.
 * BP: below 120/80 normal, 120-139 / 80-89 elevated, 140/90 and above high.
 * Sugar: fasting 70-99 normal; random / post meal below 140 normal; below 70 low.
 * HR 60-100, SpO2 95 and above, temperature 97-99.5 °F.
 */
export function vitalAssessment(
  kind: VitalKind,
  value: number | BpValue,
  opts: { sugarType?: SugarType } = {},
): VitalAssessment {
  switch (kind) {
    case "bp": {
      const { systolic, diastolic } =
        typeof value === "number" ? { systolic: value, diastolic: 0 } : value;
      if (systolic >= 140 || diastolic >= 90) return { level: "high", label: "High" };
      if (systolic >= 120 || diastolic >= 80) return { level: "high", label: "Elevated" };
      if (systolic < 90 || (diastolic > 0 && diastolic < 60)) return { level: "low", label: "Low" };
      return { level: "normal", label: "Normal" };
    }
    case "sugar": {
      const v = value as number;
      if (v < 70) return { level: "low", label: "Low" };
      const limit = opts.sugarType === "fasting" ? 100 : 140;
      if (v >= limit) return { level: "high", label: "High" };
      return { level: "normal", label: "Normal" };
    }
    case "heartRate": {
      const v = value as number;
      if (v < 60) return { level: "low", label: "Low" };
      if (v > 100) return { level: "high", label: "High" };
      return { level: "normal", label: "Normal" };
    }
    case "spo2": {
      const v = value as number;
      if (v < 95) return { level: "low", label: "Low" };
      return { level: "normal", label: "Normal" };
    }
    case "temperature": {
      const v = value as number;
      if (v < 97) return { level: "low", label: "Low" };
      if (v > 99.5) return { level: "high", label: v >= 100.4 ? "Fever" : "High" };
      return { level: "normal", label: "Normal" };
    }
  }
}

/** Shorthand returning just the level: "normal" | "high" | "low". */
export function vitalFlag(
  kind: VitalKind,
  value: number | BpValue,
  opts: { sugarType?: SugarType } = {},
): VitalLevel {
  return vitalAssessment(kind, value, opts).level;
}
