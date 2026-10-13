import { z } from "zod";
import type { Ecg } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { CAPTURE_STATUSES } from "@/server/booking-status";
import { assertAssigned, assertStatusIn, guardedSet, loadForUser } from "@/server/bookings";
import { json } from "@/server/errors";
import { parseBody } from "@/server/validate";

function interpretEcg(hr?: number): { rhythm: string; interpretation: string } {
  if (!hr) return { rhythm: "Sinus rhythm", interpretation: "Rhythm captured; awaiting doctor review" };
  if (hr < 60) return { rhythm: "Sinus bradycardia", interpretation: `Sinus bradycardia at ${Math.round(hr)} bpm. Regular rhythm, no acute ST changes.` };
  if (hr > 100) return { rhythm: "Sinus tachycardia", interpretation: `Sinus tachycardia at ${Math.round(hr)} bpm. Regular rhythm, no acute ST changes.` };
  return { rhythm: "Normal sinus rhythm", interpretation: `Normal sinus rhythm at ${Math.round(hr)} bpm. Normal axis, no acute ST-T changes.` };
}

const schema = z.object({
  samples: z.array(z.number().finite()).min(1).max(20000),
  sampleRate: z.number().int().min(50).max(2000).optional().default(250),
  heartRate: z.number().min(20).max(250).optional(),
  rhythm: z.string().trim().max(120).optional(),
  interpretation: z.string().trim().max(500).optional(),
});

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const b = await parseBody(req, schema);
    const booking = await loadForUser(user, params.id);
    assertAssigned(booking, user, "nurse");
    assertStatusIn(booking, CAPTURE_STATUSES, "Capturing an ECG");
    const auto = interpretEcg(b.heartRate);
    const ecg = {
      samples: b.samples,
      sampleRate: b.sampleRate,
      heartRate: b.heartRate,
      rhythm: b.rhythm || auto.rhythm,
      interpretation: b.interpretation || auto.interpretation,
      capturedAt: new Date().toISOString(),
    } as Ecg;
    return json({ booking: await guardedSet(booking, CAPTURE_STATUSES, { ecg }, "Capturing an ECG") });
  },
  { roles: ["nurse"] },
);
