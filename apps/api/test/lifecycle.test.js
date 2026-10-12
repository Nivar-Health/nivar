import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, as, staffToken, customerToken, sampleBooking } from './helpers.js';
import { generateEcg } from '../src/seed/ecg.js';

let app;
let customer, admin, nurse, doctor;

before(async () => {
  app = await setup();
  customer = await customerToken(app, '9876543210');
  admin = await staffToken(app, 'admin@nivar.health');
  nurse = await staffToken(app, 'priya@nivar.health');
  doctor = await staffToken(app, 'ananya@nivar.health');
});
after(teardown);

const statuses = (b) => b.timeline.map((t) => t.status);

test('full booking lifecycle from booking to rating', async () => {
  const c = as(app, customer.token);
  const a = as(app, admin.token);
  const n = as(app, nurse.token);
  const d = as(app, doctor.token);

  // Rahul starts with nothing active.
  const active0 = await c.get('/api/bookings?scope=active');
  assert.equal(active0.status, 200);
  assert.equal(active0.body.bookings.length, 0);
  const past0 = await c.get('/api/bookings?scope=past');
  assert.ok(past0.body.bookings.length >= 3);
  assert.ok(past0.body.bookings.every((b) => b.status === 'completed' && b.report.diagnosis));

  const { body: catalog } = await c.get('/api/catalog');
  const heart = catalog.packages.find((p) => p.slug === 'heart-check');

  // 1. Book
  const created = await c.post('/api/bookings', sampleBooking({ packageId: heart.id }));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  let b = created.body.booking;
  assert.match(b.code, /^NV-\d{4,}$/);
  assert.ok(Number(b.code.slice(3)) > 1001);
  assert.equal(b.status, 'pending_payment');
  assert.equal(b.amount, 1499);
  assert.equal(b.payment.status, 'pending');
  assert.equal(b.customer.name, 'Rahul Mehta');
  assert.equal(b.customer.passwordHash, undefined);
  assert.equal(b.customer.addresses, undefined, 'only public fields are populated');
  assert.deepEqual(statuses(b), ['pending_payment']);
  assert.equal(b.timeline[0].note, 'Booking placed');
  const id = b.id;

  // 2. Pay
  const paid = await c.post(`/api/bookings/${id}/pay`, { method: 'upi' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  b = paid.body.booking;
  assert.equal(b.status, 'confirmed');
  assert.equal(b.payment.status, 'paid');
  assert.equal(b.payment.method, 'upi');
  assert.ok(b.payment.txnId);
  assert.ok(b.payment.paidAt);
  assert.equal(b.timeline.at(-1).note, 'Payment received via UPI');
  assert.equal((await c.post(`/api/bookings/${id}/pay`, { method: 'upi' })).status, 409, 'cannot pay twice');

  // 3. Assign (and re-assign while assigned)
  const vikram = await staffToken(app, 'vikram@nivar.health');
  const kavya = await staffToken(app, 'kavya@nivar.health');
  let res = await a.post(`/api/bookings/${id}/assign`, { nurseId: kavya.user.id, doctorId: vikram.user.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  res = await a.post(`/api/bookings/${id}/assign`, { nurseId: nurse.user.id, doctorId: doctor.user.id });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  b = res.body.booking;
  assert.equal(b.status, 'assigned');
  assert.equal(b.nurse.name, 'Priya Nair');
  assert.equal(b.doctor.name, 'Dr. Ananya Rao');
  assert.equal(b.doctor.specialization, 'Cardiologist');
  assert.equal(b.timeline.at(-1).note, 'Priya Nair assigned as your nurse, Dr. Ananya Rao as your doctor');

  // Nurse and doctor see it in their lists
  assert.ok((await n.get('/api/bookings')).body.bookings.some((x) => x.id === id));
  assert.ok((await d.get('/api/bookings?scope=active')).body.bookings.some((x) => x.id === id));
  assert.ok(!(await as(app, kavya.token).get('/api/bookings')).body.bookings.some((x) => x.id === id));

  // 4. Nurse trip
  res = await n.post(`/api/bookings/${id}/status`, { status: 'en_route' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  b = res.body.booking;
  assert.equal(b.status, 'en_route');
  assert.equal(b.nurseLocation.lat, 12.9634, 'starts at the nurse hub');
  assert.equal(b.timeline.at(-1).note, 'Nurse is on the way');

  // Vitals cannot be recorded before arrival
  assert.equal((await n.put(`/api/bookings/${id}/vitals`, { bpSystolic: 120 })).status, 409);

  res = await n.post(`/api/bookings/${id}/status`, { status: 'arrived' });
  assert.equal(res.status, 200);
  res = await n.post(`/api/bookings/${id}/status`, { status: 'testing' });
  assert.equal(res.status, 200);

  // 5. Vitals (partial updates merge), ECG, stethoscope
  res = await n.put(`/api/bookings/${id}/vitals`, { bpSystolic: 148, bpDiastolic: 94 });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  res = await n.put(`/api/bookings/${id}/vitals`, { heartRate: 78, spo2: 98, sugar: 104, sugarType: 'fasting', temperatureF: 98.4 });
  b = res.body.booking;
  assert.equal(b.vitals.bpSystolic, 148);
  assert.equal(b.vitals.heartRate, 78);
  assert.equal(b.vitals.sugarType, 'fasting');
  assert.ok(b.vitals.recordedAt);
  assert.equal((await n.put(`/api/bookings/${id}/vitals`, { spo2: 140 })).status, 400);

  const samples = generateEcg({ heartRate: 78 });
  res = await n.put(`/api/bookings/${id}/ecg`, { samples, sampleRate: 250, heartRate: 78, rhythm: 'Normal sinus rhythm' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booking.ecg.samples.length, 2500);
  assert.equal(res.body.booking.ecg.rhythm, 'Normal sinus rhythm');
  assert.ok(res.body.booking.ecg.interpretation);

  res = await n.put(`/api/bookings/${id}/stethoscope`, { heartRate: 78, findings: 'S1 S2 normal', samples: [0, 0.5, 1, 0.4] });
  assert.equal(res.status, 200);
  assert.equal(res.body.booking.stethoscope.findings, 'S1 S2 normal');

  // Doctor cannot write vitals
  assert.equal((await d.put(`/api/bookings/${id}/vitals`, { heartRate: 80 })).status, 403);

  // 6. Consult; doctor drafts the report
  res = await n.post(`/api/bookings/${id}/status`, { status: 'consult' });
  assert.equal(res.status, 200);
  res = await d.put(`/api/bookings/${id}/report`, { diagnosis: 'Stage 1 hypertension', summary: 'BP elevated.' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booking.status, 'consult');
  assert.equal(res.body.booking.report.publishedAt, undefined);

  res = await d.post(`/api/bookings/${id}/status`, { status: 'reporting' });
  assert.equal(res.status, 200);
  assert.equal(res.body.booking.status, 'reporting');

  // 7. Publish
  res = await d.put(`/api/bookings/${id}/report`, {
    prescription: [{ medicine: 'Telmisartan 40 mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days' }],
    advice: ['Reduce salt', 'Walk 30 minutes daily'],
    followUp: 'Review in 4 weeks',
    publish: true,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  b = res.body.booking;
  assert.equal(b.status, 'completed');
  assert.equal(b.report.diagnosis, 'Stage 1 hypertension', 'draft fields are kept on publish');
  assert.equal(b.report.prescription[0].medicine, 'Telmisartan 40 mg');
  assert.ok(b.report.publishedAt);
  assert.deepEqual(statuses(b), ['pending_payment', 'confirmed', 'assigned', 'assigned', 'en_route', 'arrived', 'testing', 'consult', 'reporting', 'completed']);
  assert.ok(b.timeline.every((t) => t.at && t.by && t.note));

  // 8. Rate
  res = await c.post(`/api/bookings/${id}/rate`, { score: 5, comment: 'Wonderful' });
  assert.equal(res.status, 200);
  assert.equal(res.body.booking.rating.score, 5);
  assert.equal((await c.post(`/api/bookings/${id}/rate`, { score: 9 })).status, 400);

  // Detail view includes everything
  const detail = await c.get(`/api/bookings/${id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.booking.ecg.samples.length, 2500);
  assert.equal(detail.body.booking.id, id);
});

test('consult can be published straight to completed; admin can complete only after a report', async () => {
  const c = as(app, customer.token);
  const a = as(app, admin.token);
  const n = as(app, nurse.token);
  const d = as(app, doctor.token);

  const mk = async (slot) => {
    const { body } = await c.post('/api/bookings', sampleBooking({ serviceCodes: ['BP', 'CONSULT'], slot }));
    const id = body.booking.id;
    await c.post(`/api/bookings/${id}/pay`, { method: 'card' });
    await a.post(`/api/bookings/${id}/assign`, { nurseId: nurse.user.id, doctorId: doctor.user.id });
    for (const status of ['en_route', 'arrived', 'testing', 'consult']) {
      const r = await n.post(`/api/bookings/${id}/status`, { status });
      assert.equal(r.status, 200, `${status}: ${JSON.stringify(r.body)}`);
    }
    return id;
  };

  const id1 = await mk('13:00-14:00');
  const noDiag = await d.put(`/api/bookings/${id1}/report`, { summary: 'x', publish: true });
  assert.equal(noDiag.status, 400);
  const pub = await d.put(`/api/bookings/${id1}/report`, { diagnosis: 'Healthy adult', publish: true });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.booking.status, 'completed');

  const id2 = await mk('14:00-15:00');
  await n.post(`/api/bookings/${id2}/status`, { status: 'reporting' });
  const early = await a.post(`/api/bookings/${id2}/status`, { status: 'completed' });
  assert.equal(early.status, 409);
  assert.equal(early.body.error.code, 'report_missing');
  await d.put(`/api/bookings/${id2}/report`, { diagnosis: 'Healthy adult' });
  const done = await d.post(`/api/bookings/${id2}/status`, { status: 'completed' });
  assert.equal(done.status, 200);
  assert.ok(done.body.booking.report.publishedAt);
});
