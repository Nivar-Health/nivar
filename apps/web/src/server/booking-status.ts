// Single source of truth for the booking status machine (MVP spec 4.1).
import type { Booking, BookingStatus, Role, UserSummary } from "@/lib/types";
import { HttpError } from "./errors";

export const BOOKING_STATUSES: BookingStatus[] = [
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
export const PAST_STATUSES: BookingStatus[] = ["completed", "cancelled"];
export const IN_PROGRESS_STATUSES: BookingStatus[] = ["en_route", "arrived", "testing", "consult", "reporting"];
export const CANCELLABLE_STATUSES: BookingStatus[] = ["pending_payment", "confirmed", "assigned", "en_route"];
export const CAPTURE_STATUSES: BookingStatus[] = ["arrived", "testing", "consult"];
export const REPORT_DRAFT_STATUSES: BookingStatus[] = ["testing", "consult", "reporting"];
export const REPORT_PUBLISH_STATUSES: BookingStatus[] = ["consult", "reporting"];
/** Statuses where a staff member is committed to a visit. */
export const STAFF_ACTIVE_STATUSES: BookingStatus[] = ["assigned", "en_route", "arrived", "testing", "consult", "reporting"];

export type Via = "pay" | "assign" | "status" | "report" | "cancel";
type Rule = { roles: Role[]; via: Via[] };
const T = (roles: Role[], via: Via[]): Rule => ({ roles, via });

const TRANSITIONS: Partial<Record<BookingStatus, Partial<Record<BookingStatus, Rule>>>> = {
  pending_payment: { confirmed: T(["customer"], ["pay"]) },
  confirmed: { assigned: T(["admin"], ["assign"]) },
  assigned: { assigned: T(["admin"], ["assign"]), en_route: T(["nurse", "admin"], ["status"]) },
  en_route: { arrived: T(["nurse", "admin"], ["status"]) },
  arrived: { testing: T(["nurse", "admin"], ["status"]) },
  testing: { consult: T(["nurse", "admin"], ["status"]) },
  consult: {
    reporting: T(["doctor", "nurse", "admin"], ["status"]),
    completed: T(["doctor"], ["report"]),
  },
  reporting: { completed: T(["doctor", "admin"], ["status", "report"]) },
};
for (const from of CANCELLABLE_STATUSES) {
  TRANSITIONS[from] = { ...TRANSITIONS[from], cancelled: T(["customer", "admin"], ["cancel", "status"]) };
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Payment pending",
  confirmed: "Confirmed",
  assigned: "Care team assigned",
  en_route: "Nurse on the way",
  arrived: "Nurse arrived",
  testing: "Tests in progress",
  consult: "Doctor consult",
  reporting: "Preparing report",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function nextStatuses(from: BookingStatus): BookingStatus[] {
  return Object.keys(TRANSITIONS[from] || {}) as BookingStatus[];
}

type Actor = { id: string; role: Role; name?: string };
type Ref = UserSummary | string | null | undefined;
export const idOf = (ref: Ref): string | null => (ref ? (typeof ref === "string" ? ref : ref.id) : null);

/** Whether `user` is a participant allowed to view/act on the booking at all. */
export function canAccessBooking(user: Actor | null, booking: Pick<Booking, "customer" | "nurse" | "doctor">): boolean {
  if (!user || !booking) return false;
  switch (user.role) {
    case "admin":
      return true;
    case "customer":
      return idOf(booking.customer) === user.id;
    case "nurse":
      return idOf(booking.nurse) === user.id;
    case "doctor":
      return idOf(booking.doctor) === user.id;
    default:
      return false;
  }
}

/**
 * Throws an HttpError (403/409) if `user` may not move `booking` to `to` through `via`.
 * Order of checks: participant access (403) -> transition validity (409) -> endpoint (409) -> role (403).
 */
export function assertTransition({ booking, to, user, via }: { booking: Booking; to: BookingStatus; user: Actor; via: Via }) {
  if (!BOOKING_STATUSES.includes(to)) throw new HttpError(400, `Unknown status "${to}"`, "invalid_status");
  if (!canAccessBooking(user, booking)) throw new HttpError(403, "This booking is not assigned to you", "not_assigned");
  const from = booking.status;
  const rule = TRANSITIONS[from]?.[to];
  if (!rule) {
    if (to === "cancelled") {
      throw new HttpError(409, `This booking can no longer be cancelled (it is ${STATUS_LABELS[from].toLowerCase()})`, "invalid_transition");
    }
    const next = nextStatuses(from);
    throw new HttpError(
      409,
      `Cannot move booking from "${from}" to "${to}"` + (next.length ? `. Allowed next: ${next.join(", ")}` : ""),
      "invalid_transition",
    );
  }
  if (!rule.via.includes(via)) {
    const hint: Record<Via, string> = { pay: "POST /pay", assign: "POST /assign", report: "publishing the report", cancel: "POST /cancel", status: "POST /status" };
    throw new HttpError(409, `Moving to "${to}" happens via ${rule.via.map((v) => hint[v]).join(" or ")}`, "invalid_transition");
  }
  if (!rule.roles.includes(user.role)) throw new HttpError(403, `A ${user.role} cannot move a booking to "${to}"`, "role_not_allowed");
  if (to === "completed" && via === "status" && !booking.report?.diagnosis) {
    throw new HttpError(409, "Publish the report before completing this booking", "report_missing");
  }
}

const firstName = (name = "") => name.replace(/^Dr\.?\s+/i, "").split(" ")[0];

/** Human-friendly default timeline note for a status change. */
export function defaultNote(
  status: BookingStatus,
  { nurse, doctor, actor, method }: { nurse?: { name?: string } | null; doctor?: { name?: string } | null; actor?: Actor; method?: string } = {},
): string {
  const methodLabel = ({ upi: "UPI", card: "card", netbanking: "net banking", cash: "cash" } as Record<string, string>)[method ?? ""] || method;
  switch (status) {
    case "pending_payment":
      return "Booking placed";
    case "confirmed":
      return `Payment received via ${methodLabel || "UPI"}`;
    case "assigned":
      return `${nurse?.name || "Your nurse"} assigned as your nurse, ${doctor?.name || "your doctor"} as your doctor`;
    case "en_route":
      return "Nurse is on the way";
    case "arrived":
      return `${firstName(nurse?.name) || "Nurse"} has arrived at your home`;
    case "testing":
      return "Tests in progress";
    case "consult":
      return `Video consult started with ${doctor?.name || "your doctor"}`;
    case "reporting":
      return `${doctor?.name || "Doctor"} is preparing your report`;
    case "completed":
      return "Report published";
    case "cancelled":
      return actor?.role === "admin" ? "Booking cancelled by Nivar" : "Booking cancelled";
    default:
      return STATUS_LABELS[status];
  }
}

export const roleLabel = (role: Role) => ({ customer: "Customer", nurse: "Nurse", doctor: "Doctor", admin: "Nivar Ops" })[role] || "Nivar";

/** Customer-facing notification copy for key status changes. */
export function customerNotice(status: BookingStatus, booking: Booking): { title: string; body: string } | null {
  const nurse = typeof booking.nurse === "object" ? booking.nurse?.name : undefined;
  const doctor = typeof booking.doctor === "object" ? booking.doctor?.name : undefined;
  switch (status) {
    case "assigned":
      return { title: "Your care team is ready", body: `${nurse} (nurse) and ${doctor} will take care of your visit.` };
    case "en_route":
      return { title: "Nurse is on the way", body: `${nurse} has started the trip to your home. Track live in the app.` };
    case "arrived":
      return { title: "Nurse has arrived", body: `${nurse} is at your door.` };
    case "consult":
      return { title: "Doctor consult starting", body: `${doctor} is ready. Tap to join the video consult.` };
    case "completed":
      return { title: "Your report is ready", body: `${doctor} has published your report and prescription.` };
    case "cancelled":
      return { title: "Booking cancelled", body: `Booking ${booking.code} has been cancelled.` };
    default:
      return null;
  }
}
