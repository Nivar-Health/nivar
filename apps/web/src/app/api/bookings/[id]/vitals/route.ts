import { z } from "zod";
import { withAuth } from "@/server/auth";
import { CAPTURE_STATUSES } from "@/server/booking-status";
import { assertAssigned, assertStatusIn, loadForUser, mergeJson } from "@/server/bookings";
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
    // Partial update merged in the database: numbers are set, explicit nulls clear the field.
    // The nurse's form saves fields separately and concurrently, so this must not read-modify-write.
    const set: Record<string, unknown> = { recordedAt: new Date().toISOString() };
    const unset: string[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v === null) unset.push(k);
      else if (v !== undefined) set[k] = v;
    }
    return json({ booking: await mergeJson(booking, "vitals", set, { unset, statuses: CAPTURE_STATUSES, action: "Recording vitals" }) });
  },
  { roles: ["nurse"] },
);
