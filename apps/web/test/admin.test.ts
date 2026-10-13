import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { BOOKING_STATUSES, type AdminStats, type Booking, type Package, type StaffMember } from "../src/lib/types.ts";
import { STAFF, UUID_RE, anon, anonClient, as, deleteAuthUser, findAuthUserByEmail, serviceClient, staffToken, type Client } from "./helpers.ts";

const NEW_STAFF_EMAIL = "anil@nivar.health";
const NEW_PACKAGE_SLUG = "senior-care";

let a: Client;

async function resetFixtures(): Promise<void> {
  const existing = await findAuthUserByEmail(NEW_STAFF_EMAIL);
  if (existing) await deleteAuthUser(existing.id);
  await serviceClient().from("profiles").delete().eq("email", NEW_STAFF_EMAIL);
  await serviceClient().from("packages").delete().eq("slug", NEW_PACKAGE_SLUG);
}

before(async () => {
  await resetFixtures();
  a = as((await staffToken(STAFF.admin)).token);
});

after(resetFixtures);

test("stats shape", async () => {
  const res = await a.get("/api/admin/stats");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const s = res.body as AdminStats;
  for (const k of ["bookings", "completed", "inProgress"] as const) assert.equal(typeof s.today[k], "number");
  for (const k of ["today", "month", "total"] as const) assert.equal(typeof s.revenue[k], "number");
  assert.ok(s.revenue.total > 10000, "seeded history produces revenue");
  assert.ok(s.revenue.total >= s.revenue.month);
  // The seed has 7 demo customers; the spare test numbers may add customer profiles once they have signed in.
  assert.ok(s.counts.customers >= 7, `customers ${s.counts.customers}`);
  assert.equal(s.counts.nurses, 3);
  assert.equal(s.counts.doctors, 2);
  assert.deepEqual(Object.keys(s.statusBreakdown).sort(), [...BOOKING_STATUSES].sort());
  assert.ok((s.statusBreakdown.completed ?? 0) >= 30);
  assert.equal(s.last7Days.length, 7);
  for (const d of s.last7Days) {
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof d.bookings, "number");
    assert.equal(typeof d.revenue, "number");
  }
  assert.ok(s.last7Days[0].date < s.last7Days[6].date);
});

test("needs-assignment list is non-empty in the seed", async () => {
  const res = await a.get("/api/bookings?status=confirmed");
  assert.equal(res.status, 200);
  assert.ok(res.body.bookings.length >= 2);
  assert.ok((res.body.bookings as Booking[]).every((b) => !b.nurse && !b.doctor));
});

test("staff list with active load, create, sign in, deactivate", async () => {
  const nurses = await a.get("/api/admin/staff?role=nurse");
  assert.equal(nurses.status, 200, JSON.stringify(nurses.body));
  assert.equal(nurses.body.staff.length, 3);
  const priya = (nurses.body.staff as StaffMember[]).find((s) => s.email === STAFF.priya);
  assert.ok(priya);
  assert.match(priya.id, UUID_RE);
  assert.ok(priya.activeBookings >= 2);
  assert.equal((priya as unknown as Record<string, unknown>).passwordHash, undefined);
  const doctors = await a.get("/api/admin/staff?role=doctor");
  assert.equal(doctors.body.staff.length, 2);

  const created = await a.post("/api/admin/staff", {
    name: "Anil Kumar",
    email: NEW_STAFF_EMAIL,
    password: "secret123",
    role: "nurse",
    phone: "9888877777",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.staff.activeBookings, 0);
  assert.equal(created.body.staff.role, "nurse");
  assert.equal(created.body.staff.email, NEW_STAFF_EMAIL);
  assert.match(created.body.staff.id, UUID_RE);
  const dup = await a.post("/api/admin/staff", { name: "Anil", email: NEW_STAFF_EMAIL, password: "secret123", role: "nurse" });
  assert.equal(dup.status, 409, JSON.stringify(dup.body));

  // The new nurse can sign in with the password set by the admin.
  const login = await staffToken(NEW_STAFF_EMAIL, "secret123");
  assert.equal(login.user.role, "nurse");
  assert.equal(login.user.name, "Anil Kumar");
  assert.equal((await a.get("/api/admin/staff?role=nurse")).body.staff.length, 4);

  const off = await a.patch(`/api/admin/staff/${created.body.staff.id}`, { isActive: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(off.body.staff.isActive, false);

  // A deactivated account is locked out of the API even with a live session.
  const blocked = await as(login.token).get("/api/auth/me");
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, "inactive");
  // A fresh sign-in either fails outright or yields a token the API refuses.
  const again = await anonClient().auth.signInWithPassword({ email: NEW_STAFF_EMAIL, password: "secret123" });
  if (again.data.session) {
    assert.equal((await as(again.data.session.access_token).get("/api/auth/me")).status, 403);
  } else {
    assert.ok(again.error);
  }

  const on = await a.patch(`/api/admin/staff/${created.body.staff.id}`, { isActive: true, specialization: "Geriatric care" });
  assert.equal(on.status, 200);
  assert.equal(on.body.staff.isActive, true);
  assert.equal(on.body.staff.specialization, "Geriatric care");
  assert.equal((await a.patch("/api/admin/staff/00000000-0000-0000-0000-000000000000", { isActive: true })).status, 404);
});

test("customers, packages, services and leads", async () => {
  const customers = await a.get("/api/admin/customers");
  assert.equal(customers.status, 200, JSON.stringify(customers.body));
  const rahul = customers.body.customers.find((c: { phone: string }) => c.phone === "9876543210");
  assert.ok(rahul, "Rahul is listed");
  assert.equal(rahul.bookingCount, 3);

  const pk = await a.get("/api/admin/packages");
  assert.equal(pk.status, 200);
  assert.equal(pk.body.packages.length, 4);
  const first = pk.body.packages[0] as Package;
  const upd = await a.patch(`/api/admin/packages/${first.id}`, { isActive: false, price: 499 });
  assert.equal(upd.status, 200, JSON.stringify(upd.body));
  assert.equal(upd.body.package.isActive, false);
  assert.equal(upd.body.package.price, 499);
  const catalog = await anon.get("/api/catalog");
  assert.equal(catalog.body.packages.length, 3, "inactive packages are hidden publicly");
  assert.equal((await a.get("/api/admin/packages")).body.packages.length, 4, "admin still sees inactive packages");
  const restored = await a.patch(`/api/admin/packages/${first.id}`, { isActive: true, price: first.price });
  assert.equal(restored.status, 200);
  assert.equal((await anon.get("/api/catalog")).body.packages.length, 4);

  const newPkg = await a.post("/api/admin/packages", { name: "Senior Care", serviceCodes: ["BP", "ECG"], price: 999, mrp: 1200 });
  assert.equal(newPkg.status, 201, JSON.stringify(newPkg.body));
  assert.equal(newPkg.body.package.slug, NEW_PACKAGE_SLUG);
  assert.match(newPkg.body.package.id, UUID_RE);
  assert.equal((await a.post("/api/admin/packages", { name: "Senior Care", serviceCodes: ["BP"], price: 1, mrp: 2 })).status, 409);
  assert.equal((await a.post("/api/admin/packages", { name: "Broken", serviceCodes: ["NOPE"], price: 1, mrp: 2 })).status, 400);

  const svc = await a.patch("/api/admin/services/bp", { price: 249 });
  assert.equal(svc.status, 200, JSON.stringify(svc.body));
  assert.equal(svc.body.service.price, 249);
  assert.equal(svc.body.service.code, "BP");
  assert.equal((await anon.get("/api/catalog")).body.services.find((s: { code: string }) => s.code === "BP").price, 249);
  const back = await a.patch("/api/admin/services/BP", { price: 199 });
  assert.equal(back.status, 200);
  assert.equal(back.body.service.price, 199);
  assert.equal((await a.patch("/api/admin/services/NOPE", { price: 1 })).status, 404);

  const leads = await a.get("/api/admin/leads");
  assert.equal(leads.status, 200);
  assert.equal(leads.body.leads.length, 5);
  for (const l of leads.body.leads) {
    assert.match(l.id, UUID_RE);
    assert.ok(l.name && l.phone && l.city && l.createdAt);
  }
});
