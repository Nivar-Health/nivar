import { z } from "zod";
import type { Stethoscope } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { CAPTURE_STATUSES } from "@/server/booking-status";
import { assertAssigned, assertStatusIn, guardedSet, loadForUser } from "@/server/bookings";
import { json } from "@/server/errors";
import { parseBody } from "@/server/validate";

const schema = z.object({
  heartRate: z.number().min(20).max(250).optional(),
  findings: z.string().trim().max(1000).optional().default("S1 S2 heard, no murmurs"),
  samples: z.array(z.number().finite()).min(1).max(20000).optional().default([]),
});

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const body = await parseBody(req, schema);
    const booking = await loadForUser(user, params.id);
    assertAssigned(booking, user, "nurse");
    assertStatusIn(booking, CAPTURE_STATUSES, "Capturing stethoscope audio");
    const stethoscope = { ...body, capturedAt: new Date().toISOString() } as Stethoscope;
    return json({ booking: await guardedSet(booking, CAPTURE_STATUSES, { stethoscope }, "Capturing stethoscope audio") });
  },
  { roles: ["nurse"] },
);
