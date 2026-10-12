import { Server } from 'socket.io';
import { config } from '../config.js';
import { Booking } from '../models/index.js';
import { userFromToken } from '../middleware/auth.js';
import { canAccessBooking } from '../services/booking-status.js';
import { isObjectId, sameId, idOf } from '../lib/ids.js';
import { corsOrigin } from '../lib/cors.js';

let io = null;

export const rooms = {
  user: (id) => `user:${id}`,
  booking: (id) => `booking:${id}`,
  call: (id) => `call:${id}`,
  admin: 'admin',
};

export function getIo() {
  return io;
}

/**
 * Broadcast the canonical booking JSON to everyone who cares about it.
 * `booking` must be the populated JSON produced by bookingPayload().
 */
export function emitBookingUpdated(booking) {
  if (!io || !booking) return;
  const targets = [rooms.booking(booking.id), rooms.admin];
  for (const ref of [booking.customer, booking.nurse, booking.doctor]) {
    const id = idOf(ref);
    if (id) targets.push(rooms.user(id));
  }
  // A single emit to multiple rooms delivers once per socket even if it is in several of them.
  io.to(targets).emit('booking:updated', { booking });
}

/** Send a `notify` toast to one or more users. */
export function notifyUsers(userIds, { title, body, bookingId }) {
  if (!io) return;
  const targets = userIds.map(idOf).filter(Boolean).map(rooms.user);
  if (targets.length) io.to(targets).emit('notify', { title, body, ...(bookingId ? { bookingId: String(bookingId) } : {}) });
}

async function loadAccessibleBooking(user, bookingId) {
  if (!isObjectId(String(bookingId ?? ''))) return null;
  const booking = await Booking.findById(bookingId).select('customer nurse doctor status nurseLocation');
  if (!booking || !canAccessBooking(user, booking)) return null;
  return booking;
}

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    maxHttpBufferSize: 5e6,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await userFromToken(token);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { id: user._id.toString(), name: user.name, role: user.role, _id: user._id };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(rooms.user(user.id));
    if (user.role === 'admin') socket.join(rooms.admin);

    // Last persisted nurse location per booking (throttle), and short-lived nurse authorisation cache
    // so high-frequency device chunks do not hit the database every 100 ms.
    const lastPersist = new Map();
    const nurseAuthCache = new Map();
    const NURSE_AUTH_TTL_MS = 10_000;

    const ack = (cb, payload) => {
      if (typeof cb === 'function') cb(payload);
    };

    /** Load the booking and ensure this socket's user is the assigned nurse. */
    async function asAssignedNurse(bookingId) {
      if (user.role !== 'nurse') return false;
      const key = String(bookingId ?? '');
      const cached = nurseAuthCache.get(key);
      if (cached && cached > Date.now()) return true;
      const booking = await loadAccessibleBooking(user, key);
      const ok = Boolean(booking && sameId(booking.nurse, user.id));
      if (ok) nurseAuthCache.set(key, Date.now() + NURSE_AUTH_TTL_MS);
      else nurseAuthCache.delete(key);
      return ok;
    }

    socket.on('booking:join', async (payload, cb) => {
      const bookingId = payload?.bookingId;
      const booking = await loadAccessibleBooking(user, bookingId).catch(() => null);
      if (!booking) return ack(cb, { ok: false, error: 'forbidden' });
      socket.join(rooms.booking(bookingId));
      ack(cb, { ok: true });
    });

    socket.on('booking:leave', (payload, cb) => {
      if (payload?.bookingId) socket.leave(rooms.booking(payload.bookingId));
      ack(cb, { ok: true });
    });

    socket.on('nurse:location', async (payload, cb) => {
      try {
        const { bookingId, lat, lng } = payload || {};
        if (!finite(lat) || !finite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return ack(cb, { ok: false, error: 'invalid_location' });
        }
        if (!(await asAssignedNurse(bookingId))) return ack(cb, { ok: false, error: 'forbidden' });
        const at = new Date();
        io.to(rooms.booking(bookingId)).emit('nurse:location', { bookingId: String(bookingId), lat, lng, at: at.toISOString() });
        const prev = lastPersist.get(bookingId) || 0;
        if (at.getTime() - prev >= config.locationPersistIntervalMs) {
          lastPersist.set(bookingId, at.getTime());
          await Booking.updateOne({ _id: bookingId }, { $set: { nurseLocation: { lat, lng, updatedAt: at } } });
        }
        ack(cb, { ok: true });
      } catch {
        ack(cb, { ok: false, error: 'server_error' });
      }
    });

    // Device streams: assigned nurse only, rebroadcast to the booking room without echoing to the sender.
    for (const event of ['device:ecg', 'device:steth', 'device:status']) {
      socket.on(event, async (payload, cb) => {
        try {
          if (!(await asAssignedNurse(payload?.bookingId))) return ack(cb, { ok: false, error: 'forbidden' });
          socket.to(rooms.booking(payload.bookingId)).emit(event, { ...payload, bookingId: String(payload.bookingId) });
          ack(cb, { ok: true });
        } catch {
          ack(cb, { ok: false, error: 'server_error' });
        }
      });
    }

    // WebRTC signalling relay (mesh, up to 3 peers).
    const callsJoined = new Set();

    socket.on('rtc:join', async (payload, cb) => {
      const bookingId = payload?.bookingId;
      const booking = await loadAccessibleBooking(user, bookingId).catch(() => null);
      if (!booking) return ack(cb, { ok: false, error: 'forbidden' });
      const room = rooms.call(bookingId);
      const others = await io.in(room).fetchSockets();
      const peers = others
        .filter((s) => s.id !== socket.id)
        .map((s) => ({ socketId: s.id, name: s.data.user.name, role: s.data.user.role }));
      socket.join(room);
      callsJoined.add(String(bookingId));
      socket.emit('rtc:peers', { peers });
      socket.to(room).emit('rtc:peer-joined', { socketId: socket.id, name: user.name, role: user.role });
      ack(cb, { ok: true, peers });
    });

    socket.on('rtc:signal', (payload) => {
      const to = payload?.to;
      if (typeof to !== 'string') return;
      // Only relay between sockets sharing a call room.
      const target = io.sockets.sockets.get(to);
      if (!target) return;
      const shared = [...callsJoined].some((b) => target.rooms.has(rooms.call(b)));
      if (!shared) return;
      io.to(to).emit('rtc:signal', { from: socket.id, data: payload.data });
    });

    const leaveCall = (bookingId) => {
      const room = rooms.call(bookingId);
      if (!callsJoined.has(String(bookingId))) return;
      callsJoined.delete(String(bookingId));
      socket.leave(room);
      socket.to(room).emit('rtc:peer-left', { socketId: socket.id });
    };

    socket.on('rtc:leave', (payload, cb) => {
      if (payload?.bookingId) leaveCall(payload.bookingId);
      ack(cb, { ok: true });
    });

    socket.on('disconnecting', () => {
      for (const bookingId of [...callsJoined]) {
        socket.to(rooms.call(bookingId)).emit('rtc:peer-left', { socketId: socket.id });
      }
      callsJoined.clear();
    });
  });

  return io;
}

export async function closeRealtime() {
  if (io) {
    await new Promise((resolve) => io.close(() => resolve()));
    io = null;
  }
}
