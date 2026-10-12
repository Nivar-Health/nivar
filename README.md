# Nivar

At-home health check-ups, done by full-time Nivar nurses and reviewed live by Nivar doctors.

A patient books a check-up (BP, ECG, sugar, heart rate, SpO2, stethoscope).
A nurse visits with Nivar's smart ECG and smart stethoscope, which stream readings to the server.
A doctor in the clinic watches the readings live, video-consults the patient and publishes a report.

## Stack

- `apps/web` - Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui. Landing page, patient app, nurse, doctor and admin portals.
- `apps/api` - Node.js, Express 5, Mongoose, Socket.io, JWT auth.
- MongoDB 7 in Docker.

## Run locally

Requirements: Node 22+, pnpm, Docker.

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
pnpm seed
```

```bash
pnpm dev
```

- Web: http://localhost:3100
- API: http://localhost:4100/api/health
- MongoDB: mongodb://localhost:27018/nivar

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
- Smart devices: in-browser ECG and stethoscope simulators streaming over Socket.io (later the real device feeds).
- Maps: Leaflet + OpenStreetMap tiles.
- Video: peer-to-peer WebRTC with Socket.io signalling (later a managed provider for production NAT traversal).

## Tests

```bash
pnpm test
```

```bash
pnpm lint
```
