# Nivar investor demo

About 8 minutes.
One booking goes from the patient's phone to a published doctor's report, across four screens that update live.

## Before the meeting (10 minutes before)

1. Reset the demo data and start the app (needs `apps/web/.env.local` with the Supabase keys, see the README):

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
Open http://localhost:3100 and scroll: live ECG in the hero, packages with prices, the "Doctors on payroll, not on call" comparison.

**2. Patient books (1 min).**
In the patient window: Book, pick "Heart Check", Myself, the saved home address, then **Express visit** (nurse within 60 minutes), then Pay.
The checkout is a mock; pick GPay and "Pay securely".
The visit page now says "Assigning your care team".

**3. Admin assigns (30 s).**
The booking has already appeared under "Needs assignment" on the admin dashboard, with a toast.
Click Assign: the nearest nurse and a cardiologist are pre-suggested.
Confirm, and point at the patient's phone: the care team cards appear instantly.

**4. Nurse drives over (1 min).**
In the nurse window: Open visit, Start trip.
The drive is simulated; the patient sees the nurse moving on the map with a live ETA.
When the map says she has arrived, tap "I've arrived", then "Begin tests".

**5. Tests stream to the doctor (2 min).**
Nurse enters BP 138/88 (flagged Elevated), heart rate, sugar, SpO2.
Tap "Connect Smart ECG" and "Connect Smart Stethoscope".
Switch to the doctor window: the patient is under "Live now"; open the workspace.
The ECG and heart sounds stream live; click Listen on the stethoscope to hear the heartbeat.
Back on the nurse: Capture 10s on both devices (pick a stethoscope finding first), then "Start doctor consult".

**6. Video consult (1 min).**
The patient sees "Join video consult with Dr. Ananya"; the doctor and the nurse can join the same call.

**7. Report (1.5 min).**
Doctor: pick "Stage 1 hypertension", click "Insert findings" (it writes the summary from the live readings), add Telmisartan 40 mg, pick advice and follow-up, then "End consult and publish report".
The patient's phone flips to "Your report is ready".
Open "View full report": letterhead, vitals table, ECG strip, prescription, signature.
"Download PDF" prints a clean A4 report.

## Notes

- Express visits are always bookable today, so the demo works at any hour.
- Run `pnpm seed` again between rehearsals; it resets bookings and keeps every login working.
- Demo-mode stand-ins (payment, OTP, devices, video signalling) are listed in the README.
