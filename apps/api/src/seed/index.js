// Idempotent seed: wipes Nivar collections and recreates demo data (spec section 8).
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../db.js';
import { config } from '../config.js';
import { Booking, Counter, Lead, Package, Service, User } from '../models/index.js';
import { SLOTS, addDays, istDateTime, istParts, slotStartMinutes } from '../lib/time.js';
import { createRng } from './random.js';
import { generateEcg, generateStethEnvelope } from './ecg.js';
import {
  ADMIN, CUSTOMERS, DEMO_PASSWORD, DOCTORS, LEADS, NURSES, PACKAGES, RAHUL, RATING_COMMENTS, REPORTS, SERVICES, SYMPTOM_NOTES,
} from './data.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const oid = () => new mongoose.Types.ObjectId();
const r1 = (v) => Math.round(v * 10) / 10;

export async function runSeed({ log = console.log, now = new Date() } = {}) {
  const rng = createRng(20261012);
  const { date: today, minutes: nowMin } = istParts(now);
  const tomorrow = addDays(today, 1);

  // ---------- wipe ----------
  const models = [User, Service, Package, Booking, Lead, Counter];
  for (const m of models) {
    await m.collection.drop().catch((err) => {
      if (err.codeName !== 'NamespaceNotFound' && err.code !== 26) throw err;
    });
  }
  for (const m of models) await m.createIndexes();

  // ---------- catalog ----------
  const services = await Service.insertMany(SERVICES);
  // Package and user ids are derived from a natural key so they survive a reseed: a booking
  // wizard or a signed-in tab that was open before `pnpm seed` ran keeps working.
  const stableId = (key) => new mongoose.Types.ObjectId(createHash('sha1').update(key).digest('hex').slice(0, 24));
  const packages = await Package.insertMany(PACKAGES.map((p) => ({ ...p, _id: stableId(`package:${p.slug}`), isActive: true })));
  const priceOf = Object.fromEntries(services.map((s) => [s.code, s.price]));
  const pkgBySlug = Object.fromEntries(packages.map((p) => [p.slug, p]));

  // ---------- users ----------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staffCreated = new Date(now.getTime() - 120 * DAY);
  const mkStaff = (u, role) => ({ ...u, role, passwordHash, isActive: true, _id: stableId(`user:${u.email}`), createdAt: staffCreated, updatedAt: staffCreated });
  const admin = mkStaff(ADMIN, 'admin');
  const doctors = DOCTORS.map((d) => mkStaff(d, 'doctor'));
  const nurses = NURSES.map((n) => mkStaff(n, 'nurse'));
  const mkCustomer = (c, daysAgo) => {
    const created = new Date(now.getTime() - daysAgo * DAY);
    return {
      ...c,
      role: 'customer',
      isActive: true,
      _id: stableId(`user:${c.phone}`),
      dob: c.dob ? new Date(`${c.dob}T00:00:00Z`) : undefined,
      addresses: c.addresses.map((a) => ({ ...a, _id: oid() })),
      createdAt: created,
      updatedAt: created,
    };
  };
  const rahul = mkCustomer(RAHUL, 45);
  const customers = CUSTOMERS.map((c, i) => mkCustomer(c, 60 - i * 4));
  await User.insertMany([admin, ...doctors, ...nurses, rahul, ...customers], { timestamps: false });

  const [ananya, vikram] = doctors;
  const [priya, kavya, meera] = nurses;

  // ---------- booking builder ----------
  const slotLoad = new Map();
  const occupy = (date, slot) => slotLoad.set(`${date}|${slot}`, (slotLoad.get(`${date}|${slot}`) || 0) + 1);
  const load = (date, slot) => slotLoad.get(`${date}|${slot}`) || 0;
  const bookings = [];

  const patientFor = (customer) => {
    const age = customer.dob ? Math.floor((now - customer.dob) / (365.25 * DAY)) : 35;
    if (customer.name === 'Rohan Gupta' && rng.chance(0.5)) {
      return { name: 'Sunita Gupta', age: 62, gender: 'female', relation: 'parent' };
    }
    if (customer.name === 'Sneha Iyer' && rng.chance(0.3)) {
      return { name: 'Karthik Iyer', age: 36, gender: 'male', relation: 'spouse' };
    }
    return { name: customer.name, age, gender: customer.gender, relation: 'self' };
  };

  const choosePurchase = () => {
    const roll = rng.next();
    if (roll < 0.35) return { pkg: pkgBySlug['heart-check'] };
    if (roll < 0.55) return { pkg: pkgBySlug['complete-home-checkup'] };
    if (roll < 0.72) return { pkg: pkgBySlug['essential-vitals'] };
    if (roll < 0.87) return { pkg: pkgBySlug['diabetes-care'] };
    return { codes: rng.pick([['BP', 'SUGAR', 'HR'], ['ECG', 'HR', 'CONSULT'], ['BP', 'HR', 'SPO2', 'CONSULT'], ['ECG', 'STETH', 'CONSULT']]) };
  };

  const pickProfile = (codes) => {
    if (codes.includes('SUGAR') && rng.chance(0.28)) return 'diabetes';
    if (codes.includes('BP') && rng.chance(0.28)) return 'hypertension';
    if (rng.chance(0.08)) return 'tachycardia';
    return 'normal';
  };

  const pickTemplate = (profile, codes) => {
    const list = REPORTS[profile];
    if (profile === 'normal') return codes.includes('ECG') ? list[0] : list[1];
    return rng.pick(list);
  };

  function makeVitals(codes, profile, template, at) {
    const v = { recordedAt: at, temperatureF: r1(rng.float(97.6, 98.9)) };
    if (rng.chance(0.6)) v.weightKg = r1(rng.float(52, 88));
    if (codes.includes('BP')) {
      if (profile === 'hypertension') {
        v.bpSystolic = rng.int(142, 162);
        v.bpDiastolic = rng.int(90, 102);
      } else {
        v.bpSystolic = rng.int(108, 128);
        v.bpDiastolic = rng.int(68, 84);
      }
    }
    if (codes.includes('SUGAR')) {
      const prediabetic = template.diagnosis.startsWith('Impaired fasting');
      v.sugarType = prediabetic ? 'fasting' : rng.pick(['fasting', 'random', 'pp']);
      const ranges = profile === 'diabetes'
        ? prediabetic ? { fasting: [102, 122] } : { fasting: [132, 178], random: [185, 248], pp: [195, 262] }
        : { fasting: [78, 98], random: [92, 136], pp: [104, 138] };
      const [lo, hi] = ranges[v.sugarType];
      v.sugar = rng.int(lo, hi);
    }
    v.heartRate = profile === 'tachycardia' ? rng.int(104, 118) : rng.int(62, 88);
    if (codes.includes('SPO2')) v.spo2 = rng.int(96, 99);
    return v;
  }

  function adaptSummary(summary, codes) {
    return summary
      .split(/(?<=\.)\s+/)
      .filter((s) => (codes.includes('ECG') || !/ECG/.test(s)) && (codes.includes('STETH') || !/Heart sounds|murmur/i.test(s)))
      .join(' ');
  }

  function rhythmFor(hr) {
    if (hr > 100) return { rhythm: 'Sinus tachycardia', interpretation: `Sinus tachycardia at ${hr} bpm. Regular rhythm, normal axis, no acute ST-T changes.` };
    if (hr < 60) return { rhythm: 'Sinus bradycardia', interpretation: `Sinus bradycardia at ${hr} bpm. Regular rhythm, no acute ST-T changes.` };
    return { rhythm: 'Normal sinus rhythm', interpretation: `Normal sinus rhythm at ${hr} bpm. Normal axis, PR and QRS intervals normal, no ST-T changes.` };
  }

  /**
   * Build a booking document.
   * finalStatus: completed | cancelled | testing | assigned | confirmed | pending_payment
   */
  function build({ customer, date, slot, finalStatus, nurse, doctor, purchase, profile, template, addressIndex = 0, createdAt, cancelFrom, ratingScore }) {
    const address = customer.addresses[Math.min(addressIndex, customer.addresses.length - 1)];
    const { pkg, codes: rawCodes } = purchase || choosePurchase();
    const codes = pkg ? pkg.serviceCodes : rawCodes;
    const amount = pkg ? pkg.price : codes.reduce((s, c) => s + priceOf[c], 0);
    const slotStart = istDateTime(date, slot.slice(0, 5));
    const created = createdAt || new Date(Math.min(now.getTime() - 10 * MIN, slotStart.getTime() - rng.float(3 * HOUR, 40 * HOUR)));
    const method = rng.pick(['upi', 'upi', 'upi', 'card', 'netbanking']);
    const timeline = [{ status: 'pending_payment', at: created, by: customer.name, note: 'Booking placed' }];
    const doc = {
      _id: oid(),
      customer: customer._id,
      patient: patientFor(customer),
      address: { id: address._id.toString(), label: address.label, line1: address.line1, area: address.area, city: address.city, pincode: address.pincode, lat: address.lat, lng: address.lng },
      packageId: pkg?._id,
      serviceCodes: codes,
      scheduledDate: date,
      slot,
      amount,
      payment: { status: 'pending' },
      status: 'pending_payment',
      timeline,
      notes: rng.pick(SYMPTOM_NOTES),
      createdAt: created,
      updatedAt: created,
    };
    const step = (status, rawAt, by, note) => {
      // Never write timeline entries in the future (relevant for today's in-progress visits).
      const at = new Date(Math.min(rawAt.getTime(), now.getTime() - MIN));
      timeline.push({ status, at, by, note });
      doc.status = status;
      doc.updatedAt = at;
    };

    if (finalStatus === 'pending_payment' || cancelFrom === 'pending_payment') {
      if (finalStatus === 'cancelled') step('cancelled', new Date(created.getTime() + rng.int(20, 300) * MIN), customer.name, 'Booking cancelled: payment not completed');
      return doc;
    }

    const paidAt = new Date(created.getTime() + rng.int(1, 4) * MIN);
    doc.payment = { status: 'paid', method, txnId: `NVPAY${paidAt.getTime().toString(36).toUpperCase()}${rng.int(100, 999)}`, paidAt };
    step('confirmed', paidAt, customer.name, `Payment received via ${{ upi: 'UPI', card: 'card', netbanking: 'net banking' }[method]}`);
    if (finalStatus === 'confirmed') return doc;

    if (finalStatus === 'cancelled' && cancelFrom === 'confirmed') {
      const byAdmin = rng.chance(0.3);
      step('cancelled', new Date(paidAt.getTime() + rng.int(30, 600) * MIN), byAdmin ? admin.name : customer.name,
        byAdmin ? 'Booking cancelled by Nivar: patient unreachable' : rng.pick(['Booking cancelled: travelling that day', 'Booking cancelled: will reschedule next week']));
      doc.payment.status = 'refunded';
      doc.cancelReason = 'Customer request';
      return doc;
    }

    const assignedAt = new Date(Math.min(paidAt.getTime() + rng.int(10, 90) * MIN, now.getTime() - 2 * MIN));
    doc.nurse = nurse._id;
    doc.doctor = doctor._id;
    step('assigned', assignedAt, admin.name, `${nurse.name} assigned as your nurse, ${doctor.name} as your doctor`);
    if (finalStatus === 'assigned') return doc;

    const enRoute = new Date(Math.max(assignedAt.getTime() + MIN, slotStart.getTime() - rng.int(20, 35) * MIN));
    step('en_route', enRoute, nurse.name, 'Nurse is on the way');
    const arrived = new Date(Math.max(enRoute.getTime() + 15 * MIN, slotStart.getTime() + rng.int(-5, 12) * MIN));
    step('arrived', arrived, nurse.name, `${nurse.name.split(' ')[0]} has arrived at your home`);
    doc.nurseLocation = { lat: address.lat, lng: address.lng, updatedAt: arrived };
    const testing = new Date(arrived.getTime() + rng.int(3, 6) * MIN);
    step('testing', testing, nurse.name, 'Tests in progress');

    const prof = profile || pickProfile(codes);
    const tpl = template || pickTemplate(prof, codes);
    const vitalsAt = new Date(testing.getTime() + rng.int(4, 9) * MIN);
    doc.vitals = makeVitals(codes, prof, tpl, vitalsAt);
    const hr = doc.vitals.heartRate;
    if (codes.includes('ECG')) {
      doc.ecg = { samples: generateEcg({ heartRate: hr, seed: rng.int(1, 1e9) }), sampleRate: 250, heartRate: hr, ...rhythmFor(hr), capturedAt: new Date(vitalsAt.getTime() + 3 * MIN) };
    }
    if (codes.includes('STETH')) {
      doc.stethoscope = {
        heartRate: hr,
        findings: prof === 'tachycardia' ? 'S1 S2 normal, rapid regular rhythm, no murmurs. Lungs clear.' : 'S1 S2 normal, no murmurs or added sounds. Lungs clear bilaterally.',
        samples: generateStethEnvelope({ heartRate: hr, seed: rng.int(1, 1e9) }),
        capturedAt: new Date(vitalsAt.getTime() + 6 * MIN),
      };
    }
    if (finalStatus === 'testing') {
      // In-progress visit: only BP/HR captured so far.
      doc.vitals = { recordedAt: doc.vitals.recordedAt, bpSystolic: doc.vitals.bpSystolic, bpDiastolic: doc.vitals.bpDiastolic, heartRate: hr };
      delete doc.ecg;
      delete doc.stethoscope;
      return doc;
    }

    const consult = new Date(testing.getTime() + rng.int(16, 24) * MIN);
    step('consult', consult, nurse.name, `Video consult started with ${doctor.name}`);
    const reporting = new Date(consult.getTime() + rng.int(9, 15) * MIN);
    step('reporting', reporting, doctor.name, `${doctor.name} is preparing your report`);
    const published = new Date(reporting.getTime() + rng.int(6, 14) * MIN);
    doc.report = {
      diagnosis: tpl.diagnosis,
      summary: adaptSummary(tpl.summary, codes),
      prescription: tpl.prescription,
      advice: tpl.advice,
      followUp: tpl.followUp,
      publishedAt: published,
    };
    step('completed', published, doctor.name, 'Report published');
    const score = ratingScore ?? (rng.chance(0.78) ? rng.pick([5, 5, 5, 4, 4, 3]) : null);
    if (score) doc.rating = { score, comment: rng.pick(RATING_COMMENTS[score]), ratedAt: new Date(published.getTime() + rng.int(30, 600) * MIN) };
    return doc;
  }

  const add = (doc) => {
    occupy(doc.scheduledDate, doc.slot);
    bookings.push(doc);
    return doc;
  };

  // ---------- Rahul: three completed visits, nothing active ----------
  const rahulStory = [
    { days: 26, slot: '08:00-09:00', pkg: 'heart-check', profile: 'hypertension', template: REPORTS.hypertension[0], score: 5 },
    {
      days: 11, slot: '09:00-10:00', pkg: 'essential-vitals', profile: 'normal', score: 5,
      template: {
        diagnosis: 'Essential hypertension, well controlled on treatment',
        summary: 'Follow-up visit. Blood pressure is now within target on Telmisartan 40 mg. Sugar, heart rate and oxygen saturation are normal.',
        prescription: [{ medicine: 'Telmisartan 40 mg (Telma 40)', dosage: '1 tablet', frequency: 'Once daily, morning', duration: '60 days', notes: 'Continue the same dose' }],
        advice: ['Keep up the daily walks', 'Continue the low-salt diet', 'Check BP at home twice a week'],
        followUp: 'Review in 2 months',
      },
    },
    { days: 4, slot: '07:00-08:00', pkg: 'complete-home-checkup', profile: 'normal', template: REPORTS.normal[0], score: 4 },
  ];
  for (const s of rahulStory) {
    const date = addDays(today, -s.days);
    add(build({ customer: rahul, date, slot: s.slot, finalStatus: 'completed', nurse: priya, doctor: ananya, purchase: { pkg: pkgBySlug[s.pkg] }, profile: s.profile, template: s.template, ratingScore: s.score }));
  }

  // ---------- history: last 30 days, other customers ----------
  const pairs = [[priya, ananya], [kavya, vikram], [meera, ananya], [kavya, ananya], [meera, vikram], [priya, vikram]];
  const HISTORY = 38;
  for (let i = 0; i < HISTORY; i++) {
    const daysAgo = 1 + Math.floor((i * 29) / HISTORY) + (rng.chance(0.3) ? 1 : 0);
    const date = addDays(today, -Math.min(daysAgo, 30));
    let slot = rng.pick(SLOTS);
    for (let k = 0; k < 5 && load(date, slot) >= 2; k++) slot = rng.pick(SLOTS);
    const customer = customers[i % customers.length];
    const [nurse, doctor] = rng.pick(pairs);
    const cancelled = i % 9 === 4;
    add(build({
      customer, date, slot, nurse, doctor,
      addressIndex: rng.int(0, customer.addresses.length - 1),
      finalStatus: cancelled ? 'cancelled' : 'completed',
      cancelFrom: cancelled ? rng.pick(['pending_payment', 'confirmed']) : undefined,
    }));
  }

  // ---------- today ----------
  const isFuture = (slot) => slotStartMinutes(slot) > nowMin + 20;
  const futureToday = SLOTS.filter(isFuture);
  const pastToday = SLOTS.filter((s) => slotStartMinutes(s) + 120 <= nowMin);
  const freeSlot = (date, candidates, max = 1) => candidates.find((s) => load(date, s) < max);

  // Completed earlier today (only if those slots really are in the past).
  if (pastToday.length >= 2) {
    add(build({ customer: customers[1], date: today, slot: pastToday[0], finalStatus: 'completed', nurse: meera, doctor: vikram }));
    add(build({ customer: customers[4], date: today, slot: pastToday[Math.min(2, pastToday.length - 1)], finalStatus: 'completed', nurse: kavya, doctor: ananya, purchase: { pkg: pkgBySlug['heart-check'] } }));
  }

  // In progress right now (Kavya + Dr. Vikram), if within working hours.
  const currentSlot = SLOTS.find((s) => slotStartMinutes(s) <= nowMin && nowMin < slotStartMinutes(s) + 60);
  if (currentSlot) {
    add(build({ customer: customers[3], date: today, slot: currentSlot, finalStatus: 'testing', nurse: kavya, doctor: vikram, purchase: { pkg: pkgBySlug['complete-home-checkup'] }, createdAt: new Date(now.getTime() - 26 * HOUR) }));
  }

  // Priya + Dr. Ananya: two assigned visits later today (fall back to the last slots of the day).
  const priyaSlots = futureToday.length >= 2
    ? [futureToday[Math.min(1, futureToday.length - 1)], futureToday[futureToday.length - 1]]
    : futureToday.length === 1 ? [SLOTS[SLOTS.length - 2], futureToday[0]] : SLOTS.slice(-2);
  const priyaDate = today;
  add(build({ customer: customers[0], date: priyaDate, slot: priyaSlots[0], finalStatus: 'assigned', nurse: priya, doctor: ananya, purchase: { pkg: pkgBySlug['heart-check'] }, createdAt: new Date(now.getTime() - 20 * HOUR) }));
  add(build({ customer: customers[2], date: priyaDate, slot: priyaSlots[1], finalStatus: 'assigned', nurse: priya, doctor: ananya, addressIndex: 1, purchase: { pkg: pkgBySlug['diabetes-care'] }, createdAt: new Date(now.getTime() - 9 * HOUR) }));

  // Needs assignment: confirmed but unassigned, today (if a slot remains) and tomorrow.
  const unassignedToday = freeSlot(today, futureToday);
  add(build({
    customer: customers[5], date: unassignedToday ? today : tomorrow, slot: unassignedToday || '10:00-11:00', finalStatus: 'confirmed',
    addressIndex: 0, purchase: { pkg: pkgBySlug['complete-home-checkup'] }, createdAt: new Date(now.getTime() - 3 * HOUR),
  }));
  add(build({ customer: customers[3], date: tomorrow, slot: '08:00-09:00', finalStatus: 'confirmed', addressIndex: 1, purchase: { pkg: pkgBySlug['heart-check'] }, createdAt: new Date(now.getTime() - 50 * MIN) }));

  // Tomorrow: already assigned visit, and an abandoned checkout.
  add(build({ customer: customers[4], date: tomorrow, slot: '11:00-12:00', finalStatus: 'assigned', nurse: meera, doctor: vikram, purchase: { pkg: pkgBySlug['diabetes-care'] }, createdAt: new Date(now.getTime() - 5 * HOUR) }));
  add(build({ customer: customers[5], date: tomorrow, slot: '17:00-18:00', finalStatus: 'pending_payment', addressIndex: 1, purchase: { codes: ['BP', 'SUGAR', 'HR'] }, createdAt: new Date(now.getTime() - 35 * MIN) }));

  // ---------- codes in creation order ----------
  bookings.sort((a, b) => a.createdAt - b.createdAt);
  bookings.forEach((b, i) => {
    b.code = `NV-${1001 + i}`;
  });
  await Booking.insertMany(bookings, { timestamps: false });
  await Counter.create({ _id: 'booking', seq: bookings.length });

  await Lead.insertMany(
    LEADS.map((l, i) => {
      const at = new Date(now.getTime() - (i * 2 + 1) * DAY + rng.int(0, 600) * MIN);
      return { ...l, createdAt: at, updatedAt: at };
    }),
    { timestamps: false },
  );

  // ---------- summary ----------
  const byStatus = bookings.reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {});
  log('');
  log(`Seeded ${config.mongoUrl.replace(/\/\/[^@]*@/, '//')}`);
  log(`  ${services.length} services, ${packages.length} packages, ${bookings.length} bookings (${Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(', ')}), ${LEADS.length} leads`);
  log('');
  log('Demo credentials');
  log(`  Customer  Rahul Mehta   phone ${RAHUL.phone}   OTP ${config.demoOtp}   (no active booking)`);
  log(`  Admin     ${ADMIN.email}   password ${DEMO_PASSWORD}`);
  for (const d of DOCTORS) log(`  Doctor    ${d.email.padEnd(22)} password ${DEMO_PASSWORD}   ${d.name}, ${d.specialization}`);
  for (const n of NURSES) log(`  Nurse     ${n.email.padEnd(22)} password ${DEMO_PASSWORD}   ${n.name}, hub ${n.baseLocation.label.replace('Nivar Hub, ', '')}`);
  log('');
  log(`  Today (${today}): Priya + Dr. Ananya have visits at ${priyaSlots.join(' and ')}; ${bookings.filter((b) => b.status === 'confirmed').length} bookings need assignment.`);
  return { bookings: bookings.length, byStatus, today };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    await connectDb();
    await runSeed();
    await disconnectDb();
  } catch (err) {
    console.error('Seed failed:', err);
    await disconnectDb().catch(() => {});
    process.exit(1);
  }
}
