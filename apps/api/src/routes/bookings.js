import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { Booking, Package, Service, User, nextBookingCode, PAYMENT_METHODS, RELATIONS, SERVICE_CODES } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addressInputSchema, dateSchema, genderSchema, objectIdSchema, slotSchema } from '../lib/schemas.js';
import { badRequest, conflict, forbidden } from '../lib/errors.js';
import { sameId } from '../lib/ids.js';
import { EXPRESS_SLOT, addDays, isSlotPast, todayIST } from '../lib/time.js';
import { areaCentroid } from '../lib/areas.js';
import { config } from '../config.js';
import {
  ACTIVE_STATUSES,
  BOOKING_STATUSES,
  CAPTURE_STATUSES,
  PAST_STATUSES,
  REPORT_DRAFT_STATUSES,
  REPORT_PUBLISH_STATUSES,
  STATUS_LABELS,
  canAccessBooking,
} from '../services/booking-status.js';
import { findBookings, loadBooking } from '../services/booking-view.js';
import {
  cancelBooking,
  findActiveStaff,
  notifyAdmins,
  notifyStatusChange,
  publishBooking,
  transition,
} from '../services/booking-actions.js';
import { notifyUsers } from '../realtime/index.js';

const router = Router();
router.use(requireAuth);

const MAX_ADVANCE_DAYS = 60;

/** Load a booking and ensure the current user may see it. */
async function loadForUser(req) {
  const booking = await loadBooking(req.params.id);
  if (!canAccessBooking(req.user, booking)) throw forbidden('You do not have access to this booking', 'not_assigned');
  return booking;
}

function assertAssigned(booking, user, role) {
  const ref = role === 'nurse' ? booking.nurse : booking.doctor;
  if (user.role !== role || !sameId(ref, user)) {
    throw forbidden(`Only the assigned ${role} can do this`, 'not_assigned');
  }
}

function assertStatusIn(booking, statuses, what) {
  if (!statuses.includes(booking.status)) {
    throw conflict(
      `${what} is only possible while the booking is ${statuses.map((s) => STATUS_LABELS[s].toLowerCase()).join(', ')} (currently ${STATUS_LABELS[booking.status].toLowerCase()})`,
      'invalid_state',
    );
  }
}

/**
 * Apply a field-level `$set` atomically, guarded on the status still being in `statuses`,
 * then broadcast. Avoids lost updates when status changes concurrently.
 */
async function guardedSet(booking, statuses, set, what) {
  const res = await Booking.updateOne({ _id: booking._id, status: { $in: statuses } }, { $set: set });
  if (!res.matchedCount) throw conflict(`${what} is no longer possible, the booking status changed`, 'stale');
  return publishBooking(booking._id);
}

// ---------- create ----------

const createSchema = z
  .object({
    patient: z.object({
      name: z.string().trim().min(1, 'Patient name is required').max(80),
      age: z.coerce.number().int().min(0).max(120),
      gender: genderSchema,
      relation: z.enum(RELATIONS).optional().default('self'),
    }),
    address: addressInputSchema,
    packageId: objectIdSchema.optional().nullable(),
    serviceCodes: z.array(z.enum(SERVICE_CODES)).optional().default([]),
    scheduledDate: dateSchema,
    slot: slotSchema,
    notes: z.string().trim().max(2000).optional().default(''),
  })
  .refine((b) => b.packageId || b.serviceCodes.length > 0, { message: 'Choose a package or at least one test', path: ['serviceCodes'] });

router.post('/', requireRole('customer'), validate(createSchema), async (req, res) => {
  const body = req.valid.body;
  const today = todayIST();
  if (body.scheduledDate < today) throw badRequest('Pick today or a future date', 'past_date');
  if (body.scheduledDate > addDays(today, MAX_ADVANCE_DAYS)) throw badRequest(`Bookings open up to ${MAX_ADVANCE_DAYS} days ahead`, 'too_far');
  if (body.slot === EXPRESS_SLOT) {
    if (body.scheduledDate !== today) throw badRequest('Express visits are only available for today', 'express_today_only');
  } else {
    if (isSlotPast(body.scheduledDate, body.slot)) throw conflict('That slot has already started, please pick a later one', 'slot_unavailable');
    const taken = await Booking.countDocuments({ scheduledDate: body.scheduledDate, slot: body.slot, status: { $ne: 'cancelled' } });
    if (taken >= config.slotCapacity) throw conflict('That slot just filled up, please pick another', 'slot_unavailable');
  }

  const services = await Service.find();
  const priceOf = Object.fromEntries(services.map((s) => [s.code, s.price]));

  let pkg = null;
  if (body.packageId) {
    pkg = await Package.findOne({ _id: body.packageId, isActive: true });
    if (!pkg) throw badRequest('That package is not available', 'invalid_package');
  }
  const codes = [...new Set([...(pkg?.serviceCodes || []), ...body.serviceCodes])].filter((c) => c in priceOf);
  if (!codes.length) throw badRequest('Choose at least one test', 'no_tests');
  // Package price covers its tests; any extra tests are added at list price.
  const extras = codes.filter((c) => !pkg?.serviceCodes.includes(c));
  const amount = (pkg?.price || 0) + extras.reduce((sum, c) => sum + priceOf[c], 0);

  const { id: addressId, ...addr } = body.address;
  const coords = typeof addr.lat === 'number' && typeof addr.lng === 'number' ? { lat: addr.lat, lng: addr.lng } : areaCentroid(addr.area);

  const booking = await Booking.create({
    code: await nextBookingCode(),
    customer: req.user._id,
    patient: body.patient,
    address: { ...addr, ...coords, ...(addressId ? { id: addressId } : {}) },
    packageId: pkg?._id,
    serviceCodes: SERVICE_CODES.filter((c) => codes.includes(c)),
    scheduledDate: body.scheduledDate,
    slot: body.slot,
    amount,
    notes: body.notes,
    status: 'pending_payment',
    payment: { status: 'pending' },
    timeline: [{ status: 'pending_payment', at: new Date(), by: req.user.name || 'Customer', note: 'Booking placed' }],
  });
  const payload = await publishBooking(booking._id);
  res.status(201).json({ booking: payload });
});

// ---------- pay ----------

router.post(
  '/:id/pay',
  requireRole('customer'),
  validate(z.object({ method: z.enum(PAYMENT_METHODS).optional().default('upi') })),
  async (req, res) => {
    const booking = await loadForUser(req);
    const { method } = req.valid.body;
    const now = new Date();
    const txnId = `NVPAY${now.getTime().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await transition(booking, 'confirmed', {
      actor: req.user,
      via: 'pay',
      noteContext: { method },
      set: { payment: { status: 'paid', method, txnId, paidAt: now } },
    });
    const payload = await publishBooking(booking._id);
    notifyAdmins({
      title: 'New booking',
      body: `${payload.code} · ${payload.patient.name} · ${payload.scheduledDate} ${payload.slot} needs a care team`,
      bookingId: payload.id,
    });
    res.json({ booking: payload });
  },
);

// ---------- list / detail ----------

const listSchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []))
    .refine((arr) => arr.every((s) => BOOKING_STATUSES.includes(s)), 'Unknown status'),
  date: dateSchema.optional(),
  scope: z.enum(['active', 'past']).optional(),
});

router.get('/', validate(listSchema, 'query'), async (req, res) => {
  const { status, date, scope } = req.valid.query;
  const filter = {};
  const u = req.user;
  if (u.role === 'customer') filter.customer = u._id;
  else if (u.role === 'nurse') filter.nurse = u._id;
  else if (u.role === 'doctor') filter.doctor = u._id;

  let statuses = status.length ? status : null;
  if (scope) {
    const scoped = scope === 'active' ? ACTIVE_STATUSES : PAST_STATUSES;
    statuses = statuses ? statuses.filter((s) => scoped.includes(s)) : scoped;
  }
  if (statuses) filter.status = { $in: statuses };
  if (date) filter.scheduledDate = date;

  const bookings = await findBookings(filter);
  res.json({ bookings: bookings.map((b) => b.toJSON()) });
});

router.get('/:id', async (req, res) => {
  const booking = await loadForUser(req);
  res.json({ booking: booking.toJSON() });
});

// ---------- assign ----------

router.post(
  '/:id/assign',
  requireRole('admin'),
  validate(z.object({ nurseId: objectIdSchema, doctorId: objectIdSchema })),
  async (req, res) => {
    const booking = await loadBooking(req.params.id);
    const { nurseId, doctorId } = req.valid.body;
    const [nurse, doctor] = await Promise.all([findActiveStaff(nurseId, 'nurse'), findActiveStaff(doctorId, 'doctor')]);
    if (!nurse) throw badRequest('Select an active nurse', 'invalid_nurse');
    if (!doctor) throw badRequest('Select an active doctor', 'invalid_doctor');

    const prevNurse = booking.nurse?._id?.toString();
    const prevDoctor = booking.doctor?._id?.toString();
    await transition(booking, 'assigned', {
      actor: req.user,
      via: 'assign',
      noteContext: { nurse, doctor },
      set: { nurse: nurse._id, doctor: doctor._id },
    });
    const payload = await publishBooking(booking._id);

    const when = `${payload.scheduledDate}, ${payload.slot}`;
    const where = payload.address?.area || payload.address?.city || '';
    const newStaff = [];
    if (prevNurse !== nurse.id) newStaff.push(nurse._id);
    if (prevDoctor !== doctor.id) newStaff.push(doctor._id);
    notifyUsers(newStaff, {
      title: 'New visit assigned',
      body: `${payload.code} · ${payload.patient.name}${where ? `, ${where}` : ''} · ${when}`,
      bookingId: payload.id,
    });
    const removed = [prevNurse !== nurse.id && prevNurse, prevDoctor !== doctor.id && prevDoctor].filter(Boolean);
    notifyUsers(removed, { title: 'Visit reassigned', body: `${payload.code} has been reassigned to a colleague.` });
    notifyStatusChange('assigned', payload, req.user);
    res.json({ booking: payload });
  },
);

// ---------- status ----------

router.post(
  '/:id/status',
  requireRole('nurse', 'doctor', 'admin', 'customer'),
  validate(z.object({ status: z.enum(BOOKING_STATUSES), note: z.string().trim().max(500).optional() })),
  async (req, res) => {
    const { status, note } = req.valid.body;
    if (status === 'cancelled') {
      const booking = await loadForUser(req);
      return res.json({ booking: await cancelBooking(booking._id, req.user, note) });
    }
    if (req.user.role === 'customer') throw forbidden('Customers cannot change the visit status', 'role_not_allowed');
    const booking = await loadForUser(req);

    const set = {};
    if (status === 'en_route' && !booking.nurseLocation?.lat && booking.nurse) {
      const base = (await User.findById(booking.nurse._id).select('baseLocation'))?.baseLocation;
      if (base?.lat != null) set.nurseLocation = { lat: base.lat, lng: base.lng, updatedAt: new Date() };
    }
    if (status === 'completed' && booking.report && !booking.report.publishedAt) set['report.publishedAt'] = new Date();

    await transition(booking, status, {
      actor: req.user,
      via: 'status',
      note,
      set,
      noteContext: { nurse: booking.nurse, doctor: booking.doctor },
    });
    const payload = await publishBooking(booking._id);
    notifyStatusChange(status, payload, req.user);
    res.json({ booking: payload });
  },
);

// ---------- clinical data ----------

const num = (min, max) => z.number().min(min).max(max);
const vitalsSchema = z
  .object({
    bpSystolic: num(50, 260).nullable(),
    bpDiastolic: num(30, 180).nullable(),
    sugar: num(20, 700).nullable(),
    sugarType: z.enum(['fasting', 'random', 'pp']).nullable(),
    heartRate: num(20, 250).nullable(),
    spo2: num(50, 100).nullable(),
    temperatureF: num(90, 110).nullable(),
    weightKg: num(1, 300).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one vital');

router.put('/:id/vitals', requireRole('nurse'), validate(vitalsSchema), async (req, res) => {
  const booking = await loadForUser(req);
  assertAssigned(booking, req.user, 'nurse');
  assertStatusIn(booking, CAPTURE_STATUSES, 'Recording vitals');
  // Partial update: numbers are set, explicit nulls clear the field.
  const set = { 'vitals.recordedAt': new Date() };
  const unset = {};
  for (const [k, v] of Object.entries(req.valid.body)) {
    if (v === null) unset[`vitals.${k}`] = '';
    else set[`vitals.${k}`] = v;
  }
  const res2 = await Booking.updateOne(
    { _id: booking._id, status: { $in: CAPTURE_STATUSES } },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
  );
  if (!res2.matchedCount) throw conflict('Recording vitals is no longer possible, the booking status changed', 'stale');
  res.json({ booking: await publishBooking(booking._id) });
});

function interpretEcg(hr) {
  if (!hr) return { rhythm: 'Sinus rhythm', interpretation: 'Rhythm captured; awaiting doctor review' };
  if (hr < 60) return { rhythm: 'Sinus bradycardia', interpretation: `Sinus bradycardia at ${Math.round(hr)} bpm. Regular rhythm, no acute ST changes.` };
  if (hr > 100) return { rhythm: 'Sinus tachycardia', interpretation: `Sinus tachycardia at ${Math.round(hr)} bpm. Regular rhythm, no acute ST changes.` };
  return { rhythm: 'Normal sinus rhythm', interpretation: `Normal sinus rhythm at ${Math.round(hr)} bpm. Normal axis, no acute ST-T changes.` };
}

const samplesSchema = z.array(z.number().finite()).min(1).max(20000);

router.put(
  '/:id/ecg',
  requireRole('nurse'),
  validate(
    z.object({
      samples: samplesSchema,
      sampleRate: z.number().int().min(50).max(2000).optional().default(250),
      heartRate: num(20, 250).optional(),
      rhythm: z.string().trim().max(120).optional(),
      interpretation: z.string().trim().max(500).optional(),
    }),
  ),
  async (req, res) => {
    const booking = await loadForUser(req);
    assertAssigned(booking, req.user, 'nurse');
    assertStatusIn(booking, CAPTURE_STATUSES, 'Capturing an ECG');
    const b = req.valid.body;
    const auto = interpretEcg(b.heartRate);
    const ecg = {
      samples: b.samples,
      sampleRate: b.sampleRate,
      heartRate: b.heartRate,
      rhythm: b.rhythm || auto.rhythm,
      interpretation: b.interpretation || auto.interpretation,
      capturedAt: new Date(),
    };
    res.json({ booking: await guardedSet(booking, CAPTURE_STATUSES, { ecg }, 'Capturing an ECG') });
  },
);

router.put(
  '/:id/stethoscope',
  requireRole('nurse'),
  validate(
    z.object({
      heartRate: num(20, 250).optional(),
      findings: z.string().trim().max(1000).optional().default('S1 S2 heard, no murmurs'),
      samples: samplesSchema.optional().default([]),
    }),
  ),
  async (req, res) => {
    const booking = await loadForUser(req);
    assertAssigned(booking, req.user, 'nurse');
    assertStatusIn(booking, CAPTURE_STATUSES, 'Capturing stethoscope audio');
    const stethoscope = { ...req.valid.body, capturedAt: new Date() };
    res.json({ booking: await guardedSet(booking, CAPTURE_STATUSES, { stethoscope }, 'Capturing stethoscope audio') });
  },
);

const reportSchema = z.object({
  diagnosis: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(5000).optional(),
  prescription: z
    .array(
      z.object({
        medicine: z.string().trim().min(1, 'Medicine name is required').max(200),
        dosage: z.string().trim().max(100).optional().default(''),
        frequency: z.string().trim().max(100).optional().default(''),
        duration: z.string().trim().max(100).optional().default(''),
        notes: z.string().trim().max(500).optional().default(''),
      }),
    )
    .max(30)
    .optional(),
  advice: z.array(z.string().trim().max(500)).max(30).optional(),
  followUp: z.string().trim().max(500).optional(),
  publish: z.boolean().optional().default(false),
});

router.put('/:id/report', requireRole('doctor'), validate(reportSchema), async (req, res) => {
  const booking = await loadForUser(req);
  assertAssigned(booking, req.user, 'doctor');
  const { publish, ...fields } = req.valid.body;
  if (fields.advice) fields.advice = fields.advice.filter(Boolean);

  const set = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) set[`report.${k}`] = v;

  if (!publish) {
    assertStatusIn(booking, REPORT_DRAFT_STATUSES, 'Editing the report');
    if (!Object.keys(set).length) throw badRequest('Nothing to save', 'empty_report');
    return res.json({ booking: await guardedSet(booking, REPORT_DRAFT_STATUSES, set, 'Editing the report') });
  }

  assertStatusIn(booking, REPORT_PUBLISH_STATUSES, 'Publishing the report');
  const diagnosis = fields.diagnosis ?? booking.report?.diagnosis;
  if (!diagnosis) throw badRequest('Add a diagnosis before publishing', 'diagnosis_required');
  set['report.publishedAt'] = new Date();
  await transition(booking, 'completed', { actor: req.user, via: 'report', set });
  const payload = await publishBooking(booking._id);
  notifyStatusChange('completed', payload, req.user);
  res.json({ booking: payload });
});

// ---------- cancel / rate ----------

router.post(
  '/:id/cancel',
  requireRole('customer', 'admin'),
  validate(z.object({ reason: z.string().trim().max(500).optional() })),
  async (req, res) => {
    const booking = await loadForUser(req);
    res.json({ booking: await cancelBooking(booking._id, req.user, req.valid.body.reason) });
  },
);

router.post(
  '/:id/rate',
  requireRole('customer'),
  validate(z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional().default('') })),
  async (req, res) => {
    const booking = await loadForUser(req);
    if (booking.status !== 'completed') throw conflict('You can rate a visit once it is completed', 'invalid_state');
    const { score, comment } = req.valid.body;
    const payload = await guardedSet(booking, ['completed'], { rating: { score, comment, ratedAt: new Date() } }, 'Rating');
    if (payload.nurse || payload.doctor) {
      notifyUsers([payload.nurse, payload.doctor].filter(Boolean), {
        title: `New ${score}★ rating`,
        body: `${payload.patient.name} rated visit ${payload.code}${comment ? `: "${comment}"` : ''}`,
        bookingId: payload.id,
      });
    }
    res.json({ booking: payload });
  },
);

export default router;
