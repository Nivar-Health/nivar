import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, teardown, as, customerToken, sampleBooking, daysFromToday } from './helpers.js';
import { SLOTS, isSlotPast, todayIST } from '../src/lib/time.js';

let app;
before(async () => {
  app = await setup();
});
after(teardown);

test('health', async () => {
  const res = await request(app).get('/api/health');
  assert.deepEqual(res.body, { ok: true });
});

test('catalog returns services and active packages with seed prices', async () => {
  const res = await request(app).get('/api/catalog');
  assert.equal(res.status, 200);
  const { services, packages } = res.body;
  assert.deepEqual(services.map((s) => s.code), ['BP', 'ECG', 'SUGAR', 'HR', 'SPO2', 'STETH', 'CONSULT']);
  const price = Object.fromEntries(services.map((s) => [s.code, s.price]));
  assert.deepEqual(price, { BP: 199, ECG: 799, SUGAR: 149, HR: 99, SPO2: 99, STETH: 399, CONSULT: 499 });
  assert.equal(services.find((s) => s.code === 'ECG').requiresDevice, 'ecg');
  assert.equal(services.find((s) => s.code === 'BP').requiresDevice, null);
  assert.equal(packages.length, 4);
  const heart = packages.find((p) => p.slug === 'heart-check');
  assert.equal(heart.price, 1499);
  assert.equal(heart.mrp, 2195);
  assert.equal(heart.popular, true);
  assert.ok(heart.id);
});

test('slots: express first today, then 13 hourly slots, past ones today unavailable', async () => {
  const today = todayIST();
  const res = await request(app).get(`/api/slots?date=${today}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.date, today);
  assert.equal(res.body.slots.length, 14);
  assert.deepEqual(res.body.slots[0], { slot: 'express', available: true, express: true });
  assert.equal(res.body.slots[1].slot, '07:00-08:00');
  assert.equal(res.body.slots[13].slot, '19:00-20:00');
  for (const s of res.body.slots) if (isSlotPast(today, s.slot)) assert.equal(s.available, false, s.slot);

  const yesterday = await request(app).get(`/api/slots?date=${daysFromToday(-1)}`);
  assert.ok(yesterday.body.slots.every((s) => !s.available));

  const bad = await request(app).get('/api/slots?date=2026-13-45');
  assert.equal(bad.status, 400);
  assert.equal((await request(app).get('/api/slots')).status, 400);
});

test('a slot with 3 bookings becomes unavailable and further bookings are rejected', async () => {
  const date = daysFromToday(5);
  const slot = '15:00-16:00';
  const before = await request(app).get(`/api/slots?date=${date}`);
  assert.equal(before.body.slots.find((s) => s.slot === slot).available, true);
  assert.equal(before.body.slots.length, SLOTS.length);

  const { token } = await customerToken(app, '9811100001', 'Slot Tester');
  const c = as(app, token);
  for (let i = 0; i < 3; i++) {
    const res = await c.post('/api/bookings', sampleBooking({ scheduledDate: date, slot, serviceCodes: ['BP'] }));
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
  const after = await request(app).get(`/api/slots?date=${date}`);
  assert.equal(after.body.slots.find((s) => s.slot === slot).available, false);

  const full = await c.post('/api/bookings', sampleBooking({ scheduledDate: date, slot, serviceCodes: ['BP'] }));
  assert.equal(full.status, 409);
  assert.equal(full.body.error.code, 'slot_unavailable');
});

test('booking amount: package price plus add-ons, or sum of tests', async () => {
  const { token } = await customerToken(app, '9811100002', 'Amount Tester');
  const c = as(app, token);
  const { body: catalog } = await request(app).get('/api/catalog');
  const essential = catalog.packages.find((p) => p.slug === 'essential-vitals');

  const tests = await c.post('/api/bookings', sampleBooking({ serviceCodes: ['BP', 'ECG'], slot: '16:00-17:00' }));
  assert.equal(tests.status, 201);
  assert.equal(tests.body.booking.amount, 199 + 799);

  const pkg = await c.post('/api/bookings', sampleBooking({ packageId: essential.id, serviceCodes: ['ECG'], slot: '16:00-17:00' }));
  assert.equal(pkg.status, 201);
  assert.equal(pkg.body.booking.amount, 449 + 799);
  assert.deepEqual(pkg.body.booking.serviceCodes, ['BP', 'ECG', 'SUGAR', 'HR', 'SPO2']);

  const empty = await c.post('/api/bookings', sampleBooking({ serviceCodes: [] }));
  assert.equal(empty.status, 400);
  const past = await c.post('/api/bookings', sampleBooking({ scheduledDate: daysFromToday(-1), serviceCodes: ['BP'] }));
  assert.equal(past.status, 400);
});

test('leads: public submit, admin list', async () => {
  const res = await request(app).post('/api/leads').send({ name: 'Test Lead', phone: '9800011122', city: 'Bangalore', message: 'Call me' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, { ok: true });
  const bad = await request(app).post('/api/leads').send({ name: 'X', phone: '123', city: '' });
  assert.equal(bad.status, 400);
});

test('express slot: bookable today regardless of the hour, rejected for other days', async () => {
  const { token } = await customerToken(app, '9811100009', 'Express Tester');
  const c = as(app, token);
  const ok = await c.post('/api/bookings', sampleBooking({ scheduledDate: todayIST(), slot: 'express', serviceCodes: ['BP'] }));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.booking.slot, 'express');

  const later = await c.post('/api/bookings', sampleBooking({ scheduledDate: daysFromToday(1), slot: 'express', serviceCodes: ['BP'] }));
  assert.equal(later.status, 400);
  assert.equal(later.body.error.code, 'express_today_only');

  const tomorrow = await request(app).get(`/api/slots?date=${daysFromToday(1)}`);
  assert.ok(tomorrow.body.slots.every((s) => s.slot !== 'express'));
});
