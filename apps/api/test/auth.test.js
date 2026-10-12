import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { setup, teardown, as, PASSWORD } from './helpers.js';

let app;
before(async () => {
  app = await setup();
});
after(teardown);

test('OTP request reports new vs existing users and returns the demo OTP', async () => {
  const fresh = await request(app).post('/api/auth/otp/request').send({ phone: '9123456789' });
  assert.equal(fresh.status, 200);
  assert.deepEqual(fresh.body, { ok: true, demoOtp: '123456', isNewUser: true });

  const rahul = await request(app).post('/api/auth/otp/request').send({ phone: '+91 98765 43210' });
  assert.equal(rahul.status, 200);
  assert.equal(rahul.body.isNewUser, false);
});

test('OTP request rejects invalid phone numbers', async () => {
  for (const phone of ['12345', '5876543210', 'abcdefghij', '']) {
    const res = await request(app).post('/api/auth/otp/request').send({ phone });
    assert.equal(res.status, 400, phone);
    assert.equal(res.body.error.code, 'validation_error');
    assert.ok(res.body.error.message);
  }
});

test('OTP verify rejects a wrong code and creates the customer on first login', async () => {
  const bad = await request(app).post('/api/auth/otp/verify').send({ phone: '9123456789', otp: '000000' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'invalid_otp');

  const res = await request(app).post('/api/auth/otp/verify').send({ phone: '+919123456789', otp: '123456', name: 'Ira Das' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, 'customer');
  assert.equal(res.body.user.phone, '9123456789');
  assert.equal(res.body.user.name, 'Ira Das');
  assert.ok(res.body.user.id);
  assert.equal(res.body.user._id, undefined);
  assert.equal(res.body.user.__v, undefined);

  const again = await request(app).post('/api/auth/otp/request').send({ phone: '9123456789' });
  assert.equal(again.body.isNewUser, false);
});

test('staff login works, wrong password is 401, and passwordHash never leaks', async () => {
  const ok = await request(app).post('/api/auth/login').send({ email: 'Priya@nivar.health', password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.role, 'nurse');
  assert.equal(ok.body.user.name, 'Priya Nair');
  assert.equal(ok.body.user.passwordHash, undefined);
  assert.ok(ok.body.user.baseLocation.lat);

  const bad = await request(app).post('/api/auth/login').send({ email: 'priya@nivar.health', password: 'wrong' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'invalid_credentials');

  const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@nivar.health', password: PASSWORD });
  assert.equal(unknown.status, 401);
});

test('GET /auth/me requires a valid token', async () => {
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await as(app, 'garbage').get('/api/auth/me')).status, 401);

  const { body } = await request(app).post('/api/auth/login').send({ email: 'admin@nivar.health', password: PASSWORD });
  const me = await as(app, body.token).get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'admin@nivar.health');
  assert.equal(me.body.user.role, 'admin');
});

test('PATCH /me updates profile and addresses with stable ids', async () => {
  const { body } = await request(app).post('/api/auth/otp/verify').send({ phone: '9876543210', otp: '123456' });
  const client = as(app, body.token);
  const existing = body.user.addresses[0];
  const res = await client.patch('/api/me', {
    name: 'Rahul M',
    gender: 'male',
    addresses: [existing, { label: 'Office', line1: '2nd floor, WeWork Galaxy', area: 'Koramangala', pincode: '560034' }],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.user.name, 'Rahul M');
  assert.equal(res.body.user.addresses.length, 2);
  assert.equal(res.body.user.addresses[0].id, existing.id);
  assert.ok(res.body.user.addresses[1].id);

  const bad = await client.patch('/api/me', { addresses: [{ label: 'x' }] });
  assert.equal(bad.status, 400);
});
