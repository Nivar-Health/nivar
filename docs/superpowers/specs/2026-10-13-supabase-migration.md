# Nivar on Next.js + Supabase

Replaces the Express + MongoDB + Socket.io backend with Next.js route handlers, Supabase Postgres, Supabase Auth and Supabase Realtime.
The web app's public contracts stay the same: every `/api/*` path, payload and error shape from the MVP spec (section 5), and the client hooks in `lib/api.ts`, `lib/auth.tsx` and `lib/socket.ts`.
Pages and components do not change unless noted.

## 1. Layout

- `apps/web` is the whole product. `apps/api`, `docker-compose.yml` and MongoDB are removed once parity is reached.
- `supabase/migrations/*.sql` holds the schema. Apply with `pnpm supabase db push` (Supabase CLI via `pnpm dlx supabase`).
- `apps/web/src/server/*` holds server-only code (admin client, auth, validation, booking logic, realtime publishing).
- `apps/web/src/app/api/**/route.ts` holds the route handlers, one folder per path.
- `apps/web/scripts/seed.ts` seeds the cloud project (`pnpm seed`).

Environment (`apps/web/.env.local`, git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 2. Database

Postgres, schema `public`. Ids are uuids. Nested booking parts stay JSON so the API payload shape is unchanged.

```
profiles        id uuid pk (= auth.users.id), role, name, phone, email, avatar_url, gender, dob,
                addresses jsonb[], specialization, qualifications, years_experience, registration_no,
                base_location jsonb, is_active, created_at, updated_at
services        code text pk, name, short_name, description, price, duration_min, requires_device, icon, sort_order
packages        id uuid pk, slug unique, name, tagline, description, service_codes text[], price, mrp,
                popular, is_active, sort_order, created_at, updated_at
bookings        id uuid pk, code text unique (NV-1001 ... from booking_code_seq), customer_id, patient jsonb,
                address jsonb, package_id, service_codes text[], scheduled_date date, slot text, amount int,
                payment jsonb, status booking_status, nurse_id, doctor_id, timeline jsonb[], nurse_location jsonb,
                vitals jsonb, ecg jsonb, stethoscope jsonb, report jsonb, rating jsonb, notes text,
                cancel_reason text, created_at, updated_at
leads           id uuid pk, name, phone, city, message, created_at
```

- `profiles` row is created by a trigger on `auth.users` insert (role `customer`, phone from the auth user).
  Staff are created through the admin API with `auth.admin.createUser` and the profile updated to the staff role.
- `booking_status` is a Postgres enum with the 10 statuses from the MVP spec.
- Row level security is enabled on every table. Route handlers use the service role key, so RLS exists for Realtime authorisation and as defence in depth for any direct client reads.
- Helper `public.booking_access(booking_id uuid)` returns true when `auth.uid()` is the booking's customer, nurse or doctor, or an admin. Used by the Realtime policies.

## 3. Auth

- Staff: `supabase.auth.signInWithPassword({ email, password })` in the browser.
- Patients: `POST /api/auth/otp/request { phone }` validates the number, rejects staff numbers, calls `signInWithOtp({ phone: "+91..." })` with the anon key and returns `{ ok, demoOtp?, isNewUser }`.
  The browser then calls `supabase.auth.verifyOtp({ phone, token, type: "sms" })`.
  Demo numbers are configured as Supabase test numbers (no SMS provider needed): `9876543210`, `9123400001`, `9123400002`, all with OTP `123456`.
- Sessions are kept per tab: the Supabase browser client uses a storage adapter that writes `sessionStorage` and mirrors to `localStorage`, exactly like the old token store, so four roles can be signed in across four tabs.
- Route handlers read `Authorization: Bearer <access_token>`, verify it with `supabase.auth.getUser(token)` (service role client) and load the profile. Unauthenticated -> 401, wrong role -> 403.
- `GET /api/auth/me` returns the profile as the `User` shape. `PATCH /api/me` updates name, gender, dob, addresses.
- Staff `POST /api/auth/login` is removed (the browser signs in directly). The `/api/auth/otp/verify` path is removed too; `loginWithOtp` in `lib/auth.tsx` calls Supabase and then `PATCH /api/me` with the name for new users.

## 4. Realtime

Supabase Realtime Broadcast on private channels. Topics:

| Topic | Who may subscribe and publish | Events |
|---|---|---|
| `booking:<id>` | booking participants and admins | `booking:updated`, `nurse:location`, `device:ecg`, `device:steth`, `device:status`, `rtc:*` |
| `user:<uid>` | that user | `booking:updated`, `notify` |
| `admin` | admins | `booking:updated`, `notify` |

- Policies on `realtime.messages` (select and insert) implement the table above using `booking_access()` and the profile role.
- Server publishes with the REST broadcast endpoint (`realtime.send` is not used): `apps/web/src/server/realtime.ts` exposes `emitBookingUpdated(booking)` and `notifyUsers(ids, notice)` and `notifyAdmins(notice)`.
- Clients publish device chunks and nurse location straight to `booking:<id>` (no server hop). The nurse client also persists its location with `PUT /api/bookings/:id/location { lat, lng }` at most every 3 s.
- WebRTC signalling over the same topic. Each tab has a random `peerId`. Protocol:
  - joiner broadcasts `rtc:join { peerId, name, role }`
  - every peer already in the call answers `rtc:peer-here { to: joinerPeerId, peerId, name, role }`
  - the joiner creates an offer to each `peer-here` (joiner offers, as before)
  - `rtc:signal { to, from, data }` carries SDP and ICE; receivers ignore messages not addressed to them
  - `rtc:leave { peerId }` on leave or unmount
  `VideoCall` keeps its props; `socket` is replaced by a `signalling` adapter from `lib/socket.ts`.
- `lib/socket.ts` keeps every exported hook with the same signature (`useBooking`, `useNurseLocation`, `useDeviceStream`, `useDeviceStatus`, `useSocketEvent`, `useNotifications`, `useSocketConnected`, `emit`). Internally one Supabase client holds the channels; `emit(event, payload)` broadcasts on `booking:<payload.bookingId>`.

## 5. Route handlers

Same paths, methods, bodies, responses and error codes as the MVP spec and the Express implementation. Conventions:

- `withAuth(handler, { roles })` wrapper resolves the user and catches `HttpError` into `{ error: { message, code } }`.
- Validation with zod 4; validation errors -> 400 `validation_error` with the first issue's message.
- The status machine (`server/booking-status.ts`) is a direct port. Transitions are atomic: `update ... where id = $1 and status = $from`; zero rows -> 409 `stale`.
- `GET /api/bookings` omits `ecg.samples` and `stethoscope.samples`; detail and broadcasts include them.
- Admin stats are computed with SQL in Asia/Kolkata (`timezone('Asia/Kolkata', ts)`).

## 6. Seed

`pnpm seed` is idempotent and safe with open tabs:
- services and packages are upserted by code and slug (package ids are uuid v5 of the slug, so they never change),
- demo users are found by email or phone and reused (ids never change),
- bookings and leads are deleted and regenerated with the same data as before (50 bookings over 30 days, today's queue, 2 unassigned, Rahul clean).

## 7. Tests

`apps/web/test/*.test.ts` with `node --test`, run against a dev server (`pnpm test` starts `next dev` on port 3199 if needed) and the real Supabase project.
Tests create their own customers (phones `98111xxxxx`, which are also Supabase test numbers) and staff sign in with the demo accounts.
Coverage matches the previous suite: auth, catalog and slots, express slot, full lifecycle, permission checks, admin stats shape, and a realtime test that receives `booking:updated` on `booking:<id>`.
