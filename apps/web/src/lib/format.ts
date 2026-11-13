import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CircleCheck,
  CircleX,
  CreditCard,
  FileHeart,
  FilePenLine,
  House,
  Navigation,
  TrendingUp,
  UserRoundCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus, ServiceCode, SugarType } from "@/lib/types";
import { addDays, todayIST } from "@/server/time";

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
//
// Every visit happens in India, so every date and time reads in India time (UTC+05:30, no daylight
// saving) whatever the device's own zone: a son booking from London sees the same "Today, 9:00 AM"
// as the nurse at the door.
// ---------------------------------------------------------------------------

type DateInput = string | number | Date | null | undefined;

const IST_OFFSET_MS = 330 * 60_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d =
    input instanceof Date
      ? input
      : typeof input === "number"
        ? new Date(input)
        : // A date with no time is that calendar day in India.
          DATE_ONLY.test(input)
          ? new Date(`${input}T00:00:00+05:30`)
          : parseISO(input);
  return isValid(d) ? d : null;
}

/** The calendar and clock fields of an instant, as read in India. */
function india(d: Date) {
  const s = new Date(d.getTime() + IST_OFFSET_MS);
  const month = MONTHS[s.getUTCMonth()];
  const weekday = WEEKDAYS[s.getUTCDay()];
  return {
    year: s.getUTCFullYear(),
    month: month.slice(0, 3),
    monthLong: month,
    day: s.getUTCDate(),
    weekday: weekday.slice(0, 3),
    weekdayLong: weekday,
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
  };
}

function clock(hour: number, minute: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

/** "Mon, 12 Oct" (adds the year when it is not the current year). */
export function formatDate(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const f = india(d);
  return f.year === india(new Date()).year ? `${f.weekday}, ${f.day} ${f.month}` : `${f.day} ${f.month} ${f.year}`;
}

/** "12 Oct 2026" */
export function formatDateLong(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const f = india(d);
  return `${f.day} ${f.month} ${f.year}`;
}

/** "Monday, 12 October" */
export function formatDayLong(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const f = india(d);
  return `${f.weekdayLong}, ${f.day} ${f.monthLong}`;
}

/** The short weekday and the day of a date, for a date strip: { weekday: "Mon", day: "12 Oct" }. */
export function formatDayParts(input: DateInput): { weekday: string; day: string } {
  const d = toDate(input);
  if (!d) return { weekday: "", day: "" };
  const f = india(d);
  return { weekday: f.weekday, day: `${f.day} ${f.month}` };
}

/** "9:42 AM" */
export function formatTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const f = india(d);
  return clock(f.hour, f.minute);
}

/** "12 Oct, 9:42 AM" (adds the year when it is not the current year). */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const f = india(d);
  const year = f.year === india(new Date()).year ? "" : ` ${f.year}`;
  return `${f.day} ${f.month}${year}, ${clock(f.hour, f.minute)}`;
}

/** "12 Oct 2026, 9:42 AM": always with the year, for records such as the medical report. */
export function formatDateTimeLong(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const f = india(d);
  return `${f.day} ${f.month} ${f.year}, ${clock(f.hour, f.minute)}`;
}

/** "5 minutes ago", "in 2 hours". */
export function relative(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  if (Math.abs(Date.now() - d.getTime()) < 45_000) return "just now";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** "Today", "Tomorrow", "Yesterday" or "Wed, 14 Oct", by India's calendar. */
export function dayLabel(input: DateInput): string {
  const d = toDate(input);
  if (!d) return "";
  const day = todayIST(d);
  const today = todayIST();
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return formatDate(d);
}

/** Today's date in India as YYYY-MM-DD, the form `scheduledDate` uses. */
export function todayISO(): string {
  return todayIST();
}

/** True when the device's own clock is on India time, so times need no "India time" note. */
export function deviceOnIndiaTime(): boolean {
  return new Date().getTimezoneOffset() === -330;
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

/** Same-day visit by the next available nurse (API slot value). No arrival time is promised. */
export const EXPRESS_SLOT = "express";

/**
 * How the same-day visit reads to patients. `title` and `note` name the choice while booking;
 * `label` stands where a time slot would ("Today, Earliest available").
 */
export const EARLIEST_VISIT = {
  title: "Earliest today",
  note: "The next available nurse",
  label: "Earliest available",
} as const;

/** "09:00-10:00" -> "9:00 - 10:00 AM"; "11:00-12:00" -> "11:00 AM - 12:00 PM". */
export function slotLabel(slot: string | null | undefined): string {
  if (!slot) return "";
  if (slot === EXPRESS_SLOT) return EARLIEST_VISIT.label;
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
  /** Pill classes (background, text, ring). Pills are neutral; the dot carries the colour. */
  badgeClass: string;
  /** Dot colour as a text-* class (use with `bg-current` or `live-dot`). */
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
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-saffron",
    textClass: "text-saffron",
    step: 0,
    live: false,
  },
  confirmed: {
    patientLabel: "Confirmed",
    patientDescription: "Booking confirmed. We are assigning your nurse and doctor.",
    staffLabel: "Needs assignment",
    icon: CircleCheck,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-saffron",
    textClass: "text-saffron",
    step: 1,
    live: false,
  },
  assigned: {
    patientLabel: "Care team assigned",
    patientDescription: "Your nurse and doctor are assigned for this visit.",
    staffLabel: "Assigned",
    icon: UserRoundCheck,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-foreground",
    textClass: "text-foreground",
    step: 2,
    live: false,
  },
  en_route: {
    patientLabel: "Nurse on the way",
    patientDescription: "Your nurse is on the way. Track them live on the map.",
    staffLabel: "En route",
    icon: Navigation,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-signal",
    textClass: "text-success",
    step: 3,
    live: true,
  },
  arrived: {
    patientLabel: "Nurse arrived",
    patientDescription: "Your nurse has arrived and is setting up.",
    staffLabel: "Arrived",
    icon: House,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-signal",
    textClass: "text-success",
    step: 4,
    live: true,
  },
  testing: {
    patientLabel: "Tests in progress",
    patientDescription: "Your nurse is taking your readings. They appear here as they are taken.",
    staffLabel: "Testing",
    icon: Activity,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-signal",
    textClass: "text-success",
    step: 5,
    live: true,
  },
  consult: {
    patientLabel: "Doctor's video call",
    patientDescription: "Your doctor is ready. Join the video call.",
    staffLabel: "In consult",
    icon: Video,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-signal",
    textClass: "text-success",
    step: 6,
    live: true,
  },
  reporting: {
    patientLabel: "Preparing report",
    patientDescription: "Your doctor is preparing your report.",
    staffLabel: "Reporting",
    icon: FilePenLine,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-foreground",
    textClass: "text-foreground",
    step: 7,
    live: true,
  },
  completed: {
    patientLabel: "Report ready",
    patientDescription: "Your report is ready.",
    staffLabel: "Completed",
    icon: BadgeCheck,
    badgeClass: "bg-background text-foreground ring-border",
    dotClass: "text-success",
    textClass: "text-success",
    step: 8,
    live: false,
  },
  cancelled: {
    patientLabel: "Cancelled",
    patientDescription: "This booking was cancelled.",
    staffLabel: "Cancelled",
    icon: CircleX,
    badgeClass: "bg-background text-muted-foreground ring-border",
    dotClass: "text-danger",
    textClass: "text-danger",
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
  { status: "consult", label: "Consult", longLabel: "Video call with the doctor", icon: Video },
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
  spo2: { label: "Oxygen level (SpO2)", unit: "%", normalRange: "95-100" },
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
  normal: { label: "Normal", className: "bg-background text-foreground ring-border", dotClass: "bg-success" },
  high: { label: "High", className: "bg-background text-danger ring-danger/30", dotClass: "bg-danger" },
  low: { label: "Low", className: "bg-background text-saffron ring-saffron/35", dotClass: "bg-saffron" },
};

/** Classes for a vital assessment; "Elevated" BP gets a softer amber tone than "High". */
export function vitalToneClass(a: VitalAssessment): string {
  if (a.label === "Elevated") return "bg-background text-saffron ring-saffron/35";
  return VITAL_LEVEL_META[a.level].className;
}

/** The shape that goes with a reading's word, so its status never rests on colour alone. */
export function vitalShape(a: VitalAssessment): LucideIcon {
  if (a.level === "normal") return CircleCheck;
  if (a.level === "low") return ArrowDown;
  return a.label === "Elevated" ? TrendingUp : ArrowUp;
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

// ---------------------------------------------------------------------------
// Tests and prescriptions, in plain words
// ---------------------------------------------------------------------------

/** What each catalogue test is called for patients: the plain word first, the term in brackets. */
export const TEST_NAME: Record<ServiceCode, string> = {
  BP: "Blood pressure",
  ECG: "Heart tracing (ECG)",
  SUGAR: "Blood sugar",
  HR: "Heart rate",
  SPO2: "Oxygen level (SpO2)",
  STETH: "Heart and lung sounds",
  CONSULT: "Video call with the doctor",
};

/** The plain name of a test; a code this list does not know shows as itself. */
export function testName(code: string): string {
  return Object.hasOwn(TEST_NAME, code) ? TEST_NAME[code as ServiceCode] : code;
}

/**
 * "4 checks + doctor's video call", "1 check", "Doctor's video call". The video call is never
 * counted as a check, as on the public site.
 */
export function checksLabel(codes: readonly string[]): string {
  const checks = codes.filter((c) => c !== "CONSULT").length;
  const call = codes.includes("CONSULT");
  if (checks === 0) return call ? "Doctor's video call" : "";
  return `${checks} check${checks === 1 ? "" : "s"}${call ? " + doctor's video call" : ""}`;
}

/** The frequency codes the doctor's prescription editor stores, in its own plain words. */
const FREQUENCY_WORDS: Record<string, string> = {
  OD: "Once a day",
  BD: "Twice a day",
  TDS: "Three times a day",
  HS: "At bedtime",
  SOS: "When needed",
};

/** "BD" -> "Twice a day (BD)". Anything else the doctor wrote is shown as written. */
export function frequencyInWords(frequency: string | null | undefined): string {
  const raw = (frequency ?? "").trim();
  const code = raw.toUpperCase();
  return Object.hasOwn(FREQUENCY_WORDS, code) ? `${FREQUENCY_WORDS[code]} (${code})` : raw;
}
