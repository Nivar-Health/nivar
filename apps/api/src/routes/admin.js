import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Booking, Lead, Package, Service, User, SERVICE_CODES } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { badRequest, notFound } from '../lib/errors.js';
import { isObjectId } from '../lib/ids.js';
import { phoneSchema } from '../lib/schemas.js';
import { addDays, todayIST } from '../lib/time.js';
import { config } from '../config.js';
import { BOOKING_STATUSES, IN_PROGRESS_STATUSES } from '../services/booking-status.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/** Statuses where a staff member is committed to a visit. */
const STAFF_ACTIVE_STATUSES = ['assigned', 'en_route', 'arrived', 'testing', 'consult', 'reporting'];
const TZ = config.timeZone;
const istDay = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });
const PAID = { 'payment.status': 'paid', status: { $ne: 'cancelled' } };

// ---------- stats ----------

router.get('/stats', async (_req, res) => {
  const today = todayIST();
  const monthPrefix = today.slice(0, 7);
  const from7 = addDays(today, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from7, i));

  const [todayAgg, revenueAgg, statusAgg, createdAgg, paidAgg, customers, nurses, doctors] = await Promise.all([
    Booking.aggregate([
      { $match: { scheduledDate: today, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          bookings: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $in: ['$status', IN_PROGRESS_STATUSES] }, 1, 0] } },
        },
      },
    ]),
    Booking.aggregate([
      { $match: PAID },
      { $addFields: { paidDay: istDay('$payment.paidAt') } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          today: { $sum: { $cond: [{ $eq: ['$paidDay', today] }, '$amount', 0] } },
          month: { $sum: { $cond: [{ $eq: [{ $substrCP: ['$paidDay', 0, 7] }, monthPrefix] }, '$amount', 0] } },
        },
      },
    ]),
    Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $addFields: { day: istDay('$createdAt') } },
      { $match: { day: { $gte: from7, $lte: today } } },
      { $group: { _id: '$day', n: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: PAID },
      { $addFields: { day: istDay('$payment.paidAt') } },
      { $match: { day: { $gte: from7, $lte: today } } },
      { $group: { _id: '$day', revenue: { $sum: '$amount' } } },
    ]),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'nurse', isActive: true }),
    User.countDocuments({ role: 'doctor', isActive: true }),
  ]);

  const t = todayAgg[0] || {};
  const r = revenueAgg[0] || {};
  const statusBreakdown = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0]));
  for (const { _id, n } of statusAgg) statusBreakdown[_id] = n;
  const created = Object.fromEntries(createdAgg.map((d) => [d._id, d.n]));
  const paid = Object.fromEntries(paidAgg.map((d) => [d._id, d.revenue]));

  res.json({
    today: { bookings: t.bookings || 0, completed: t.completed || 0, inProgress: t.inProgress || 0 },
    revenue: { today: r.today || 0, month: r.month || 0, total: r.total || 0 },
    counts: { customers, nurses, doctors },
    statusBreakdown,
    last7Days: days.map((date) => ({ date, bookings: created[date] || 0, revenue: paid[date] || 0 })),
  });
});

// ---------- staff ----------

const STAFF_ROLES = ['nurse', 'doctor', 'admin'];

async function withActiveCounts(users) {
  const ids = users.map((u) => u._id);
  const agg = await Booking.aggregate([
    { $match: { status: { $in: STAFF_ACTIVE_STATUSES }, $or: [{ nurse: { $in: ids } }, { doctor: { $in: ids } }] } },
    { $project: { people: ['$nurse', '$doctor'] } },
    { $unwind: '$people' },
    { $match: { people: { $in: ids } } },
    { $group: { _id: '$people', n: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(agg.map((a) => [a._id.toString(), a.n]));
  return users.map((u) => ({ ...u.toJSON(), activeBookings: counts[u._id.toString()] || 0 }));
}

router.get(
  '/staff',
  validate(z.object({ role: z.enum(STAFF_ROLES).optional() }), 'query'),
  async (req, res) => {
    const { role } = req.valid.query;
    const users = await User.find({ role: role ? role : { $in: ['nurse', 'doctor'] } }).sort({ isActive: -1, name: 1 });
    res.json({ staff: await withActiveCounts(users) });
  },
);

const staffFields = {
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  role: z.enum(STAFF_ROLES),
  phone: phoneSchema.optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  specialization: z.string().trim().max(120).optional(),
  qualifications: z.string().trim().max(200).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  registrationNo: z.string().trim().max(60).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  baseLocation: z.object({ lat: z.number(), lng: z.number(), label: z.string().trim().max(80).optional() }).optional(),
};

router.post('/staff', validate(z.object(staffFields)), async (req, res) => {
  const { password, ...data } = req.valid.body;
  const user = await User.create({ ...data, passwordHash: await bcrypt.hash(password, 10), isActive: true });
  const [staff] = await withActiveCounts([user]);
  res.status(201).json({ staff, user: staff });
});

router.patch(
  '/staff/:id',
  validate(z.object({ ...staffFields, isActive: z.boolean() }).partial()),
  async (req, res) => {
    if (!isObjectId(req.params.id)) throw notFound('Staff member not found');
    const user = await User.findOne({ _id: req.params.id, role: { $in: STAFF_ROLES } });
    if (!user) throw notFound('Staff member not found');
    const { password, ...data } = req.valid.body;
    if (data.isActive === false && user._id.equals(req.user._id)) throw badRequest('You cannot deactivate your own account', 'self_deactivate');
    Object.assign(user, data);
    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    const [staff] = await withActiveCounts([user]);
    res.json({ staff, user: staff });
  },
);

// ---------- customers ----------

router.get('/customers', async (_req, res) => {
  const [customers, counts] = await Promise.all([
    User.find({ role: 'customer' }).sort({ createdAt: -1 }),
    Booking.aggregate([{ $group: { _id: '$customer', n: { $sum: 1 }, lastBookingAt: { $max: '$createdAt' } } }]),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [c._id.toString(), c]));
  res.json({
    customers: customers.map((c) => ({
      ...c.toJSON(),
      bookingCount: byId[c._id.toString()]?.n || 0,
      lastBookingAt: byId[c._id.toString()]?.lastBookingAt || null,
    })),
  });
});

// ---------- catalog management ----------

router.get('/packages', async (_req, res) => {
  const [packages, services] = await Promise.all([
    Package.find().sort({ sortOrder: 1, price: 1 }),
    Service.find().sort({ sortOrder: 1, code: 1 }),
  ]);
  res.json({ packages: packages.map((p) => p.toJSON()), services: services.map((s) => s.toJSON()) });
});

const packageFields = {
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug may contain a-z, 0-9 and dashes').max(80),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  serviceCodes: z.array(z.enum(SERVICE_CODES)).min(1, 'Add at least one test'),
  price: z.number().min(0),
  mrp: z.number().min(0),
  popular: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

router.post(
  '/packages',
  validate(
    z
      .object(packageFields)
      .partial()
      .required({ name: true, serviceCodes: true, price: true })
      .refine((p) => p.mrp === undefined || p.mrp >= p.price, { message: 'MRP must be at least the price', path: ['mrp'] }),
  ),
  async (req, res) => {
    const body = req.valid.body;
    const pkg = await Package.create({
      tagline: '',
      description: '',
      popular: false,
      isActive: true,
      ...body,
      slug: body.slug || slugify(body.name),
      mrp: body.mrp ?? body.price,
      sortOrder: body.sortOrder ?? (await Package.countDocuments()) + 1,
    });
    res.status(201).json({ package: pkg.toJSON() });
  },
);

router.patch('/packages/:id', validate(z.object(packageFields).partial()), async (req, res) => {
  if (!isObjectId(req.params.id)) throw notFound('Package not found');
  const pkg = await Package.findById(req.params.id);
  if (!pkg) throw notFound('Package not found');
  Object.assign(pkg, req.valid.body);
  if (pkg.mrp < pkg.price) throw badRequest('MRP must be at least the price', 'validation_error');
  await pkg.save();
  res.json({ package: pkg.toJSON() });
});

router.patch(
  '/services/:code',
  validate(
    z
      .object({
        price: z.number().min(0).optional(),
        description: z.string().trim().max(2000).optional(),
        name: z.string().trim().min(1).max(120).optional(),
        shortName: z.string().trim().min(1).max(40).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, 'Nothing to update'),
  ),
  async (req, res) => {
    const service = await Service.findOneAndUpdate(
      { code: String(req.params.code).toUpperCase() },
      { $set: req.valid.body },
      { returnDocument: 'after', runValidators: true },
    );
    if (!service) throw notFound('Service not found');
    res.json({ service: service.toJSON() });
  },
);

// ---------- leads ----------

router.get('/leads', async (_req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 });
  res.json({ leads: leads.map((l) => l.toJSON()) });
});

export default router;
