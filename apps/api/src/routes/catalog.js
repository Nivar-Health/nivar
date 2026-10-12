import { Router } from 'express';
import { z } from 'zod';
import { Booking, Package, Service } from '../models/index.js';
import { validate } from '../middleware/validate.js';
import { dateSchema } from '../lib/schemas.js';
import { EXPRESS_SLOT, SLOTS, isSlotPast, todayIST } from '../lib/time.js';
import { config } from '../config.js';

const router = Router();

router.get('/catalog', async (_req, res) => {
  const [services, packages] = await Promise.all([
    Service.find().sort({ sortOrder: 1, code: 1 }),
    Package.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }),
  ]);
  res.json({ services: services.map((s) => s.toJSON()), packages: packages.map((p) => p.toJSON()) });
});

export async function slotAvailability(date) {
  const counts = await Booking.aggregate([
    { $match: { scheduledDate: date, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$slot', n: { $sum: 1 } } },
  ]);
  const bySlot = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const hourly = SLOTS.map((slot) => ({
    slot,
    available: !isSlotPast(date, slot) && (bySlot[slot] || 0) < config.slotCapacity,
  }));
  return date === todayIST() ? [{ slot: EXPRESS_SLOT, available: true, express: true }, ...hourly] : hourly;
}

router.get('/slots', validate(z.object({ date: dateSchema }), 'query'), async (req, res) => {
  const { date } = req.valid.query;
  res.json({ date, slots: await slotAvailability(date) });
});

export default router;
