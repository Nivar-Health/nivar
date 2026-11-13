# Nivar investor demo

About 8 minutes.
One booking goes from the patient's phone to a published doctor's report, across four screens that update live.

## Before the meeting (10 minutes before)

1. Start the backend, reset the demo data and start the app (first time on a machine: `pnpm setup` instead of the first two):

```bash
pnpm supabase:up
```

```bash
pnpm seed
```

```bash
pnpm dev
```

2. Open four Chrome windows side by side (use separate windows, not tabs, so all four are visible):

| Window | URL | Sign in |
|---|---|---|
| Patient (narrow, phone-sized) | http://localhost:3100/login | "Use demo patient", then "Autofill" the OTP |
| Admin | http://localhost:3100/staff/login | "Admin" chip, Sign in |
| Nurse (narrow, phone-sized) | http://localhost:3100/staff/login | "Nurse" chip, Sign in |
| Doctor | http://localhost:3100/staff/login | "Doctor" chip, Sign in |

Each window keeps its own login, so all four can stay signed in at once.

3. Allow camera and microphone on localhost in Chrome, so the video consult shows real video.

## The story

**1. Landing page (30 s).**
Open http://localhost:3100 and scroll: the nurse-first hero, services and check-up packages with prices, the "How Nivar compares." table, the live readings demo and the callback form.

**2. Patient books (1 min).**
In the patient window: Book, pick "Heart Check", Myself, the saved home address, then **Earliest today** (the next available nurse), then Pay.
The checkout is a mock; pick GPay and the "Pay ₹1,499" button.
The visit page now says "Booking confirmed. We are assigning your nurse and doctor."

**3. Admin assigns (30 s).**
The booking has already appeared under "Needs assignment" on the admin dashboard, with a toast.
Click Assign: the nearest nurse and a cardiologist are pre-suggested.
Confirm, and point at the patient's phone: the care team cards appear instantly.

**4. Nurse drives over (1 min).**
In the nurse window: Open visit, Start trip.
The drive is simulated; the patient sees the nurse moving on the map with a live ETA.
When the map says the nurse has arrived, tap "I've arrived", then "Begin tests".

**5. Tests stream to the doctor (2 min).**
Nurse enters BP 138/88 (flagged Elevated) and heart rate.
Sugar and SpO2 are not part of a Heart Check, so they sit under "Add another reading": tap it to enter them.
Tap "Connect smart ECG" and "Connect smart stethoscope".
Switch to the doctor window: the patient is under "Live now"; open the workspace.
The ECG and heart sounds stream live; click Listen on the stethoscope to hear the heartbeat.
Back on the nurse: choose what you heard on the stethoscope card (no finding is preselected, and capture stays off until one is chosen), tap "Capture 10s reading" on both devices, then "Start doctor consult".

**6. Video call (1 min).**
The patient sees "Join video call with Dr. Ananya"; the doctor and the nurse can join the same call.

**7. Report (1.5 min).**
Doctor: pick "Stage 1 hypertension", click "Insert findings" (it writes the summary from the live readings), add Telmisartan 40 mg, pick advice and follow-up, then "End consult and publish report" and confirm with "Publish".
The patient's phone flips to "Your report is ready".
Open "View full report": letterhead, vitals table, ECG strip, prescription, signature.
"Save or print" prints a clean A4 report.

## Notes

- "Earliest today" is always bookable while demo mode is on (the default), so the demo works at any hour.
- Demo aids (the demo accounts, the demo OTP, the simulated drive, the test card) show while demo mode is on. Set `NEXT_PUBLIC_DEMO_MODE=false` at launch to hide them; "Earliest today" is then offered only during working hours.
- Callback requests from the public form are under "Callbacks" in the admin nav.
- Run `pnpm seed` again between rehearsals; it resets bookings and keeps every login working.
- Demo-mode stand-ins (payment, OTP, devices, video signalling) are listed in the README.
