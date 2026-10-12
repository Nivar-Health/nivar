import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, as, staffToken, customerToken, sampleBooking } from './helpers.js';

let app;
let rahul, other, admin, priya, kavya, ananya, vikram;
let bookingId;

before(async () => {
  app = await setup();
  rahul = await customerToken(app, '9876543210');
  other = await customerToken(app, '9845012345');
  admin = await staffToken(app, 'admin@nivar.health');
  priya = await staffToken(app, 'priya@nivar.health');
  kavya = await staffToken(app, 'kavya@nivar.health');
  ananya = await staffToken(app, 'ananya@nivar.health');
  vikram = await staffToken(app, 'vikram@nivar.health');

  const c = as(app, rahul.token);
  const { body } = await c.post('/api/bookings', sampleBooking({ serviceCodes: ['BP', 'HR'] }));
  bookingId = body.booking.id;
});
after(teardown);

test('customers cannot see or pay for other customers\' bookings', async () => {
  const o = as(app, other.token);
  assert.equal((await o.get(`/api/bookings/${bookingId}`)).status, 403);
  assert.equal((await o.post(`/api/bookings/${bookingId}/pay`, { method: 'upi' })).status, 403);
  assert.ok(!(await o.get('/api/bookings')).body.bookings.some((b) => b.id === bookingId));
  assert.equal((await o.get('/api/bookings/000000000000000000000000')).status, 404);
  assert.equal((await o.get('/api/bookings/not-an-id')).status, 404);
});

test('status cannot skip payment or assignment', async () => {
  const a = as(app, admin.token);
  const r = await a.post(`/api/bookings/${bookingId}/status`, { status: 'confirmed' });
  assert.equal(r.status, 409);
  const r2 = await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(r2.status, 409, 'cannot assign before payment');
  assert.equal(r2.body.error.code, 'invalid_transition');
});

test('customer cannot assign; nurse/doctor not assigned get 403; invalid transitions 409', async () => {
  const c = as(app, rahul.token);
  await c.post(`/api/bookings/${bookingId}/pay`, { method: 'netbanking' });

  const custAssign = await c.post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(custAssign.status, 403);

  const a = as(app, admin.token);
  // Wrong roles in assign payload
  assert.equal((await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: ananya.user.id, doctorId: priya.user.id })).status, 400);
  const ok = await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(ok.status, 200);

  // Another nurse / doctor cannot act or even view
  assert.equal((await as(app, kavya.token).post(`/api/bookings/${bookingId}/status`, { status: 'en_route' })).status, 403);
  assert.equal((await as(app, kavya.token).get(`/api/bookings/${bookingId}`)).status, 403);
  assert.equal((await as(app, vikram.token).put(`/api/bookings/${bookingId}/report`, { diagnosis: 'x' })).status, 403);

  // Customer cannot drive visit status
  assert.equal((await c.post(`/api/bookings/${bookingId}/status`, { status: 'en_route' })).status, 403);

  const n = as(app, priya.token);
  // Skipping steps is a 409
  const skip = await n.post(`/api/bookings/${bookingId}/status`, { status: 'testing' });
  assert.equal(skip.status, 409);
  assert.equal(skip.body.error.code, 'invalid_transition');
  assert.match(skip.body.error.message, /assigned/);

  // Doctor cannot start the nurse's trip
  assert.equal((await as(app, ananya.token).post(`/api/bookings/${bookingId}/status`, { status: 'en_route' })).status, 403);

  assert.equal((await n.post(`/api/bookings/${bookingId}/status`, { status: 'en_route' })).status, 200);
  // Re-assign is only possible while "assigned"
  assert.equal((await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: kavya.user.id, doctorId: vikram.user.id })).status, 409);
  assert.equal((await n.post(`/api/bookings/${bookingId}/status`, { status: 'arrived' })).status, 200);

  // Cancel after arrival is a 409
  const cancel = await c.post(`/api/bookings/${bookingId}/cancel`, { reason: 'Changed my mind' });
  assert.equal(cancel.status, 409);
  assert.equal(cancel.body.error.code, 'invalid_transition');

  // Report cannot be drafted before testing / published before consult
  assert.equal((await as(app, ananya.token).put(`/api/bookings/${bookingId}/report`, { diagnosis: 'x' })).status, 409);

  // Rating before completion
  assert.equal((await c.post(`/api/bookings/${bookingId}/rate`, { score: 5 })).status, 409);

  // Unknown status
  assert.equal((await n.post(`/api/bookings/${bookingId}/status`, { status: 'flying' })).status, 400);
});

test('owner can cancel before arrival; payment is refunded; other customer cannot', async () => {
  const c = as(app, rahul.token);
  const { body } = await c.post('/api/bookings', sampleBooking({ serviceCodes: ['SUGAR'], slot: '17:00-18:00' }));
  const id = body.booking.id;
  await c.post(`/api/bookings/${id}/pay`, { method: 'upi' });

  assert.equal((await as(app, other.token).post(`/api/bookings/${id}/cancel`)).status, 403);
  assert.equal((await as(app, priya.token).post(`/api/bookings/${id}/cancel`)).status, 403);

  const res = await c.post(`/api/bookings/${id}/cancel`, { reason: 'Travelling' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booking.status, 'cancelled');
  assert.equal(res.body.booking.payment.status, 'refunded');
  assert.match(res.body.booking.timeline.at(-1).note, /Travelling/);
  assert.equal((await c.post(`/api/bookings/${id}/cancel`)).status, 409, 'cannot cancel twice');
});

test('admin can cancel via /status and act on any booking', async () => {
  const c = as(app, rahul.token);
  const { body } = await c.post('/api/bookings', sampleBooking({ serviceCodes: ['HR'], slot: '18:00-19:00' }));
  const res = await as(app, admin.token).post(`/api/bookings/${body.booking.id}/status`, { status: 'cancelled', note: 'Duplicate booking' });
  assert.equal(res.status, 200);
  assert.equal(res.body.booking.status, 'cancelled');
});

test('non-admins cannot reach admin endpoints', async () => {
  for (const t of [rahul.token, priya.token, ananya.token]) {
    assert.equal((await as(app, t).get('/api/admin/stats')).status, 403);
  }
  assert.equal((await as(app, null).get('/api/admin/stats')).status, 401);
  assert.equal((await as(app, rahul.token).post('/api/bookings/x/assign', {})).status, 403);
  assert.equal((await as(app, priya.token).post('/api/bookings', sampleBooking({ serviceCodes: ['BP'] }))).status, 403);
});
