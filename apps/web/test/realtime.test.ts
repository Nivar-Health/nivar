// Supabase Realtime replaces Socket.io: private broadcast channels `booking:<id>`, `user:<uid>` and `admin`.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Booking } from "../src/lib/types.ts";
import { BookingTracker, PHONES, STAFF, anonClient, as, customerToken, refreshTokenFor, sampleBooking, staffToken, type Session } from "./helpers.ts";

const bookings = new BookingTracker();
let rahul: Session, other: Session, admin: Session, priya: Session, kavya: Session, ananya: Session;
let bookingId: string;

const clients: SupabaseClient[] = [];

type Message = { event: string; payload: Record<string, unknown> };
type SubscribeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

/** A subscribed channel that buffers every broadcast, so a message can never be missed between calls. */
class Listener {
  readonly inbox: Message[] = [];
  private waiters: Array<{ event: string; resolve: (m: Message) => void }> = [];
  status: SubscribeStatus | null = null;
  error?: Error;

  constructor(readonly channel: RealtimeChannel) {
    channel.on("broadcast", { event: "*" }, (msg: { event: string; payload?: Record<string, unknown> }) => {
      const m: Message = { event: msg.event, payload: msg.payload ?? {} };
      const i = this.waiters.findIndex((w) => w.event === m.event);
      if (i >= 0) {
        const [w] = this.waiters.splice(i, 1);
        w.resolve(m);
      } else {
        this.inbox.push(m);
      }
    });
  }

  /** Resolve with the first terminal subscribe status (never throws). */
  subscribe(timeoutMs = 10_000): Promise<SubscribeStatus> {
    return new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => finish("TIMED_OUT"), timeoutMs);
      const finish = (status: SubscribeStatus, err?: Error) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        this.status = status;
        this.error = err;
        resolve(status);
      };
      this.channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") finish(status, err);
      });
    });
  }

  /** Next message with `event`, from the buffer or arriving within `ms`. */
  next<T = Record<string, unknown>>(event: string, ms = 5_000): Promise<T> {
    const i = this.inbox.findIndex((m) => m.event === event);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0].payload as T);
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.resolve !== ok);
        reject(new Error(`timeout waiting for ${event} on ${this.channel.topic}`));
      }, ms);
      const ok = (m: Message) => {
        clearTimeout(t);
        resolve(m.payload as T);
      };
      this.waiters.push({ event, resolve: ok });
    });
  }

  /** Assert that no `event` arrives within `ms`. */
  async silent(event: string, ms = 1_000): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
    assert.ok(!this.inbox.some((m) => m.event === event), `unexpected ${event} on ${this.channel.topic}`);
  }

  send(event: string, payload: unknown) {
    return this.channel.send({ type: "broadcast", event, payload });
  }
}

/** Authenticated realtime client for a user token; one socket per user, as in the browser. */
async function realtimeClient(token: string): Promise<SupabaseClient> {
  const sb = anonClient();
  const refresh = refreshTokenFor(token);
  if (refresh) {
    // A signed-in client, like the browser: realtime then authenticates with the user's token.
    const { error } = await sb.auth.setSession({ access_token: token, refresh_token: refresh });
    if (error) throw error;
  }
  await sb.realtime.setAuth(token);
  clients.push(sb);
  return sb;
}

async function listen(sb: SupabaseClient, topic: string, opts: { self?: boolean } = {}): Promise<Listener> {
  const channel = sb.channel(topic, { config: { private: true, broadcast: { self: opts.self ?? false, ack: true } } });
  const l = new Listener(channel);
  await l.subscribe();
  return l;
}

async function join(sb: SupabaseClient, topic: string, opts: { self?: boolean } = {}): Promise<Listener> {
  const l = await listen(sb, topic, opts);
  assert.equal(l.status, "SUBSCRIBED", `${topic}: ${l.error?.message ?? l.status}`);
  return l;
}

before(async () => {
  rahul = await customerToken(PHONES.rahul);
  other = await customerToken(PHONES.spare1);
  admin = await staffToken(STAFF.admin);
  priya = await staffToken(STAFF.priya);
  kavya = await staffToken(STAFF.kavya);
  ananya = await staffToken(STAFF.ananya);

  const c = as(rahul.token);
  const created = await bookings.create(c, sampleBooking({ serviceCodes: ["ECG", "CONSULT"] }));
  bookingId = created.id;
  const paid = await c.post(`/api/bookings/${bookingId}/pay`, { method: "upi" });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  const assigned = await as(admin.token).post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
});

after(async () => {
  for (const sb of clients) {
    await sb.removeAllChannels().catch(() => undefined);
    await sb.realtime.disconnect().catch(() => undefined);
  }
  await bookings.cleanup();
});

test("a private booking channel rejects an invalid token", async () => {
  const sb = await realtimeClient("bad-token");
  const l = await listen(sb, `booking:${bookingId}`);
  assert.notEqual(l.status, "SUBSCRIBED", "garbage token must not subscribe to a private channel");
  await sb.removeChannel(l.channel);
});

test("REST mutations broadcast booking:updated to the booking, user and admin channels and notify the customer", async () => {
  const customerSb = await realtimeClient(rahul.token);
  const adminSb = await realtimeClient(admin.token);
  const intruderSb = await realtimeClient(other.token);

  const customer = await join(customerSb, `booking:${bookingId}`);
  const inbox = await join(customerSb, `user:${rahul.user.id}`);
  const adminRoom = await join(adminSb, "admin");
  // A customer who is not on the booking is either refused at subscribe time or never receives anything.
  const intruder = await listen(intruderSb, `booking:${bookingId}`);
  assert.notEqual(intruder.status, "TIMED_OUT", `intruder subscribe timed out: ${intruder.error?.message ?? ""}`);

  const res = await as(priya.token).post(`/api/bookings/${bookingId}/status`, { status: "en_route" });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const { booking } = await customer.next<{ booking: Booking }>("booking:updated");
  assert.equal(booking.status, "en_route");
  assert.deepEqual(booking, res.body.booking, "realtime payload equals the REST response");

  const mine = await inbox.next<{ booking: Booking }>("booking:updated");
  assert.equal(mine.booking.id, bookingId);
  const notice = await inbox.next<{ title: string; body: string; bookingId: string }>("notify");
  assert.equal(notice.bookingId, bookingId);
  assert.ok(notice.title && notice.body);

  const forAdmin = await adminRoom.next<{ booking: Booking }>("booking:updated");
  assert.equal(forAdmin.booking.id, bookingId);

  if (intruder.status === "SUBSCRIBED") {
    await intruder.silent("booking:updated");
  } else {
    assert.equal(intruder.status, "CHANNEL_ERROR");
  }

  // Staff and customers who are not participants cannot read the admin room.
  const nurseAdmin = await listen(await realtimeClient(kavya.token), "admin");
  assert.notEqual(nurseAdmin.status, "SUBSCRIBED", "a nurse must not subscribe to the admin channel");
});

test("nurse location: broadcast reaches the customer, PUT /location persists it, other nurses are refused", async () => {
  const customer = await join(await realtimeClient(rahul.token), `booking:${bookingId}`);
  const nurse = await join(await realtimeClient(priya.token), `booking:${bookingId}`);

  const at = new Date().toISOString();
  const sent = await nurse.send("nurse:location", { bookingId, lat: 12.97, lng: 77.64, at });
  assert.equal(sent, "ok");
  const loc = await customer.next<{ bookingId: string; lat: number; lng: number; at: string }>("nurse:location");
  assert.equal(loc.bookingId, bookingId);
  assert.equal(loc.lat, 12.97);
  assert.equal(loc.lng, 77.64);
  assert.ok(Date.parse(loc.at));

  const n = as(priya.token);
  const put = await n.put(`/api/bookings/${bookingId}/location`, { lat: 12.97, lng: 77.64 });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  const detail = await as(rahul.token).get(`/api/bookings/${bookingId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.booking.nurseLocation.lat, 12.97);
  assert.equal(detail.body.booking.nurseLocation.lng, 77.64);
  assert.ok(detail.body.booking.nurseLocation.updatedAt);

  // Only the assigned nurse may persist locations; bad coordinates are rejected.
  assert.equal((await as(kavya.token).put(`/api/bookings/${bookingId}/location`, { lat: 1, lng: 1 })).status, 403);
  assert.equal((await as(ananya.token).put(`/api/bookings/${bookingId}/location`, { lat: 1, lng: 1 })).status, 403);
  assert.equal((await n.put(`/api/bookings/${bookingId}/location`, { lat: "x" })).status, 400);
});

test("device streams and WebRTC signalling relay between participants without echo", async () => {
  const doctor = await join(await realtimeClient(ananya.token), `booking:${bookingId}`);
  const nurse = await join(await realtimeClient(priya.token), `booking:${bookingId}`);
  const patient = await join(await realtimeClient(rahul.token), `booking:${bookingId}`);

  assert.equal(await nurse.send("device:ecg", { bookingId, samples: [0.1, 0.9, -0.2], sampleRate: 250, heartRate: 72, t: 1 }), "ok");
  const chunk = await doctor.next<{ samples: number[]; heartRate: number }>("device:ecg");
  assert.deepEqual(chunk.samples, [0.1, 0.9, -0.2]);
  assert.equal(chunk.heartRate, 72);
  await nurse.silent("device:ecg", 500);

  assert.equal(await nurse.send("device:status", { bookingId, device: "ecg", state: "streaming" }), "ok");
  assert.equal((await doctor.next<{ state: string }>("device:status")).state, "streaming");

  // Signalling protocol from the spec: join -> peer-here -> signal -> leave.
  const doctorPeer = "peer-doctor";
  const patientPeer = "peer-patient";
  assert.equal(await patient.send("rtc:join", { peerId: patientPeer, name: "Rahul Mehta", role: "customer" }), "ok");
  const joined = await doctor.next<{ peerId: string; role: string }>("rtc:join");
  assert.equal(joined.peerId, patientPeer);
  assert.equal(joined.role, "customer");

  await doctor.send("rtc:peer-here", { to: patientPeer, peerId: doctorPeer, name: "Dr. Ananya Rao", role: "doctor" });
  const here = await patient.next<{ to: string; peerId: string; name: string; role: string }>("rtc:peer-here");
  assert.deepEqual(here, { to: patientPeer, peerId: doctorPeer, name: "Dr. Ananya Rao", role: "doctor" });

  await patient.send("rtc:signal", { to: doctorPeer, from: patientPeer, data: { type: "offer", sdp: "v=0" } });
  const signal = await doctor.next<{ to: string; from: string; data: unknown }>("rtc:signal");
  assert.deepEqual(signal, { to: doctorPeer, from: patientPeer, data: { type: "offer", sdp: "v=0" } });

  await patient.send("rtc:leave", { peerId: patientPeer });
  assert.equal((await doctor.next<{ peerId: string }>("rtc:leave")).peerId, patientPeer);

  await patient.channel.unsubscribe();
});
