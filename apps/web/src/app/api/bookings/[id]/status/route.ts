import { z } from "zod";
import { BOOKING_STATUSES, populated } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { cancelBooking, loadForUser, notifyStatusChange, publishBooking, transition, type RowPatch } from "@/server/bookings";
import { forbidden, json } from "@/server/errors";
import { parseBody } from "@/server/validate";

const schema = z.object({
  status: z.enum(BOOKING_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { status, note } = await parseBody(req, schema);
  if (status === "cancelled") {
    const booking = await loadForUser(user, params.id);
    return json({ booking: await cancelBooking(booking.id, user, note) });
  }
  if (user.role === "customer") throw forbidden("Customers cannot change the visit status", "role_not_allowed");
  const booking = await loadForUser(user, params.id);

  const set: RowPatch = {};
  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  if (status === "en_route" && !booking.nurseLocation?.lat && nurse) {
    // The nurse starts from their base location until the first live position arrives.
    const base = nurse.baseLocation;
    if (base?.lat != null) set.nurse_location = { lat: base.lat, lng: base.lng, updatedAt: new Date().toISOString() };
  }
  if (status === "completed" && booking.report && !booking.report.publishedAt) {
    set.report = { ...booking.report, publishedAt: new Date().toISOString() };
  }

  await transition(booking, status, {
    actor: user,
    via: "status",
    note,
    set,
    noteContext: { nurse, doctor },
  });
  const payload = await publishBooking(booking.id);
  await notifyStatusChange(status, payload, user);
  return json({ booking: payload });
});
