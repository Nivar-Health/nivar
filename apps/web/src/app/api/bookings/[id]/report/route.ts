import { z } from "zod";
import type { Report } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { REPORT_DRAFT_STATUSES, REPORT_PUBLISH_STATUSES } from "@/server/booking-status";
import { assertAssigned, assertStatusIn, guardedSet, loadForUser, notifyStatusChange, publishBooking, transition } from "@/server/bookings";
import { badRequest, json } from "@/server/errors";
import { parseBody } from "@/server/validate";

const reportSchema = z.object({
  diagnosis: z.string().trim().max(500).optional(),
  summary: z.string().trim().max(5000).optional(),
  prescription: z
    .array(
      z.object({
        medicine: z.string().trim().min(1, "Medicine name is required").max(200),
        dosage: z.string().trim().max(100).optional().default(""),
        frequency: z.string().trim().max(100).optional().default(""),
        duration: z.string().trim().max(100).optional().default(""),
        notes: z.string().trim().max(500).optional().default(""),
      }),
    )
    .max(30)
    .optional(),
  advice: z.array(z.string().trim().max(500)).max(30).optional(),
  followUp: z.string().trim().max(500).optional(),
  publish: z.boolean().optional().default(false),
});

export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const { publish, ...fields } = await parseBody(req, reportSchema);
    const booking = await loadForUser(user, params.id);
    assertAssigned(booking, user, "doctor");
    if (fields.advice) fields.advice = fields.advice.filter(Boolean);

    // Field-level merge into the stored report (only the keys that were sent).
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
    const merged = { ...(booking.report ?? {}), ...patch } as Report;

    if (!publish) {
      assertStatusIn(booking, REPORT_DRAFT_STATUSES, "Editing the report");
      if (!Object.keys(patch).length) throw badRequest("Nothing to save", "empty_report");
      return json({ booking: await guardedSet(booking, REPORT_DRAFT_STATUSES, { report: merged }, "Editing the report") });
    }

    assertStatusIn(booking, REPORT_PUBLISH_STATUSES, "Publishing the report");
    const diagnosis = fields.diagnosis ?? booking.report?.diagnosis;
    if (!diagnosis) throw badRequest("Add a diagnosis before publishing", "diagnosis_required");
    merged.publishedAt = new Date().toISOString();
    await transition(booking, "completed", { actor: user, via: "report", set: { report: merged } });
    const payload = await publishBooking(booking.id);
    await notifyStatusChange("completed", payload, user);
    return json({ booking: payload });
  },
  { roles: ["doctor"] },
);
