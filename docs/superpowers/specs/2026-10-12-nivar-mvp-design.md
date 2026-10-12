# Nivar MVP - Design Spec

Date: 2026-10-12
Status: approved by founder (chat), building for investor demo the same evening.

## 1. Product

Nivar is "Urban Company for healthcare check-ups".
A patient books an at-home check-up (BP, ECG, blood sugar, heart rate, SpO2, stethoscope auscultation).
A full-time Nivar nurse travels to the patient with smart devices.
The smart ECG and smart stethoscope stream readings to the Nivar server.
A full-time Nivar doctor, sitting in the clinic, watches the readings live, video-consults the patient, and publishes a report with diagnosis and prescription.

The MVP must let the founder walk investors through four complete journeys end to end on one laptop: Patient, Admin, Nurse, Doctor.

## 2. Non-goals for this MVP

- Real payment gateway (mock checkout that always succeeds).
- Real SMS OTP (fixed demo OTP `123456`, shown on screen).
- Real device integration (in-browser device simulator streams realistic signals).
- Google Maps (Leaflet + OpenStreetMap tiles, no API key).
- Third-party video provider (built-in WebRTC with Socket.io signalling).
- Native mobile apps (web only, mobile-responsive).

Each of these sits behind a small module so it can be swapped later.

## 3. Architecture

```
nivar/
  docker-compose.yml        MongoDB 7 on host port 27018, named volume
  package.json              pnpm workspace root; `pnpm dev` runs api + web
  pnpm-workspace.yaml
  apps/api                  Node + Express 5 + Mongoose + Socket.io + zod + JWT
  apps/web                  Next.js (App Router, TS) + Tailwind + shadcn/ui
```

- Web: http://localhost:3100
- API: http://localhost:4100 (REST under `/api`, Socket.io on the same server)
- MongoDB: `mongodb://localhost:27018/nivar`
- Web reads `NEXT_PUBLIC_API_URL` (default `http://localhost:4100`).
- API reads `PORT`, `MONGO_URL`, `JWT_SECRET`, `WEB_ORIGIN` from `.env` with safe dev defaults.

### Auth

- JWT (HS256, 7 day expiry), sent as `Authorization: Bearer <token>`.
- Web stores the token (`nivar_token`) in `sessionStorage` (per tab) and mirrors it to `localStorage`.
  On load it prefers `sessionStorage`, falling back to `localStorage`.
  So each browser tab can be a different role during the demo, and a fresh tab inherits the last login.
- Roles: `customer`, `nurse`, `doctor`, `admin`.
- Customer login: phone + OTP. `POST /api/auth/otp/request` returns `{ demoOtp: "123456" }`; the UI shows it as a hint. Verify creates the customer on first login.
- Staff login: email + password (bcrypt).
- Socket.io handshake passes the token in `auth.token`; the server rejects invalid tokens.

## 4. Data model (Mongoose)

All documents have `createdAt`, `updatedAt`. API responses expose `id` (string) instead of `_id`, no `__v`, never `passwordHash`.

### User

| field | type | notes |
|---|---|---|
| name | string | |
| role | enum | customer, nurse, doctor, admin |
| phone | string | unique sparse; customers (10 digit Indian mobile) |
| email | string | unique sparse; staff |
| passwordHash | string | staff only |
| avatarUrl | string | optional |
| gender | enum | male, female, other (optional) |
| dob | date | optional |
| addresses | Address[] | customers |
| specialization | string | doctors, e.g. "Cardiologist" |
| qualifications | string | doctors/nurses, e.g. "MBBS, MD (Medicine)" |
| yearsExperience | number | staff |
| registrationNo | string | doctors (medical council) |
| baseLocation | {lat, lng, label} | nurses: hub they start from |
| isActive | boolean | default true |

Address: `{ id, label ("Home"), line1, area, city, pincode, lat, lng }`.

### Service (individual test)

`{ code, name, shortName, description, price, durationMin, requiresDevice: "ecg" | "stethoscope" | null, icon }`

Codes: `BP`, `ECG`, `SUGAR`, `HR`, `SPO2`, `STETH`, `CONSULT`.

### Package

`{ slug, name, tagline, description, serviceCodes: string[], price, mrp, popular: boolean, isActive: boolean, sortOrder }`

### Booking

| field | type | notes |
|---|---|---|
| code | string | human id, `NV-1001` and up |
| customer | ref User | |
| patient | {name, age, gender, relation} | relation: self, parent, spouse, child, other |
| address | Address snapshot | |
| packageId | ref Package | optional |
| serviceCodes | string[] | final list of tests |
| scheduledDate | string | `YYYY-MM-DD` |
| slot | string | e.g. `09:00-10:00` |
| amount | number | INR |
| payment | {status: pending, paid, refunded; method: upi, card, netbanking, cash; txnId; paidAt} | |
| status | enum | see 4.1 |
| nurse | ref User | |
| doctor | ref User | |
| timeline | [{status, at, by (name), note}] | append on every status change |
| nurseLocation | {lat, lng, updatedAt} | latest live location |
| vitals | {bpSystolic, bpDiastolic, sugar, sugarType: fasting, random, pp; heartRate, spo2, temperatureF, weightKg, recordedAt} | |
| ecg | {samples: number[] (≈10 s at 250 Hz, mV), sampleRate, heartRate, rhythm, interpretation, capturedAt} | |
| stethoscope | {heartRate, findings, samples: number[] (downsampled envelope), capturedAt} | |
| report | {diagnosis, summary, prescription: [{medicine, dosage, frequency, duration, notes}], advice: string[], followUp, publishedAt} | |
| rating | {score 1-5, comment} | |
| notes | string | patient's symptoms / instructions |

#### 4.1 Booking status machine

```
pending_payment -> confirmed -> assigned -> en_route -> arrived -> testing -> consult -> reporting -> completed
any state before arrived -> cancelled
```

| status | patient sees | who moves it |
|---|---|---|
| pending_payment | "Complete payment" | created by customer |
| confirmed | "Booking confirmed, assigning your care team" | `POST /pay` |
| assigned | nurse + doctor cards | admin `POST /assign` |
| en_route | live map | nurse "Start trip" |
| arrived | "Nurse has arrived" | nurse |
| testing | live vitals as entered | nurse |
| consult | "Join video consult" button | nurse "Start doctor consult" |
| reporting | "Doctor is preparing your report" | doctor ends call |
| completed | report | doctor publishes |
| cancelled | | customer or admin |

The API enforces allowed transitions and the role allowed to make each one; invalid ones return 409.

## 5. REST API

All JSON. Errors: `{ error: { message, code } }` with proper HTTP status.
Validation with zod; 400 on bad input.

### Public
- `GET /api/health` -> `{ ok: true }`
- `GET /api/catalog` -> `{ services: Service[], packages: Package[] }` (active only)
- `GET /api/slots?date=YYYY-MM-DD` -> `{ date, slots: [{ slot, available }] }` hourly 07:00-20:00; past slots for today unavailable; a slot with 3 or more bookings is unavailable.
- `POST /api/leads` `{ name, phone, city, message? }` -> `{ ok: true }` (landing callback form)

### Auth
- `POST /api/auth/otp/request` `{ phone }` -> `{ ok: true, demoOtp: "123456", isNewUser }`
- `POST /api/auth/otp/verify` `{ phone, otp, name? }` -> `{ token, user }`
- `POST /api/auth/login` `{ email, password }` -> `{ token, user }` (staff)
- `GET /api/auth/me` -> `{ user }`
- `PATCH /api/me` `{ name?, gender?, dob?, addresses? }` -> `{ user }`

### Bookings
- `POST /api/bookings` (customer) `{ patient, address, packageId?, serviceCodes, scheduledDate, slot, notes? }` -> `{ booking }`; server computes `amount` (package price, or sum of service prices).
- `POST /api/bookings/:id/pay` (customer owner) `{ method }` -> `{ booking }`; sets payment paid, fake `txnId`, status `confirmed`.
- `GET /api/bookings?status=&date=&scope=active|past` -> `{ bookings }`, role-scoped (customer: own; nurse/doctor: assigned to them; admin: all). Sorted by scheduledDate, slot.
- `GET /api/bookings/:id` -> `{ booking }` with `customer`, `nurse`, `doctor` populated (public profile fields only). 403 if not allowed.
- `POST /api/bookings/:id/assign` (admin) `{ nurseId, doctorId }` -> `{ booking }`
- `POST /api/bookings/:id/status` (nurse/doctor/admin per machine) `{ status, note? }` -> `{ booking }`
- `PUT /api/bookings/:id/vitals` (assigned nurse) partial vitals -> `{ booking }`
- `PUT /api/bookings/:id/ecg` (assigned nurse) `{ samples, sampleRate, heartRate, rhythm }` -> `{ booking }`
- `PUT /api/bookings/:id/stethoscope` (assigned nurse) `{ heartRate, findings, samples }` -> `{ booking }`
- `PUT /api/bookings/:id/report` (assigned doctor) `{ diagnosis, summary, prescription, advice, followUp, publish?: boolean }` -> `{ booking }`; `publish: true` sets `publishedAt` and status `completed`.
- `POST /api/bookings/:id/cancel` (owner or admin) `{ reason? }`
- `POST /api/bookings/:id/rate` (owner, completed only) `{ score, comment? }`

### Admin
- `GET /api/admin/stats` -> `{ today: { bookings, completed, inProgress }, revenue: { today, month, total }, counts: { customers, nurses, doctors }, statusBreakdown: {status: n}, last7Days: [{ date, bookings, revenue }] }`
- `GET /api/admin/staff?role=nurse|doctor` -> `{ staff: (User & { activeBookings: number })[] }`
- `POST /api/admin/staff` `{ name, email, password, role, phone?, specialization?, qualifications?, yearsExperience? }`
- `PATCH /api/admin/staff/:id` (any of the above + `isActive`)
- `GET /api/admin/customers` -> `{ customers: (User & { bookingCount })[] }`
- `GET /api/admin/packages`, `POST /api/admin/packages`, `PATCH /api/admin/packages/:id`
- `PATCH /api/admin/services/:code` `{ price?, description? }`
- `GET /api/admin/leads` -> `{ leads }`

## 6. Realtime (Socket.io)

Connect to the API origin with `auth: { token }`.
On connect, the server auto-joins `user:<userId>` and, for admins, `admin`.

Client -> server:
- `booking:join` `{ bookingId }` (server checks access, joins `booking:<id>`), `booking:leave` `{ bookingId }`
- `nurse:location` `{ bookingId, lat, lng }` (assigned nurse only; server persists at most every 3 s and always rebroadcasts)
- `device:ecg` `{ bookingId, samples: number[], sampleRate, heartRate, t }` (chunks ≈100 ms, rebroadcast only)
- `device:steth` `{ bookingId, samples: number[], heartRate, t }` (rebroadcast only)
- `device:status` `{ bookingId, device: "ecg" | "stethoscope", state: "connecting" | "streaming" | "stopped" }`
- `rtc:join` `{ bookingId }` -> server joins `call:<id>` and emits `rtc:peers` `{ peers: [{ socketId, name, role }] }` to the joiner and `rtc:peer-joined` to others
- `rtc:signal` `{ to: socketId, data }` -> server forwards `rtc:signal` `{ from, data }`
- `rtc:leave` `{ bookingId }` -> others get `rtc:peer-left` `{ socketId }`

Server -> client:
- `booking:updated` `{ booking }` to `booking:<id>`, the customer's, nurse's and doctor's `user:` rooms, and `admin`, after every mutation.
- `nurse:location` `{ bookingId, lat, lng, at }` to `booking:<id>`
- `device:ecg`, `device:steth`, `device:status` to `booking:<id>`
- `notify` `{ title, body, bookingId? }` to a `user:` room (e.g. "New visit assigned").

## 7. Web app

### Design direction

Calm, clinical, warm and Indian, not generic SaaS blue.
- Colours (CSS variables, shadcn theme): background warm ivory `#FAF7F2`, ink `#132321`, primary deep teal `#0E5E52`, primary-foreground `#F4FBF8`, accent saffron `#F2A33A`, soft mint surface `#E6F2EE`, danger `#C2453D`, muted text `#5B6B67`, border `#E5E0D6`.
- Type: display "Fraunces" (headings, numbers on landing), UI and body "Plus Jakarta Sans", via `next/font/google`.
- Radius 14 px on cards, generous whitespace, subtle borders over heavy shadows, lucide icons.
- Live medical signals (ECG trace) drawn in teal on a faint grid, the signature visual element across landing, nurse and doctor screens.
- Mobile-first for patient and nurse screens (they are phones in the real world); doctor and admin are desktop-first but must not break on mobile.
- All money in INR with `₹` and Indian grouping (`Intl.NumberFormat('en-IN')`).
- No em dashes in UI copy.

### Routes

Public:
- `/` landing: nav, hero (headline, sub, "Book a home check-up" CTA, live ECG motif), trust strip (full-time doctors, certified nurses, 60 min reports, NABH-style standards wording without false claims), how it works (4 steps), services and packages (from `/api/catalog`), smart devices section (ECG + stethoscope streaming to doctor), "Our doctors are Nivar employees, not gig workers", city coverage (Bangalore), testimonials, FAQ (accordion), callback lead form (`POST /api/leads`), footer.
- `/login` customer phone OTP (supports `?next=`), `/staff/login` staff email/password with demo-account quick-fill chips.

Patient (`/app`, role customer, mobile-first with bottom nav):
- `/app` home: greeting, active booking card with live status, quick "Book a check-up", past reports.
- `/app/book` wizard: 1) choose package or tests (cart summary sticky) 2) patient details (self or family) 3) address (saved or new; "use my location" fills lat/lng; fallback to area centroid) 4) date + slot 5) review and pay (mock checkout sheet: UPI / card / netbanking, processing animation, success) -> redirect to booking page.
- `/app/bookings/[id]`: status stepper with timeline; care team cards (nurse, doctor with credentials); live map when `en_route` (nurse dot moving, patient home pin, ETA text); live vitals as nurse records them; "Join video consult" when `consult`; report when `completed`; cancel when allowed; rate after completion.
- `/app/bookings/[id]/report`: printable report (letterhead, patient, vitals table with normal ranges and flags, ECG strip, stethoscope summary, diagnosis, prescription table, advice, doctor signature block, "Download PDF" = `window.print()` with print CSS).
- `/app/bookings`: all bookings list. `/app/profile`: name, family not needed, saved addresses, logout.

Nurse (`/nurse`, mobile-first):
- `/nurse`: today's visits list (time, patient, area, tests, status), next visit highlighted.
- `/nurse/visits/[id]`: step-based flow driven by status: Start trip (starts sharing browser geolocation; "Simulate drive" moves from `baseLocation` to patient address over about 45 s) -> Mark arrived -> Testing panel: vitals form (BP, sugar, HR, SpO2, temp) saved live; device cards "Connect Smart ECG" / "Connect Smart Stethoscope" (simulated pairing 2 s, then streaming live signal, "Capture 10 s reading" saves to API) -> "Start doctor consult" (status consult, joins video too) -> wait for doctor -> "Visit complete" view once reporting.

Doctor (`/doctor`, desktop-first):
- `/doctor`: consult queue (live: patients currently in `testing` or `consult` first), upcoming assigned, completed today; KPIs.
- `/doctor/consults/[id]`: three-column workspace. Left: patient profile, symptoms, vitals with flags. Centre: live ECG monitor (scrolling canvas, HR readout, "LIVE" pulse) and stethoscope monitor (waveform plus "Listen" toggle that plays a synthesized lub-dub at the streamed HR via WebAudio); captured strips when not live. Right / overlay: video call panel with patient and nurse. Bottom: report editor (diagnosis, summary, prescription rows add/remove, advice, follow-up, quick templates), "End consult" (status reporting), "Publish report" (completed).

Admin (`/admin`, desktop-first with sidebar):
- `/admin`: KPI cards, 7-day bookings/revenue chart, status breakdown, live feed of booking updates, "Needs assignment" list.
- `/admin/bookings`: filterable table; row opens `/admin/bookings/[id]`: details, timeline, assign nurse + doctor (selects show current load), cancel, live map when en route.
- `/admin/staff`: nurses and doctors tabs, add staff dialog, activate or deactivate.
- `/admin/packages`: packages and service prices, edit dialog, toggle active.
- `/admin/customers`, `/admin/leads`: simple tables.

### Shared web modules

- `lib/api.ts` typed fetch wrapper (`api.get/post/put/patch`), attaches token, throws `ApiError`.
- `lib/types.ts` TS types mirroring section 4.
- `lib/auth.tsx` `AuthProvider`, `useAuth()`, `RequireRole` guard (redirects to the right login).
- `lib/socket.ts` singleton socket, `useBookingRoom(id)` (joins room, returns live booking, nurse location, device streams).
- `lib/format.ts` currency, dates, status labels and colours.
- `components/ecg-monitor.tsx` scrolling canvas fed by sample chunks; also a static `EcgStrip`.
- `components/steth-monitor.tsx` + `lib/heart-sound.ts` (WebAudio).
- `lib/device-sim.ts` synthetic ECG (PQRST at configurable HR with noise and baseline wander, 250 Hz) and phonocardiogram envelope generators, producing 100 ms chunks.
- `components/live-map.tsx` react-leaflet, client only (`dynamic(..., { ssr: false })`).
- `components/video-call.tsx` WebRTC mesh (up to 3 peers: patient, nurse, doctor) using `rtc:*` events, public Google STUN; mic and camera toggles, leave; if `getUserMedia` fails, joins receive-only and shows an avatar tile.
- `components/status-badge.tsx`, `components/booking-stepper.tsx`, role layouts (`app-shell`, `staff-shell`).

## 8. Seed data (`pnpm seed`, idempotent: wipes and recreates)

- Admin: `admin@nivar.health` / `nivar123`.
- Doctors (password `nivar123`): Dr. Ananya Rao (Cardiologist, MD DM, 14 yrs) `ananya@nivar.health`, Dr. Vikram Shetty (General Physician, MBBS MD, 9 yrs) `vikram@nivar.health`.
- Nurses (password `nivar123`): Priya Nair `priya@nivar.health` (hub Indiranagar), Kavya Reddy `kavya@nivar.health` (hub HSR Layout), Meera Joseph `meera@nivar.health` (hub Koramangala).
- Customer: Rahul Mehta, phone `9876543210`, address Indiranagar 100 Ft Road (real Bangalore lat/lng), plus 6 more customers.
- Services with INR prices: BP ₹199, ECG ₹799, Sugar ₹149, HR ₹99, SpO2 ₹99, Stethoscope ₹399, Doctor consult ₹499.
- Packages: "Essential Vitals" (BP, SUGAR, HR, SPO2) ₹449 (mrp ₹546); "Heart Check" (BP, ECG, STETH, HR, CONSULT) ₹1,499 (mrp ₹2,195, popular); "Complete Home Check-up" (all) ₹1,899 (mrp ₹2,643); "Diabetes Care" (SUGAR, BP, HR, CONSULT) ₹899 (mrp ₹946).
- About 40 historical bookings over the last 30 days across customers, mostly completed with realistic vitals, ECG samples, and reports, so admin charts and patient history look alive.
- Today for Rahul: nothing active, so the live demo starts clean. Today's queue for Priya and Dr. Ananya contains 1-2 other visits.

## 9. Demo script (docs/DEMO.md)

Four tabs or windows in one browser: Patient (mobile viewport), Admin, Nurse (mobile viewport), Doctor.
Tokens are per tab (`sessionStorage`), so they do not collide.
Script covers the full happy path in about 10 minutes plus talking points.

## 10. Quality bar

- `pnpm dev` from a clean clone after `docker compose up -d` and `pnpm seed` works.
- API: integration smoke test script covering auth, booking lifecycle, permissions (`pnpm --filter api test`, node:test + supertest against a test database).
- Web: `pnpm --filter web build` and `lint` pass with no errors.
- End-to-end walkthrough of all four journeys verified in a real browser before handoff.
