import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Package, Service, Slot } from "../src/lib/types.ts";
import { SLOTS, isSlotPast, todayIST } from "../src/server/time.ts";
import { BookingTracker, PHONES, UUID_RE, anon, as, customerToken, daysFromToday, sampleBooking, serviceClient } from "./helpers.ts";

const bookings = new BookingTracker();
const LEAD_PHONE = "9800011122";

before(async () => {
  await serviceClient().from("leads").delete().eq("phone", LEAD_PHONE);
});

after(async () => {
  await bookings.cleanup();
  await serviceClient().from("leads").delete().eq("phone", LEAD_PHONE);
});

test("health", async () => {
  const res = await anon.get("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("catalog returns services and active packages with seed prices", async () => {
  const res = await anon.get("/api/catalog");
  assert.equal(res.status, 200);
  const { services, packages } = res.body as { services: Service[]; packages: Package[] };
  assert.deepEqual(
    services.map((s) => s.code),
    ["BP", "ECG", "SUGAR", "HR", "SPO2", "STETH", "CONSULT"],
  );
  const price = Object.fromEntries(services.map((s) => [s.code, s.price]));
  assert.deepEqual(price, { BP: 199, ECG: 799, SUGAR: 149, HR: 99, SPO2: 99, STETH: 399, CONSULT: 499 });
  assert.equal(services.find((s) => s.code === "ECG")?.requiresDevice, "ecg");
  assert.equal(services.find((s) => s.code === "BP")?.requiresDevice, null);
  assert.equal(packages.length, 4);
  const heart = packages.find((p) => p.slug === "heart-check");
  assert.ok(heart);
  assert.equal(heart.price, 1499);
  assert.equal(heart.mrp, 2195);
  assert.equal(heart.popular, true);
  assert.match(heart.id, UUID_RE);
  for (const p of packages) assert.match(p.id, UUID_RE);
});

test("slots: express first today, then 13 hourly slots, past ones today unavailable", async () => {
  const today = todayIST();
  const res = await anon.get(`/api/slots?date=${today}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.date, today);
  const slots = res.body.slots as Slot[];
  assert.equal(slots.length, 14);
  assert.deepEqual(slots[0], { slot: "express", available: true, express: true });
  assert.equal(slots[1].slot, "07:00-08:00");
  assert.equal(slots[13].slot, "19:00-20:00");
  for (const s of slots) if (isSlotPast(today, s.slot)) assert.equal(s.available, false, s.slot);

  const yesterday = await anon.get(`/api/slots?date=${daysFromToday(-1)}`);
  assert.equal(yesterday.status, 200);
  assert.ok((yesterday.body.slots as Slot[]).every((s) => !s.available));

  const bad = await anon.get("/api/slots?date=2026-13-45");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "validation_error");
  assert.equal((await anon.get("/api/slots")).status, 400);
});

test("a slot with 3 bookings becomes unavailable and further bookings are rejected", async () => {
  const date = daysFromToday(5);
  const slot = "15:00-16:00";
  const before = await anon.get(`/api/slots?date=${date}`);
  assert.equal(before.status, 200);
  assert.equal((before.body.slots as Slot[]).find((s) => s.slot === slot)?.available, true);
  assert.equal(before.body.slots.length, SLOTS.length, "no express entry on a future date");

  const { token } = await customerToken(PHONES.spare1);
  const c = as(token);
  for (let i = 0; i < 3; i++) {
    await bookings.create(c, sampleBooking({ scheduledDate: date, slot, serviceCodes: ["BP"] }));
  }
  const after = await anon.get(`/api/slots?date=${date}`);
  assert.equal((after.body.slots as Slot[]).find((s) => s.slot === slot)?.available, false);

  const full = await c.post("/api/bookings", sampleBooking({ scheduledDate: date, slot, serviceCodes: ["BP"] }));
  assert.equal(full.status, 409, JSON.stringify(full.body));
  assert.equal(full.body.error.code, "slot_unavailable");
});

test("booking amount: package price plus add-ons, or sum of tests", async () => {
  const { token } = await customerToken(PHONES.spare2);
  const c = as(token);
  const { body: catalog } = await anon.get("/api/catalog");
  const essential = (catalog.packages as Package[]).find((p) => p.slug === "essential-vitals");
  assert.ok(essential);

  const tests = await bookings.create(c, sampleBooking({ serviceCodes: ["BP", "ECG"], slot: "16:00-17:00" }));
  assert.equal(tests.amount, 199 + 799);
  assert.match(tests.id, UUID_RE);

  const pkg = await bookings.create(c, sampleBooking({ packageId: essential.id, serviceCodes: ["ECG"], slot: "16:00-17:00" }));
  assert.equal(pkg.amount, 449 + 799);
  assert.deepEqual(pkg.serviceCodes, ["BP", "ECG", "SUGAR", "HR", "SPO2"]);
  assert.equal(pkg.packageId, essential.id);

  const empty = await c.post("/api/bookings", sampleBooking({ serviceCodes: [] }));
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, "validation_error");
  const past = await c.post("/api/bookings", sampleBooking({ scheduledDate: daysFromToday(-1), serviceCodes: ["BP"] }));
  assert.equal(past.status, 400);
});

test("leads: public submit, invalid payload rejected", async () => {
  const res = await anon.post("/api/leads", { name: "Test Lead", phone: LEAD_PHONE, city: "Bangalore", message: "Call me" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.deepEqual(res.body, { ok: true });
  const bad = await anon.post("/api/leads", { name: "X", phone: "123", city: "" });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "validation_error");
});

test("express slot: bookable today regardless of the hour, rejected for other days", async () => {
  const { token } = await customerToken(PHONES.spare2);
  const c = as(token);
  const ok = await bookings.create(c, sampleBooking({ scheduledDate: todayIST(), slot: "express", serviceCodes: ["BP"] }));
  assert.equal(ok.slot, "express");

  const later = await c.post("/api/bookings", sampleBooking({ scheduledDate: daysFromToday(1), slot: "express", serviceCodes: ["BP"] }));
  assert.equal(later.status, 400);
  assert.equal(later.body.error.code, "express_today_only");

  const tomorrow = await anon.get(`/api/slots?date=${daysFromToday(1)}`);
  assert.ok((tomorrow.body.slots as Slot[]).every((s) => s.slot !== "express"));
});

test("package ids are uuids, a slug is accepted as packageId, unknown packages are rejected", async () => {
  const { token } = await customerToken(PHONES.spare2);
  const c = as(token);
  const { body: catalog } = await anon.get("/api/catalog");
  const heart = (catalog.packages as Package[]).find((p) => p.slug === "heart-check");
  assert.ok(heart);

  const bySlug = await bookings.create(
    c,
    sampleBooking({ scheduledDate: daysFromToday(2), slot: "11:00-12:00", packageId: "heart-check", serviceCodes: [] }),
  );
  assert.equal(bySlug.packageId, heart.id, "slug resolves to the package uuid");
  assert.equal(bySlug.amount, 1499);

  const byId = await bookings.create(c, sampleBooking({ scheduledDate: daysFromToday(2), slot: "11:00-12:00", packageId: heart.id, serviceCodes: [] }));
  assert.equal(byId.packageId, heart.id);

  const missing = await c.post(
    "/api/bookings",
    sampleBooking({ scheduledDate: daysFromToday(2), slot: "11:00-12:00", packageId: "no-such-package", serviceCodes: [] }),
  );
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, "invalid_package");
});
