import { z } from "zod";
import type { BookingStatus } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { assertAssigned, assertStatusIn, loadForUser } from "@/server/bookings";
import { conflict, json } from "@/server/errors";
import { supabaseAdmin } from "@/server/supabase";
import { parseBody } from "@/server/validate";

/** Statuses during which the nurse's live position is tracked. */
const LOCATION_STATUSES: BookingStatus[] = ["en_route", "arrived"];

const schema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

/**
 * Persist the nurse's latest position (the nurse client broadcasts `nurse:location` on the booking
 * channel itself, so nothing is re-broadcast here).
 */
export const PUT = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const { lat, lng } = await parseBody(req, schema);
    const booking = await loadForUser(user, params.id);
    assertAssigned(booking, user, "nurse");
    assertStatusIn(booking, LOCATION_STATUSES, "Updating location");
    const { data, error } = await supabaseAdmin()
      .from("bookings")
      .update({ nurse_location: { lat, lng, updatedAt: new Date().toISOString() } })
      .eq("id", booking.id)
      .in("status", LOCATION_STATUSES)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw conflict("Updating location is no longer possible, the booking status changed", "stale");
    return json({ ok: true });
  },
  { roles: ["nurse"] },
);
