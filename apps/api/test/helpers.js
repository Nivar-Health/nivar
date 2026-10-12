import './env.js';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { runSeed } from '../src/seed/index.js';
import { addDays, todayIST } from '../src/lib/time.js';

export const PASSWORD = 'nivar123';

/** Connect to the test DB and reseed it. Returns a supertest agent factory. */
export async function setup() {
  await connectDb(process.env.MONGO_URL);
  await runSeed({ log: () => {} });
  return createApp();
}

export const teardown = () => disconnectDb();

export async function staffToken(app, email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

export async function customerToken(app, phone, name) {
  await request(app).post('/api/auth/otp/request').send({ phone });
  const res = await request(app).post('/api/auth/otp/verify').send({ phone, otp: '123456', name });
  if (res.status !== 200) throw new Error(`otp ${phone} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

/** Tiny authed client: as(app, token).post(url, body) etc. */
export function as(app, token) {
  const withAuth = (r) => (token ? r.set('Authorization', `Bearer ${token}`) : r);
  return {
    get: (url) => withAuth(request(app).get(url)),
    post: (url, body = {}) => withAuth(request(app).post(url)).send(body),
    put: (url, body = {}) => withAuth(request(app).put(url)).send(body),
    patch: (url, body = {}) => withAuth(request(app).patch(url)).send(body),
  };
}

export const daysFromToday = (n) => addDays(todayIST(), n);

export const sampleBooking = (overrides = {}) => ({
  patient: { name: 'Rahul Mehta', age: 42, gender: 'male', relation: 'self' },
  address: { label: 'Home', line1: 'Flat 402, 100 Feet Road', area: 'Indiranagar', city: 'Bangalore', pincode: '560038', lat: 12.9784, lng: 77.6408 },
  serviceCodes: [],
  scheduledDate: daysFromToday(2),
  slot: '12:00-13:00',
  notes: 'Mild headaches',
  ...overrides,
});
