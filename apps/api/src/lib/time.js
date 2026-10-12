// Date helpers pinned to India Standard Time (UTC+05:30, no DST).
const IST_OFFSET_MIN = 330;

/** { date: 'YYYY-MM-DD', minutes: minutes since IST midnight } for an instant. */
export function istParts(at = new Date()) {
  const shifted = new Date(at.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export const todayIST = (at = new Date()) => istParts(at).date;

/** Add `days` to a YYYY-MM-DD string. */
export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant of HH:MM IST on a YYYY-MM-DD date. */
export function istDateTime(dateStr, hhmm = '00:00') {
  return new Date(`${dateStr}T${hhmm}:00+05:30`);
}

export const isValidDateStr = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Hourly slots 07:00-08:00 ... 19:00-20:00. */
export const SLOTS = Array.from({ length: 13 }, (_, i) => {
  const h = 7 + i;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:00-${pad(h + 1)}:00`;
});

/** Same-day "nurse within 60 minutes" visit. Only bookable for today, never fills up. */
export const EXPRESS_SLOT = 'express';

export const slotStartMinutes = (slot) => {
  const [h, m] = slot.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

/** True when a slot on `date` has already started (IST). */
export function isSlotPast(date, slot, at = new Date()) {
  const now = istParts(at);
  if (slot === EXPRESS_SLOT) return date !== now.date;
  if (date < now.date) return true;
  if (date > now.date) return false;
  return slotStartMinutes(slot) <= now.minutes;
}
