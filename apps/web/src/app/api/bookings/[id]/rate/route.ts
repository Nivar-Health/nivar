import { z } from "zod";
import type { Rating } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { idOf } from "@/server/booking-status";
import { guardedSet, loadForUser } from "@/server/bookings";
import { conflict, json } from "@/server/errors";
import { notifyUsers } from "@/server/realtime";
import { parseBody } from "@/server/validate";

const schema = z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional().default("") });

export const POST = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const { score, comment } = await parseBody(req, schema);
    const booking = await loadForUser(user, params.id);
    if (booking.status !== "completed") throw conflict("You can rate a visit once it is completed", "invalid_state");
    const rating = { score, comment, ratedAt: new Date().toISOString() } as Rating;
    const payload = await guardedSet(booking, ["completed"], { rating }, "Rating");
    const staff = [idOf(payload.nurse), idOf(payload.doctor)].filter((id): id is string => Boolean(id));
    if (staff.length) {
      await notifyUsers(staff, {
        title: `New ${score}★ rating`,
        body: `${payload.patient.name} rated visit ${payload.code}${comment ? `: "${comment}"` : ""}`,
        bookingId: payload.id,
      });
    }
    return json({ booking: payload });
  },
  { roles: ["customer"] },
);
