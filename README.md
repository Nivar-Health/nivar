# Nivar

At-home health check-ups, done by full-time Nivar nurses and reviewed live by Nivar doctors.

A patient books a check-up (BP, ECG, sugar, heart rate, SpO2, stethoscope).
A nurse visits with Nivar's smart ECG and smart stethoscope, which stream readings live.
A doctor in the clinic watches the readings live, video-consults the patient and publishes a report.

## Stack

- `apps/web` - Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui. Landing page, patient app, nurse, doctor and admin portals, and the API as route handlers under `/api/*`.
- Supabase - Postgres (schema in `supabase/migrations`), Auth (phone OTP for patients, email and password for staff) and Realtime (live readings, nurse tracking, status updates and video-call signalling).

## Run locally

Requirements: Node 22+, pnpm, a Supabase project.

1. Install dependencies:

```bash
pnpm install
```

2. Create `apps/web/.env.local` with your project's keys (Project Settings, API):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. In the Supabase dashboard, Authentication, Providers, Phone: enable the provider and add the demo test numbers `+919876543210=123456`, `+919123400001=123456`, `+919123400002=123456`.

4. Apply the schema, seed the demo data and start the app:

```bash
pnpm db:push
```

```bash
pnpm seed
```

```bash
pnpm dev
```

- Web and API: http://localhost:3100 (health check at http://localhost:3100/api/health)

## Demo accounts

| Role | Login | Password / OTP |
|---|---|---|
| Patient | phone 9876543210 at `/login` | OTP 123456 |
| Admin | admin@nivar.health at `/staff/login` | nivar123 |
| Doctor | ananya@nivar.health | nivar123 |
| Nurse | priya@nivar.health | nivar123 |

See `docs/DEMO.md` for the investor walkthrough.

## Demo-mode stand-ins

These are deliberately simulated for the MVP and isolated so they can be swapped for real providers:

- Payments: mock checkout (later Razorpay).
- OTP: fixed `123456` (later an SMS provider).
- Smart devices: in-browser ECG and stethoscope simulators streaming over Supabase Realtime (later the real device feeds).
- Maps: Leaflet + OpenStreetMap tiles.
- Video: peer-to-peer WebRTC with Supabase Realtime signalling (later a managed provider for production NAT traversal).

## Tests

```bash
pnpm test
```

```bash
pnpm lint
```

## Deploy

One Next.js app, so any Next.js host works. On Vercel: import the repository, set the project's Root Directory to `apps/web`, and add the three Supabase variables from `.env.local` as environment variables.
The live features use Supabase Realtime, so no long-running server is needed.
