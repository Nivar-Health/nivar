import { z } from "zod";
import { withAuth } from "@/server/auth";
import { cancelBooking, loadForUser } from "@/server/bookings";
import { json } from "@/server/errors";
import { parseBody } from "@/server/validate";

const schema = z.object({ reason: z.string().trim().max(500).optional() });

export const POST = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const { reason } = await parseBody(req, schema);
    const booking = await loadForUser(user, params.id);
    return json({ booking: await cancelBooking(booking.id, user, reason) });
  },
  { roles: ["customer", "admin"] },
);
