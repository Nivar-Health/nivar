import { withAuth } from "@/server/auth";
import { json } from "@/server/errors";
import { profileToUser, type ProfileRow } from "@/server/mappers";
import { supabaseAdmin } from "@/server/supabase";

export const GET = withAuth(
  async () => {
    const sb = supabaseAdmin();
    const [profilesRes, bookingsRes] = await Promise.all([
      sb.from("profiles").select("*").eq("role", "customer").order("created_at", { ascending: false }),
      sb.from("bookings").select("customer_id, created_at"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (bookingsRes.error) throw bookingsRes.error;

    const byId: Record<string, { n: number; lastBookingAt: string | null }> = {};
    for (const b of (bookingsRes.data ?? []) as { customer_id: string; created_at: string }[]) {
      const cur = (byId[b.customer_id] ??= { n: 0, lastBookingAt: null });
      cur.n += 1;
      if (!cur.lastBookingAt || b.created_at > cur.lastBookingAt) cur.lastBookingAt = b.created_at;
    }

    return json({
      customers: ((profilesRes.data ?? []) as ProfileRow[]).map((c) => ({
        ...profileToUser(c),
        bookingCount: byId[c.id]?.n || 0,
        lastBookingAt: byId[c.id]?.lastBookingAt || null,
      })),
    });
  },
  { roles: ["admin"] },
);
