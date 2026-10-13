import { withAuth } from "@/server/auth";
import { loadForUser } from "@/server/bookings";
import { json } from "@/server/errors";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const booking = await loadForUser(user, params.id);
  return json({ booking });
});
