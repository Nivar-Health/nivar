# Nivar

At-home health check-ups, done by full-time Nivar nurses and reviewed live by Nivar doctors.

A patient books a check-up (BP, ECG, sugar, heart rate, SpO2, stethoscope).
A nurse visits with Nivar's smart ECG and smart stethoscope, which stream readings live.
A doctor in the clinic watches the readings live, video-consults the patient and publishes a report.

## Stack

- `apps/web` - Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui. Landing page, patient app, nurse, doctor and admin portals, and the API as route handlers under `/api/*`.
- Supabase - Postgres (schema in `supabase/migrations`), Auth (phone OTP for patients, email and password for staff) and Realtime (live readings, nurse tracking, status updates and video-call signalling).

## Run locally

Requirements: Node 22+, pnpm, Docker Desktop (about 3 GB of images; 4 GB more with the optional Studio dashboard).

```bash
pnpm install
```

```bash
pnpm setup
```

`pnpm setup` runs four steps, which you can also run on their own:
- `pnpm supabase:env` generates local secrets into `supabase/docker/.env` and `apps/web/.env.local` (first time only).
- `pnpm supabase:up` starts self-hosted Supabase from `docker-compose.yml`: Postgres (host port 54332), Auth, REST and Realtime behind a gateway on http://localhost:8000.
- `pnpm db:migrate` applies `supabase/migrations`.
- `pnpm seed` loads the demo data.

Then start the app:

```bash
pnpm dev
```

- Web and API: http://localhost:3100 (health check at http://localhost:3100/api/health)
- Optional dashboard: `pnpm supabase:studio`, then http://localhost:8000 (user `supabase`, password in `supabase/docker/.env`).
- Stop the backend with `pnpm supabase:down`; data is kept.

Patient phone OTPs for the demo and test numbers (`9876543210`, `9123400001`, `9123400002`) are fixed at `123456`, so no SMS provider is needed.

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

The app is one Next.js project and works with hosted Supabase as well as the local stack: create a Supabase project, apply `supabase/migrations` to it, and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` on the host (on Vercel, Root Directory `apps/web`).
