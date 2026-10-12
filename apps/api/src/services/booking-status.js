// Single source of truth for the booking status machine (spec 4.1).
import { HttpError } from '../lib/errors.js';
import { sameId } from '../lib/ids.js';

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'assigned',
  'en_route',
  'arrived',
  'testing',
  'consult',
  'reporting',
  'completed',
  'cancelled',
];

/** The happy-path order, used for "active" vs "past" and stepper rendering. */
export const STATUS_ORDER = BOOKING_STATUSES.filter((s) => s !== 'cancelled');

export const ACTIVE_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'en_route', 'arrived', 'testing', 'consult', 'reporting'];
export const PAST_STATUSES = ['completed', 'cancelled'];
/** Statuses during which the visit is physically happening / in progress. */
export const IN_PROGRESS_STATUSES = ['en_route', 'arrived', 'testing', 'consult', 'reporting'];
/** A booking may be cancelled only before the nurse has arrived. */
export const CANCELLABLE_STATUSES = ['pending_payment', 'confirmed', 'assigned', 'en_route'];
/** Device / vitals capture window for the assigned nurse. */
export const CAPTURE_STATUSES = ['arrived', 'testing', 'consult'];
/** Doctor may save a report draft in these statuses. */
export const REPORT_DRAFT_STATUSES = ['testing', 'consult', 'reporting'];
/** Doctor may publish a report in these statuses. */
export const REPORT_PUBLISH_STATUSES = ['consult', 'reporting'];

/**
 * Allowed transitions. `roles` = who may perform it, `via` = which endpoint may trigger it:
 *  - pay: POST /bookings/:id/pay
 *  - assign: POST /bookings/:id/assign
 *  - status: POST /bookings/:id/status
 *  - report: PUT /bookings/:id/report with publish: true
 *  - cancel: POST /bookings/:id/cancel (also POST /status { status: "cancelled" })
 */
const T = (roles, via) => ({ roles, via });
const TRANSITIONS = {
  pending_payment: { confirmed: T(['customer'], ['pay']) },
  confirmed: { assigned: T(['admin'], ['assign']) },
  assigned: { assigned: T(['admin'], ['assign']), en_route: T(['nurse', 'admin'], ['status']) },
  en_route: { arrived: T(['nurse', 'admin'], ['status']) },
  arrived: { testing: T(['nurse', 'admin'], ['status']) },
  testing: { consult: T(['nurse', 'admin'], ['status']) },
  consult: {
    reporting: T(['doctor', 'nurse', 'admin'], ['status']),
    completed: T(['doctor'], ['report']),
  },
  reporting: { completed: T(['doctor', 'admin'], ['status', 'report']) },
};
for (const from of CANCELLABLE_STATUSES) {
  TRANSITIONS[from] = { ...TRANSITIONS[from], cancelled: T(['customer', 'admin'], ['cancel', 'status']) };
}

export const STATUS_LABELS = {
  pending_payment: 'Payment pending',
  confirmed: 'Confirmed',
  assigned: 'Care team assigned',
  en_route: 'Nurse on the way',
  arrived: 'Nurse arrived',
  testing: 'Tests in progress',
  consult: 'Doctor consult',
  reporting: 'Preparing report',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Statuses reachable from `from` (ignoring role), handy for UIs and error messages. */
export function nextStatuses(from) {
  return Object.keys(TRANSITIONS[from] || {});
}

/** Whether `user` is a participant allowed to view/act on the booking at all. */
export function canAccessBooking(user, booking) {
  if (!user || !booking) return false;
  switch (user.role) {
    case 'admin':
      return true;
    case 'customer':
      return sameId(booking.customer, user);
    case 'nurse':
      return sameId(booking.nurse, user);
    case 'doctor':
      return sameId(booking.doctor, user);
    default:
      return false;
  }
}

/**
 * Throws an HttpError (403/409) if `user` may not move `booking` to `to` through `via`.
 * Order of checks: participant access (403) -> transition validity (409) -> endpoint (409) -> role (403).
 */
export function assertTransition({ booking, to, user, via }) {
  if (!BOOKING_STATUSES.includes(to)) {
    throw new HttpError(400, `Unknown status "${to}"`, 'invalid_status');
  }
  if (!canAccessBooking(user, booking)) {
    throw new HttpError(403, 'This booking is not assigned to you', 'not_assigned');
  }
  const from = booking.status;
  const rule = TRANSITIONS[from]?.[to];
  if (!rule) {
    if (to === 'cancelled') {
      throw new HttpError(
        409,
        `This booking can no longer be cancelled (it is ${STATUS_LABELS[from].toLowerCase()})`,
        'invalid_transition',
      );
    }
    throw new HttpError(
      409,
      `Cannot move booking from "${from}" to "${to}"` +
        (nextStatuses(from).length ? `. Allowed next: ${nextStatuses(from).join(', ')}` : ''),
      'invalid_transition',
    );
  }
  if (!rule.via.includes(via)) {
    const hint = { pay: 'POST /pay', assign: 'POST /assign', report: 'publishing the report', cancel: 'POST /cancel', status: 'POST /status' };
    throw new HttpError(409, `Moving to "${to}" happens via ${rule.via.map((v) => hint[v]).join(' or ')}`, 'invalid_transition');
  }
  if (!rule.roles.includes(user.role)) {
    throw new HttpError(403, `A ${user.role} cannot move a booking to "${to}"`, 'role_not_allowed');
  }
  if (to === 'completed' && via === 'status' && !booking.report?.diagnosis) {
    throw new HttpError(409, 'Publish the report before completing this booking', 'report_missing');
  }
}

const firstName = (name = '') => name.replace(/^Dr\.?\s+/i, '').split(' ')[0];

/** Human-friendly default timeline note for a status change. */
export function defaultNote(status, { booking, nurse, doctor, actor, method } = {}) {
  const methodLabel = { upi: 'UPI', card: 'card', netbanking: 'net banking', cash: 'cash' }[method] || method;
  switch (status) {
    case 'pending_payment':
      return 'Booking placed';
    case 'confirmed':
      return `Payment received via ${methodLabel || 'UPI'}`;
    case 'assigned':
      return `${nurse?.name || 'Your nurse'} assigned as your nurse, ${doctor?.name || 'your doctor'} as your doctor`;
    case 'en_route':
      return 'Nurse is on the way';
    case 'arrived':
      return `${firstName(nurse?.name) || 'Nurse'} has arrived at your home`;
    case 'testing':
      return 'Tests in progress';
    case 'consult':
      return `Video consult started with ${doctor?.name || 'your doctor'}`;
    case 'reporting':
      return `${doctor?.name || 'Doctor'} is preparing your report`;
    case 'completed':
      return 'Report published';
    case 'cancelled':
      return actor?.role === 'admin' ? 'Booking cancelled by Nivar' : 'Booking cancelled';
    default:
      return booking ? STATUS_LABELS[status] : '';
  }
}
