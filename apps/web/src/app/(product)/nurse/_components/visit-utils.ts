import { Activity, Droplet, Gauge, HeartPulse, Stethoscope, Video, Wind, type LucideIcon } from "lucide-react";
import { EXPRESS_SLOT } from "@/lib/format";
import type { Booking, BookingStatus, Gender, ServiceCode } from "@/lib/types";

export const TEST_META: Record<ServiceCode, { label: string; short: string; icon: LucideIcon }> = {
  BP: { label: "Blood pressure", short: "BP", icon: Gauge },
  ECG: { label: "Smart ECG", short: "ECG", icon: Activity },
  SUGAR: { label: "Blood sugar", short: "Sugar", icon: Droplet },
  HR: { label: "Heart rate", short: "Heart rate", icon: HeartPulse },
  SPO2: { label: "Oxygen saturation", short: "SpO2", icon: Wind },
  STETH: {
    label: "Smart stethoscope",
    short: "Stethoscope",
    icon: Stethoscope,
  },
  CONSULT: { label: "Doctor video consult", short: "Consult", icon: Video },
};

/** Tests the nurse performs (everything except the doctor consult). */
export function nurseTests(codes: ServiceCode[]): ServiceCode[] {
  return codes.filter((c) => c !== "CONSULT");
}

const GENDER_LABEL: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

/** "58 yrs, Male" */
export function ageGender(p: Booking["patient"]): string {
  return [p.age != null ? `${p.age} yrs` : null, p.gender ? GENDER_LABEL[p.gender] : null].filter(Boolean).join(", ");
}

/** Statuses where the visit is underway (the nurse is working on it). */
export const ONGOING: BookingStatus[] = ["en_route", "arrived", "testing", "consult"];
/** Statuses where the nurse's part is finished. */
export const NURSE_DONE: BookingStatus[] = ["reporting", "completed"];

/** Sort key for a slot: express first, then by start time. */
export function slotSortKey(slot: string): string {
  return slot === EXPRESS_SLOT ? "00:00" : slot;
}

export function compareVisits(a: Booking, b: Booking): number {
  if (a.scheduledDate !== b.scheduledDate) return a.scheduledDate < b.scheduledDate ? -1 : 1;
  const sa = slotSortKey(a.slot);
  const sb = slotSortKey(b.slot);
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

/** "9:00 AM" for the start of a slot, or "Express". */
export function slotStart(slot: string): string {
  if (slot === EXPRESS_SLOT) return "Express";
  const m = /^(\d{1,2}):(\d{2})/.exec(slot);
  if (!m) return slot;
  const h = Number(m[1]);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m[2]} ${period}`;
}

/** Whether a nurse-side reading exists for a test code. */
export function testDone(booking: Booking, code: ServiceCode): boolean {
  const v = booking.vitals ?? {};
  switch (code) {
    case "BP":
      return v.bpSystolic != null && v.bpDiastolic != null;
    case "SUGAR":
      return v.sugar != null;
    case "HR":
      return v.heartRate != null;
    case "SPO2":
      return v.spo2 != null;
    case "ECG":
      return Boolean(booking.ecg?.capturedAt);
    case "STETH":
      return Boolean(booking.stethoscope?.capturedAt);
    case "CONSULT":
      return true;
  }
}

export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function addressLine(a: Booking["address"]): string {
  return [a.line1, a.area, a.city, a.pincode].filter(Boolean).join(", ");
}
