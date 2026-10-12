import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, teardown, as, staffToken } from './helpers.js';
import { BOOKING_STATUSES } from '../src/services/booking-status.js';

let app, a;
before(async () => {
  app = await setup();
  a = as(app, (await staffToken(app, 'admin@nivar.health')).token);
});
after(teardown);

test('stats shape', async () => {
  const res = await a.get('/api/admin/stats');
  assert.equal(res.status, 200);
  const s = res.body;
  for (const k of ['bookings', 'completed', 'inProgress']) assert.equal(typeof s.today[k], 'number');
  for (const k of ['today', 'month', 'total']) assert.equal(typeof s.revenue[k], 'number');
  assert.ok(s.revenue.total > 10000, 'seeded history produces revenue');
  assert.ok(s.revenue.total >= s.revenue.month);
  assert.deepEqual(s.counts, { customers: 7, nurses: 3, doctors: 2 });
  assert.deepEqual(Object.keys(s.statusBreakdown).sort(), [...BOOKING_STATUSES].sort());
  assert.ok(s.statusBreakdown.completed >= 30);
  assert.equal(s.last7Days.length, 7);
  for (const d of s.last7Days) {
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof d.bookings, 'number');
    assert.equal(typeof d.revenue, 'number');
  }
  assert.ok(s.last7Days[0].date < s.last7Days[6].date);
});

test('needs-assignment list is non-empty in the seed', async () => {
  const res = await a.get('/api/bookings?status=confirmed');
  assert.equal(res.status, 200);
  assert.ok(res.body.bookings.length >= 2);
  assert.ok(res.body.bookings.every((b) => !b.nurse && !b.doctor));
});

test('staff list with active load, create and update staff', async () => {
  const nurses = await a.get('/api/admin/staff?role=nurse');
  assert.equal(nurses.status, 200);
  assert.equal(nurses.body.staff.length, 3);
  const priya = nurses.body.staff.find((s) => s.email === 'priya@nivar.health');
  assert.ok(priya.activeBookings >= 2);
  assert.equal(priya.passwordHash, undefined);

  const created = await a.post('/api/admin/staff', { name: 'Anil Kumar', email: 'anil@nivar.health', password: 'secret123', role: 'nurse', phone: '9888877777' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.staff.activeBookings, 0);
  const dup = await a.post('/api/admin/staff', { name: 'Anil', email: 'anil@nivar.health', password: 'secret123', role: 'nurse' });
  assert.equal(dup.status, 409);

  const login = await request(app).post('/api/auth/login').send({ email: 'anil@nivar.health', password: 'secret123' });
  assert.equal(login.status, 200);

  const off = await a.patch(`/api/admin/staff/${created.body.staff.id}`, { isActive: false });
  assert.equal(off.status, 200);
  assert.equal(off.body.staff.isActive, false);
  const blocked = await request(app).post('/api/auth/login').send({ email: 'anil@nivar.health', password: 'secret123' });
  assert.equal(blocked.status, 403);
  assert.equal((await as(app, login.body.token).get('/api/auth/me')).status, 401);
});

test('customers, packages, services and leads', async () => {
  const customers = await a.get('/api/admin/customers');
  assert.equal(customers.status, 200);
  const rahul = customers.body.customers.find((c) => c.phone === '9876543210');
  assert.equal(rahul.bookingCount, 3);

  const pk = await a.get('/api/admin/packages');
  assert.equal(pk.body.packages.length, 4);
  const id = pk.body.packages[0].id;
  const upd = await a.patch(`/api/admin/packages/${id}`, { isActive: false, price: 499 });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.package.isActive, false);
  const catalog = await request(app).get('/api/catalog');
  assert.equal(catalog.body.packages.length, 3, 'inactive packages are hidden publicly');

  const newPkg = await a.post('/api/admin/packages', { name: 'Senior Care', serviceCodes: ['BP', 'ECG'], price: 999, mrp: 1200 });
  assert.equal(newPkg.status, 201, JSON.stringify(newPkg.body));
  assert.equal(newPkg.body.package.slug, 'senior-care');

  const svc = await a.patch('/api/admin/services/bp', { price: 249 });
  assert.equal(svc.status, 200);
  assert.equal(svc.body.service.price, 249);
  assert.equal((await a.patch('/api/admin/services/NOPE', { price: 1 })).status, 404);

  const leads = await a.get('/api/admin/leads');
  assert.equal(leads.status, 200);
  assert.equal(leads.body.leads.length, 5);
});
