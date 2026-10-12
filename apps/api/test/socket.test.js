import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { setup, teardown, as, staffToken, customerToken, sampleBooking } from './helpers.js';
import { startServer } from '../src/server.js';
import { closeRealtime } from '../src/realtime/index.js';
import { Booking } from '../src/models/index.js';

let app, server, url;
let rahul, other, admin, priya, kavya, ananya;
let bookingId;
const sockets = [];

function client(token) {
  const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(s);
  return s;
}
const once = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
const connected = (s) => (s.connected ? Promise.resolve() : once(s, 'connect'));
const emitAck = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));
const silent = (socket, event, ms = 300) =>
  new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`unexpected ${event}`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, ms);
  });

before(async () => {
  app = await setup();
  server = await startServer({ port: 0, mongoUrl: process.env.MONGO_URL });
  url = `http://localhost:${server.address().port}`;
  rahul = await customerToken(app, '9876543210');
  other = await customerToken(app, '9845012345');
  admin = await staffToken(app, 'admin@nivar.health');
  priya = await staffToken(app, 'priya@nivar.health');
  kavya = await staffToken(app, 'kavya@nivar.health');
  ananya = await staffToken(app, 'ananya@nivar.health');

  const c = as(app, rahul.token);
  const { body } = await c.post('/api/bookings', sampleBooking({ serviceCodes: ['ECG', 'CONSULT'] }));
  bookingId = body.booking.id;
  await c.post(`/api/bookings/${bookingId}/pay`, { method: 'upi' });
  await as(app, admin.token).post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
});

after(async () => {
  for (const s of sockets) s.disconnect();
  await closeRealtime();
  await new Promise((r) => server.close(() => r()));
  await teardown();
});

test('rejects connections without a valid token', async () => {
  const s = client('bad-token');
  const err = await once(s, 'connect_error');
  assert.match(err.message, /unauthorized/);
});

test('nurse location is relayed to the booking room and persisted', async () => {
  const customer = client(rahul.token);
  const nurse = client(priya.token);
  await Promise.all([connected(customer), connected(nurse)]);

  assert.deepEqual(await emitAck(customer, 'booking:join', { bookingId }), { ok: true });
  assert.deepEqual(await emitAck(nurse, 'booking:join', { bookingId }), { ok: true });

  const intruder = client(other.token);
  await connected(intruder);
  assert.equal((await emitAck(intruder, 'booking:join', { bookingId })).ok, false);

  const received = once(customer, 'nurse:location');
  const ack = await emitAck(nurse, 'nurse:location', { bookingId, lat: 12.97, lng: 77.64 });
  assert.equal(ack.ok, true);
  const loc = await received;
  assert.equal(loc.bookingId, bookingId);
  assert.equal(loc.lat, 12.97);
  assert.equal(loc.lng, 77.64);
  assert.ok(Date.parse(loc.at));

  const stored = await Booking.findById(bookingId);
  assert.equal(stored.nurseLocation.lat, 12.97);

  // Only the assigned nurse may send locations
  const otherNurse = client(kavya.token);
  await connected(otherNurse);
  assert.equal((await emitAck(otherNurse, 'nurse:location', { bookingId, lat: 1, lng: 1 })).ok, false);
});

test('device streams reach the booking room but do not echo to the sender', async () => {
  const doctor = client(ananya.token);
  const nurse = client(priya.token);
  await Promise.all([connected(doctor), connected(nurse)]);
  await emitAck(doctor, 'booking:join', { bookingId });
  await emitAck(nurse, 'booking:join', { bookingId });

  const got = once(doctor, 'device:ecg');
  const noEcho = silent(nurse, 'device:ecg');
  nurse.emit('device:ecg', { bookingId, samples: [0.1, 0.9, -0.2], sampleRate: 250, heartRate: 72, t: 1 });
  const chunk = await got;
  assert.deepEqual(chunk.samples, [0.1, 0.9, -0.2]);
  assert.equal(chunk.heartRate, 72);
  await noEcho;

  const status = once(doctor, 'device:status');
  nurse.emit('device:status', { bookingId, device: 'ecg', state: 'streaming' });
  assert.equal((await status).state, 'streaming');

  // Doctors cannot inject device data
  assert.equal((await emitAck(doctor, 'device:steth', { bookingId, samples: [1] })).ok, false);
});

test('REST mutations broadcast booking:updated and notify', async () => {
  const customer = client(rahul.token);
  const adminSock = client(admin.token);
  await Promise.all([connected(customer), connected(adminSock)]);

  const updated = once(customer, 'booking:updated');
  const adminUpdated = once(adminSock, 'booking:updated');
  const notice = once(customer, 'notify');
  const res = await as(app, priya.token).post(`/api/bookings/${bookingId}/status`, { status: 'en_route' });
  assert.equal(res.status, 200);
  const { booking } = await updated;
  assert.equal(booking.status, 'en_route');
  assert.deepEqual(booking, res.body.booking, 'socket payload equals REST response');
  assert.equal((await adminUpdated).booking.id, bookingId);
  const n = await notice;
  assert.equal(n.bookingId, bookingId);
  assert.ok(n.title && n.body);
});

test('WebRTC signalling: peers, relay, leave', async () => {
  const doctor = client(ananya.token);
  const patient = client(rahul.token);
  await Promise.all([connected(doctor), connected(patient)]);

  const first = await emitAck(doctor, 'rtc:join', { bookingId });
  assert.equal(first.ok, true);
  assert.deepEqual(first.peers, []);

  const joinedNotice = once(doctor, 'rtc:peer-joined');
  const peersEvt = once(patient, 'rtc:peers');
  await emitAck(patient, 'rtc:join', { bookingId });
  const { peers } = await peersEvt;
  assert.equal(peers.length, 1);
  assert.deepEqual(peers[0], { socketId: doctor.id, name: 'Dr. Ananya Rao', role: 'doctor' });
  const joined = await joinedNotice;
  assert.equal(joined.socketId, patient.id);
  assert.equal(joined.role, 'customer');

  const signal = once(doctor, 'rtc:signal');
  patient.emit('rtc:signal', { to: doctor.id, data: { type: 'offer', sdp: 'v=0' } });
  assert.deepEqual(await signal, { from: patient.id, data: { type: 'offer', sdp: 'v=0' } });

  const left = once(doctor, 'rtc:peer-left');
  patient.emit('rtc:leave', { bookingId });
  assert.equal((await left).socketId, patient.id);

  // Disconnect also announces departure
  const patient2 = client(rahul.token);
  await connected(patient2);
  await emitAck(patient2, 'rtc:join', { bookingId });
  const left2 = once(doctor, 'rtc:peer-left');
  const patient2Id = patient2.id;
  patient2.disconnect();
  assert.equal((await left2).socketId, patient2Id);

  const intruder = client(other.token);
  await connected(intruder);
  assert.equal((await emitAck(intruder, 'rtc:join', { bookingId })).ok, false);
});
