import type { BookingStatus } from "@/lib/types";
import { withAuth } from "@/server/auth";
import { BOOKING_STATUSES, IN_PROGRESS_STATUSES } from "@/server/booking-status";
import { json } from "@/server/errors";
import { supabaseAdmin } from "@/server/supabase";
import { addDays, istParts, todayIST } from "@/server/time";

type StatRow = {
  scheduled_date: string;
  status: BookingStatus;
  amount: number;
  payment: { status?: string; paidAt?: string | null } | null;
  created_at: string;
};
type ProfileStat = { role: string; is_active: boolean };

/** IST calendar day of a timestamp, or null when missing. */
const istDay = (ts: string | null | undefined) => (ts ? istParts(new Date(ts)).date : null);

export const GET = withAuth(
  async () => {
    const sb = supabaseAdmin();
    const today = todayIST();
    const monthPrefix = today.slice(0, 7);
    const from7 = addDays(today, -6);
    const days = Array.from({ length: 7 }, (_, i) => addDays(from7, i));

    const [bookingsRes, profilesRes] = await Promise.all([
      sb.from("bookings").select("scheduled_date, status, amount, payment, created_at"),
      sb.from("profiles").select("role, is_active"),
    ]);
    if (bookingsRes.error) throw bookingsRes.error;
    if (profilesRes.error) throw profilesRes.error;
    const bookings = (bookingsRes.data ?? []) as StatRow[];
    const profiles = (profilesRes.data ?? []) as ProfileStat[];

    const t = { bookings: 0, completed: 0, inProgress: 0 };
    const r = { today: 0, month: 0, total: 0 };
    const statusBreakdown: Record<string, number> = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0]));
    const created: Record<string, number> = {};
    const paid: Record<string, number> = {};

    for (const b of bookings) {
      statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1;
      const notCancelled = b.status !== "cancelled";

      if (notCancelled && b.scheduled_date === today) {
        t.bookings += 1;
        if (b.status === "completed") t.completed += 1;
        if (IN_PROGRESS_STATUSES.includes(b.status)) t.inProgress += 1;
      }

      if (notCancelled) {
        const day = istDay(b.created_at);
        if (day && day >= from7 && day <= today) created[day] = (created[day] || 0) + 1;
      }

      if (notCancelled && b.payment?.status === "paid") {
        const paidDay = istDay(b.payment.paidAt);
        r.total += b.amount;
        if (paidDay === today) r.today += b.amount;
        if (paidDay && paidDay.slice(0, 7) === monthPrefix) r.month += b.amount;
        if (paidDay && paidDay >= from7 && paidDay <= today) paid[paidDay] = (paid[paidDay] || 0) + b.amount;
      }
    }

    const counts = {
      customers: profiles.filter((p) => p.role === "customer").length,
      nurses: profiles.filter((p) => p.role === "nurse" && p.is_active).length,
      doctors: profiles.filter((p) => p.role === "doctor" && p.is_active).length,
    };

    return json({
      today: t,
      revenue: r,
      counts,
      statusBreakdown,
      last7Days: days.map((date) => ({ date, bookings: created[date] || 0, revenue: paid[date] || 0 })),
    });
  },
  { roles: ["admin"] },
);
