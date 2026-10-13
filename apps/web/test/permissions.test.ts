import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Booking } from "../src/lib/types.ts";
import { BookingTracker, PHONES, STAFF, as, customerToken, sampleBooking, staffToken, type Session } from "./helpers.ts";

const bookings = new BookingTracker();
let rahul: Session, other: Session, admin: Session, priya: Session, kavya: Session, ananya: Session, vikram: Session;
let bookingId: string;

before(async () => {
  rahul = await customerToken(PHONES.rahul);
  other = await customerToken(PHONES.spare1);
  admin = await staffToken(STAFF.admin);
  priya = await staffToken(STAFF.priya);
  kavya = await staffToken(STAFF.kavya);
  ananya = await staffToken(STAFF.ananya);
  vikram = await staffToken(STAFF.vikram);

  const created = await bookings.create(as(rahul.token), sampleBooking({ serviceCodes: ["BP", "HR"] }));
  bookingId = created.id;
});

after(() => bookings.cleanup());

test("customers cannot see or pay for other customers' bookings", async () => {
  const o = as(other.token);
  assert.equal((await o.get(`/api/bookings/${bookingId}`)).status, 403);
  assert.equal((await o.post(`/api/bookings/${bookingId}/pay`, { method: "upi" })).status, 403);
  assert.ok(!(await o.get("/api/bookings")).body.bookings.some((b: Booking) => b.id === bookingId));
  assert.equal((await o.get("/api/bookings/00000000-0000-0000-0000-000000000000")).status, 404);
  assert.equal((await o.get("/api/bookings/not-an-id")).status, 404);
});

test("status cannot skip payment or assignment", async () => {
  const a = as(admin.token);
  const r = await a.post(`/api/bookings/${bookingId}/status`, { status: "confirmed" });
  assert.equal(r.status, 409);
  const r2 = await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(r2.status, 409, "cannot assign before payment");
  assert.equal(r2.body.error.code, "invalid_transition");
});

test("customer cannot assign; nurse/doctor not assigned get 403; invalid transitions 409", async () => {
  const c = as(rahul.token);
  const paid = await c.post(`/api/bookings/${bookingId}/pay`, { method: "netbanking" });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));

  const custAssign = await c.post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(custAssign.status, 403);

  const a = as(admin.token);
  // Wrong roles in assign payload
  assert.equal((await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: ananya.user.id, doctorId: priya.user.id })).status, 400);
  // Malformed ids
  assert.equal((await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: "nope", doctorId: ananya.user.id })).status, 400);
  const ok = await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: priya.user.id, doctorId: ananya.user.id });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  // Another nurse / doctor cannot act or even view
  assert.equal((await as(kavya.token).post(`/api/bookings/${bookingId}/status`, { status: "en_route" })).status, 403);
  assert.equal((await as(kavya.token).get(`/api/bookings/${bookingId}`)).status, 403);
  assert.equal((await as(vikram.token).put(`/api/bookings/${bookingId}/report`, { diagnosis: "x" })).status, 403);

  // Customer cannot drive visit status
  assert.equal((await c.post(`/api/bookings/${bookingId}/status`, { status: "en_route" })).status, 403);

  const n = as(priya.token);
  // Skipping steps is a 409
  const skip = await n.post(`/api/bookings/${bookingId}/status`, { status: "testing" });
  assert.equal(skip.status, 409);
  assert.equal(skip.body.error.code, "invalid_transition");
  assert.match(skip.body.error.message, /assigned/);

  // Doctor cannot start the nurse's trip
  assert.equal((await as(ananya.token).post(`/api/bookings/${bookingId}/status`, { status: "en_route" })).status, 403);

  assert.equal((await n.post(`/api/bookings/${bookingId}/status`, { status: "en_route" })).status, 200);
  // Re-assign is only possible while "assigned"
  assert.equal((await a.post(`/api/bookings/${bookingId}/assign`, { nurseId: kavya.user.id, doctorId: vikram.user.id })).status, 409);
  assert.equal((await n.post(`/api/bookings/${bookingId}/status`, { status: "arrived" })).status, 200);

  // Cancel after arrival is a 409
  const cancel = await c.post(`/api/bookings/${bookingId}/cancel`, { reason: "Changed my mind" });
  assert.equal(cancel.status, 409);
  assert.equal(cancel.body.error.code, "invalid_transition");

  // Report cannot be drafted before testing / published before consult
  assert.equal((await as(ananya.token).put(`/api/bookings/${bookingId}/report`, { diagnosis: "x" })).status, 409);

  // Rating before completion
  assert.equal((await c.post(`/api/bookings/${bookingId}/rate`, { score: 5 })).status, 409);

  // Unknown status
  assert.equal((await n.post(`/api/bookings/${bookingId}/status`, { status: "flying" })).status, 400);
});

test("owner can cancel before arrival; payment is refunded; other customer cannot", async () => {
  const c = as(rahul.token);
  const { id } = await bookings.create(c, sampleBooking({ serviceCodes: ["SUGAR"], slot: "17:00-18:00" }));
  const paid = await c.post(`/api/bookings/${id}/pay`, { method: "upi" });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));

  assert.equal((await as(other.token).post(`/api/bookings/${id}/cancel`)).status, 403);
  assert.equal((await as(priya.token).post(`/api/bookings/${id}/cancel`)).status, 403);

  const res = await c.post(`/api/bookings/${id}/cancel`, { reason: "Travelling" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booking.status, "cancelled");
  assert.equal(res.body.booking.payment.status, "refunded");
  assert.match(res.body.booking.timeline.at(-1).note, /Travelling/);
  assert.equal((await c.post(`/api/bookings/${id}/cancel`)).status, 409, "cannot cancel twice");
});

test("admin can cancel via /status and act on any booking", async () => {
  const c = as(rahul.token);
  const { id } = await bookings.create(c, sampleBooking({ serviceCodes: ["HR"], slot: "18:00-19:00" }));
  const res = await as(admin.token).post(`/api/bookings/${id}/status`, { status: "cancelled", note: "Duplicate booking" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.booking.status, "cancelled");
  // The reason is kept, prefixed so the patient's timeline shows who cancelled.
  assert.equal(res.body.booking.timeline.at(-1).note, "Booking cancelled by Nivar: Duplicate booking");
});

test("non-admins cannot reach admin endpoints", async () => {
  for (const t of [rahul.token, priya.token, ananya.token]) {
    const res = await as(t).get("/api/admin/stats");
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "role_not_allowed");
  }
  const unauth = await as(null).get("/api/admin/stats");
  assert.equal(unauth.status, 401);
  assert.equal(unauth.body.error.code, "unauthorized");
  assert.equal((await as(rahul.token).post("/api/bookings/x/assign", {})).status, 403);
  assert.equal((await as(priya.token).post("/api/bookings", sampleBooking({ serviceCodes: ["BP"] }))).status, 403);
});
