import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_OTP,
  PASSWORD,
  PHONES,
  STAFF,
  UUID_RE,
  anon,
  anonClient,
  as,
  customerToken,
  deleteAuthUser,
  findAuthUserByPhone,
  staffToken,
} from "./helpers.ts";

// Phone 9123400002 is made "new" again for the first-login test.
const FRESH = PHONES.spare2;

before(async () => {
  const existing = await findAuthUserByPhone(FRESH);
  if (existing) await deleteAuthUser(existing.id);
});

after(async () => {
  // Restore Rahul's profile name for the other files and the demo.
  const rahul = await customerToken(PHONES.rahul);
  await as(rahul.token).patch("/api/me", { name: "Rahul Mehta" });
});

test("OTP request reports new vs existing users and returns the demo OTP", async () => {
  const fresh = await anon.post("/api/auth/otp/request", { phone: FRESH });
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  assert.equal(fresh.body.ok, true);
  assert.equal(fresh.body.isNewUser, true);
  assert.equal(fresh.body.demoOtp, DEMO_OTP);

  const rahul = await anon.post("/api/auth/otp/request", { phone: "+91 98765 43210" });
  assert.equal(rahul.status, 200, JSON.stringify(rahul.body));
  assert.equal(rahul.body.ok, true);
  assert.equal(rahul.body.isNewUser, false);
});

test("OTP request rejects invalid phone numbers", async () => {
  for (const phone of ["12345", "5876543210", "abcdefghij", ""]) {
    const res = await anon.post("/api/auth/otp/request", { phone });
    assert.equal(res.status, 400, phone);
    assert.equal(res.body.error.code, "validation_error");
    assert.ok(res.body.error.message);
  }
});

test("OTP request rejects staff phone numbers", async () => {
  // Priya's number from the seed: staff sign in with email and password instead.
  const res = await anon.post("/api/auth/otp/request", { phone: "9000000021" });
  assert.ok([400, 403].includes(res.status), `expected 400/403, got ${res.status} ${JSON.stringify(res.body)}`);
  assert.ok(res.body.error.code);
  assert.ok(res.body.error.message);
});

test("OTP verify rejects a wrong code and creates the customer on first login", async () => {
  const sb = anonClient();
  const bad = await sb.auth.verifyOtp({ phone: `+91${FRESH}`, token: "000000", type: "sms" });
  assert.ok(bad.error, "wrong OTP is rejected by Supabase");
  assert.equal(bad.data.session, null);

  const ok = await sb.auth.verifyOtp({ phone: `+91${FRESH}`, token: DEMO_OTP, type: "sms" });
  assert.equal(ok.error, null, ok.error?.message);
  assert.ok(ok.data.session?.access_token);
  const client = as(ok.data.session!.access_token);

  // The profile row exists right away (trigger on auth.users) with the customer role.
  const first = await client.get("/api/auth/me");
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.user.role, "customer");
  assert.equal(first.body.user.phone, FRESH);

  // New users set their name through PATCH /api/me.
  const named = await client.patch("/api/me", { name: "Ira Das" });
  assert.equal(named.status, 200, JSON.stringify(named.body));
  const user = named.body.user;
  assert.equal(user.role, "customer");
  assert.equal(user.phone, FRESH);
  assert.equal(user.name, "Ira Das");
  assert.match(user.id, UUID_RE);
  assert.equal(user._id, undefined);
  assert.equal(user.__v, undefined);
  assert.equal(user.passwordHash, undefined);

  const again = await anon.post("/api/auth/otp/request", { phone: FRESH });
  assert.equal(again.status, 200);
  assert.equal(again.body.isNewUser, false);
});

test("staff sign in works, wrong password fails, and the profile never leaks secrets", async () => {
  const ok = await staffToken(STAFF.priya);
  assert.equal(ok.user.role, "nurse");
  assert.equal(ok.user.name, "Priya Nair");
  assert.equal(ok.user.email, STAFF.priya);
  assert.equal((ok.user as unknown as Record<string, unknown>).passwordHash, undefined);
  assert.ok(ok.user.baseLocation?.lat);
  assert.match(ok.user.id, UUID_RE);

  const bad = await anonClient().auth.signInWithPassword({ email: STAFF.priya, password: "wrong" });
  assert.ok(bad.error, "wrong password is rejected");
  assert.equal(bad.data.session, null);

  const unknown = await anonClient().auth.signInWithPassword({ email: "nobody@nivar.health", password: PASSWORD });
  assert.ok(unknown.error, "unknown email is rejected");
});

test("GET /api/auth/me requires a valid token", async () => {
  const none = await anon.get("/api/auth/me");
  assert.equal(none.status, 401);
  assert.equal(none.body.error.code, "unauthorized");
  assert.equal((await as("garbage").get("/api/auth/me")).status, 401);

  const admin = await staffToken(STAFF.admin);
  const me = await as(admin.token).get("/api/auth/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, STAFF.admin);
  assert.equal(me.body.user.role, "admin");
});

test("PATCH /api/me updates profile and addresses with stable ids", async () => {
  const { token, user } = await customerToken(PHONES.rahul);
  const client = as(token);
  const existing = user.addresses?.[0];
  assert.ok(existing, "Rahul has a seeded address");
  const res = await client.patch("/api/me", {
    name: "Rahul M",
    gender: "male",
    addresses: [existing, { label: "Office", line1: "2nd floor, WeWork Galaxy", area: "Koramangala", pincode: "560034" }],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.user.name, "Rahul M");
  assert.equal(res.body.user.addresses.length, 2);
  assert.equal(res.body.user.addresses[0].id, existing.id);
  assert.ok(res.body.user.addresses[1].id);

  const bad = await client.patch("/api/me", { addresses: [{ label: "x" }] });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "validation_error");

  // Put the address book back the way the seed left it.
  const restored = await client.patch("/api/me", { name: "Rahul Mehta", addresses: [existing] });
  assert.equal(restored.status, 200);
});
