import crypto from "node:crypto";
import { z } from "zod";
import { withAuth } from "@/server/auth";
import { PAYMENT_METHODS, loadForUser, publishBooking, transition } from "@/server/bookings";
import { json } from "@/server/errors";
import { notifyAdmins } from "@/server/realtime";
import { parseBody } from "@/server/validate";

const schema = z.object({ method: z.enum(PAYMENT_METHODS).optional().default("upi") });

export const POST = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const booking = await loadForUser(user, params.id);
    const { method } = await parseBody(req, schema);
    const now = new Date();
    const txnId = `NVPAY${now.getTime().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await transition(booking, "confirmed", {
      actor: user,
      via: "pay",
      noteContext: { method },
      set: { payment: { status: "paid", method, txnId, paidAt: now.toISOString() } },
    });
    const payload = await publishBooking(booking.id);
    await notifyAdmins({
      title: "New booking",
      body: `${payload.code} · ${payload.patient.name} · ${payload.scheduledDate} ${payload.slot} needs a care team`,
      bookingId: payload.id,
    });
    return json({ booking: payload });
  },
  { roles: ["customer"] },
);
