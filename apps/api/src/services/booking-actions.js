import { Booking, User } from '../models/index.js';
import { conflict } from '../lib/errors.js';
import { idOf } from '../lib/ids.js';
import { assertTransition, defaultNote } from './booking-status.js';
import { bookingPayload, loadBooking } from './booking-view.js';
import { emitBookingUpdated, notifyUsers, getIo, rooms } from '../realtime/index.js';

/** Re-read the booking, broadcast it and return the JSON payload. */
export async function publishBooking(bookingId) {
  const payload = await bookingPayload(bookingId);
  emitBookingUpdated(payload);
  return payload;
}

export function notifyAdmins({ title, body, bookingId }) {
  const io = getIo();
  if (io) io.to(rooms.admin).emit('notify', { title, body, ...(bookingId ? { bookingId: String(bookingId) } : {}) });
}

/**
 * Atomically move a booking from its current status to `to`.
 * Validates against the status machine, appends a timeline entry and applies extra `$set`s.
 * The update is conditional on the status not having changed since it was read (no lost updates).
 */
export async function transition(booking, to, { actor, via, note, set = {}, noteContext = {} }) {
  assertTransition({ booking, to, user: actor, via });
  const from = booking.status;
  const entry = {
    status: to,
    at: new Date(),
    by: actor.name || roleLabel(actor.role),
    note: note?.trim() || defaultNote(to, { booking, actor, ...noteContext }),
  };
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: from },
    { $set: { status: to, ...set }, $push: { timeline: entry } },
    { returnDocument: 'after' },
  );
  if (!updated) throw conflict('This booking was just updated by someone else. Please refresh and try again.', 'stale');
  return updated;
}

const roleLabel = (role) => ({ customer: 'Customer', nurse: 'Nurse', doctor: 'Doctor', admin: 'Nivar Ops' })[role] || 'Nivar';

/** Customer-facing notification copy for key status changes. */
export function customerNotice(status, booking) {
  const nurse = booking.nurse?.name;
  const doctor = booking.doctor?.name;
  switch (status) {
    case 'assigned':
      return { title: 'Your care team is ready', body: `${nurse} (nurse) and ${doctor} will take care of your visit.` };
    case 'en_route':
      return { title: 'Nurse is on the way', body: `${nurse} has started the trip to your home. Track live in the app.` };
    case 'arrived':
      return { title: 'Nurse has arrived', body: `${nurse} is at your door.` };
    case 'consult':
      return { title: 'Doctor consult starting', body: `${doctor} is ready. Tap to join the video consult.` };
    case 'completed':
      return { title: 'Your report is ready', body: `${doctor} has published your report and prescription.` };
    case 'cancelled':
      return { title: 'Booking cancelled', body: `Booking ${booking.code} has been cancelled.` };
    default:
      return null;
  }
}

/** Send notifications appropriate for a status change; `booking` is the populated JSON payload. */
export function notifyStatusChange(status, booking, actor) {
  const customerId = idOf(booking.customer);
  const notice = customerNotice(status, booking);
  if (notice && !(status === 'cancelled' && actor.role === 'customer')) {
    notifyUsers([customerId], { ...notice, bookingId: booking.id });
  }
  if (status === 'consult' && booking.doctor) {
    notifyUsers([booking.doctor], {
      title: 'Patient ready for consult',
      body: `${booking.patient?.name} (${booking.code}) is ready. Join the video consult.`,
      bookingId: booking.id,
    });
  }
  if (status === 'reporting' && booking.nurse && actor.role !== 'nurse') {
    notifyUsers([booking.nurse], { title: 'Consult ended', body: `${booking.code}: the doctor is preparing the report.`, bookingId: booking.id });
  }
  if (status === 'cancelled') {
    const staff = [booking.nurse, booking.doctor].filter(Boolean);
    if (staff.length) notifyUsers(staff, { title: 'Visit cancelled', body: `${booking.code} for ${booking.patient?.name} was cancelled.`, bookingId: booking.id });
    if (actor.role === 'customer') notifyAdmins({ title: 'Booking cancelled', body: `${booking.code} was cancelled by the customer.`, bookingId: booking.id });
  }
}

/** Shared cancel logic for POST /cancel and POST /status { status: "cancelled" }. */
export async function cancelBooking(bookingId, actor, reason) {
  const booking = await loadBooking(bookingId);
  const set = { cancelReason: reason?.trim() || undefined };
  if (booking.payment?.status === 'paid') set['payment.status'] = 'refunded';
  const note = reason?.trim() ? `${defaultNote('cancelled', { actor })}: ${reason.trim()}` : undefined;
  if (!set.cancelReason) delete set.cancelReason;
  await transition(booking, 'cancelled', { actor, via: 'cancel', note, set });
  const payload = await publishBooking(booking._id);
  notifyStatusChange('cancelled', payload, actor);
  return payload;
}

/** Fetch an active staff member of a given role or return null. */
export function findActiveStaff(id, role) {
  return User.findOne({ _id: id, role, isActive: true });
}
