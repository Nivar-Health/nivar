import { z } from "zod";
import type { Vitals } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { CAPTURE_STATUSES } from "@/server/booking-status";
import { assertAssigned, assertStatusIn, guardedSet, loadForUser } from "@/server/bookings";
import { json } from "@/server/errors";
import { parseBody } from "@/server/validate";

const num = (min: number, max: number) => z.number().min(min).max(max);
const vitalsSchema = z
  .object({
    bpSystolic: num(50, 260).nullable(),
    bpDiastolic: num(30, 180).nullable(),
    sugar: num(20, 700).nullable(),
    sugarType: z.enum(["fasting", "random", "pp"]).nullable(),
    heartRate: num(20, 250).nullable(),
    spo2: num(50, 100).nullable(),
    temperatureF: num(90, 110).nullable(),
    weightKg: num(1, 300).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Send at least one vital");

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const body = await parseBody(req, vitalsSchema);
    const booking = await loadForUser(user, params.id);
    assertAssigned(booking, user, "nurse");
    assertStatusIn(booking, CAPTURE_STATUSES, "Recording vitals");
    // Partial update: numbers are set, explicit nulls clear the field.
    const vitals: Record<string, unknown> = { ...(booking.vitals ?? {}) };
    for (const [k, v] of Object.entries(body)) {
      if (v === null) delete vitals[k];
      else if (v !== undefined) vitals[k] = v;
    }
    vitals.recordedAt = new Date().toISOString();
    return json({ booking: await guardedSet(booking, CAPTURE_STATUSES, { vitals: vitals as Vitals }, "Recording vitals") });
  },
  { roles: ["nurse"] },
);
