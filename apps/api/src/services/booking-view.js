import { Booking, PUBLIC_USER_FIELDS } from '../models/index.js';
import { isObjectId } from '../lib/ids.js';
import { notFound } from '../lib/errors.js';

const POPULATE = ['customer', 'nurse', 'doctor'].map((path) => ({ path, select: PUBLIC_USER_FIELDS }));

/** Heavy sample arrays are left out of list responses; detail responses include them. */
export const LIST_EXCLUDE = '-ecg.samples -stethoscope.samples';

/** Load a booking with customer/nurse/doctor populated (public fields only). Throws 404. */
export async function loadBooking(id) {
  if (!isObjectId(String(id))) throw notFound('Booking not found');
  const booking = await Booking.findById(id).populate(POPULATE);
  if (!booking) throw notFound('Booking not found');
  return booking;
}

/** Plain JSON shape shared by REST responses and `booking:updated` socket payloads. */
export async function bookingPayload(id) {
  const booking = await loadBooking(id);
  return booking.toJSON();
}

export function findBookings(filter, { lite = true } = {}) {
  const q = Booking.find(filter).populate(POPULATE).sort({ scheduledDate: 1, slot: 1, createdAt: 1 });
  return lite ? q.select(LIST_EXCLUDE) : q;
}
