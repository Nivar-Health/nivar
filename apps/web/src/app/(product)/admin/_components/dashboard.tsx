"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import {
  BadgeCheck,
  CalendarCheck2,
  IndianRupee,
  Radio,
  Stethoscope,
  TrendingUp,
  UserRound,
  UsersRound,
} from "lucide-react";
import { formatINR, formatINRCompact, formatNumber, todayISO } from "@/lib/format";
import { populated, type Booking, type CustomerRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { ErrorState, PageHeader, Panel } from "./admin-ui";
import { ActivityFeed, feedFromUpdate, mergeFeed, seedFeed, type FeedItem } from "./activity-feed";
import { AssignDialog } from "./assign-dialog";
import { KpiCard, StatusBreakdown, TrendCharts, deltaOf } from "./dashboard-charts";
import { LIVE_STATUSES, LiveOperations, NeedsAssignment } from "./ops-panels";
import { useAdminBookings, useAdminResource, useAdminStats } from "./use-admin-data";

function byScheduleAsc(a: Booking, b: Booking) {
  return a.scheduledDate.localeCompare(b.scheduledDate) || a.slot.localeCompare(b.slot);
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const stats = useAdminStats();
  const customers = useAdminResource<{ customers: CustomerRow[] }>("/admin/customers", 2000);
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);
  const { bookings, loading, error, reload } = useAdminBookings((next, prev) => {
    const items = feedFromUpdate(next, prev);
    if (items.length) setLiveItems((cur) => mergeFeed(cur, items, 30));
  });
  const [assignId, setAssignId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const today = todayISO();
  const s = stats.data;
  const all = useMemo(() => bookings ?? [], [bookings]);

  const derived = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(today), i - 6), "yyyy-MM-dd"));
    const scheduled = days.map(
      (d) => all.filter((b) => b.scheduledDate === d && b.status !== "cancelled").length,
    );
    const needs = all.filter((b) => b.status === "confirmed").sort(byScheduleAsc);
    const live = all
      .filter((b) => LIVE_STATUSES.includes(b.status))
      .sort((a, b) => LIVE_STATUSES.indexOf(a.status) - LIVE_STATUSES.indexOf(b.status) || byScheduleAsc(a, b));

    // Month to date vs the same days of last month, by payment date.
    const now = parseISO(today);
    const prevMonthStart = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "yyyy-MM-dd");
    const prevMonthSameDay = format(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()), "yyyy-MM-dd");
    const prevMonthLabel = format(parseISO(prevMonthStart), "MMM");
    const prevMtd = all
      .filter((b) => b.payment?.status === "paid" && b.status !== "cancelled" && b.payment.paidAt)
      .filter((b) => {
        const d = format(new Date(b.payment.paidAt!), "yyyy-MM-dd");
        return d >= prevMonthStart && d <= prevMonthSameDay;
      })
      .reduce((sum, b) => sum + b.amount, 0);

    const busyNurses = new Set(live.map((b) => populated(b.nurse)?.id).filter(Boolean)).size;
    const busyDoctors = new Set(
      all.filter((b) => b.status === "consult" || b.status === "reporting").map((b) => populated(b.doctor)?.id).filter(Boolean),
    ).size;
    const upcomingToday = all.filter((b) => b.scheduledDate === today && (b.status === "assigned" || b.status === "confirmed")).length;
    return { scheduled, needs, live, prevMtd, prevMonthLabel, busyNurses, busyDoctors, upcomingToday };
  }, [all, today]);

  const feed = useMemo(() => mergeFeed(liveItems, seedFeed(all, 30), 40), [liveItems, all]);

  const newCustomers = useMemo(() => {
    const month = today.slice(0, 7);
    return (customers.data?.customers ?? []).filter(
      (c) => (c as CustomerRow & { lastBookingAt?: string | null }).lastBookingAt?.slice(0, 7) === month,
    ).length;
  }, [customers.data, today]);

  const sevenDays = s?.last7Days ?? [];
  const revToday = s?.revenue.today ?? 0;
  const revYesterday = sevenDays.at(-2)?.revenue ?? 0;
  const visitsToday = s?.today.bookings ?? 0;
  const visitsYesterday = derived.scheduled.at(-2) ?? 0;
  const completedToday = s?.today.completed ?? 0;
  const completionPct = visitsToday ? Math.round((completedToday / visitsToday) * 100) : 0;
  const statsLoading = !s && !stats.error;

  const assignBooking = assignId ? (all.find((b) => b.id === assignId) ?? null) : null;

  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), "EEEE, d MMMM")}
        title={`${greeting()}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Bangalore operations at a glance. Everything on this page updates live."
      />

      {(stats.error || error) && (
        <div className="mb-4">
          <ErrorState
            message={stats.error ?? error ?? ""}
            onRetry={() => {
              stats.reload();
              reload();
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Visits today"
          icon={<CalendarCheck2 />}
          value={formatNumber(visitsToday)}
          delta={deltaOf(visitsToday, visitsYesterday, "vs yesterday")}
          spark={derived.scheduled}
          sparkId="spark-visits"
          loading={statsLoading}
        />
        <KpiCard
          label="Revenue today"
          icon={<IndianRupee />}
          value={formatINR(revToday)}
          delta={deltaOf(revToday, revYesterday, "vs yesterday", formatINRCompact)}
          spark={sevenDays.map((d) => d.revenue)}
          sparkId="spark-revenue"
          loading={statsLoading}
        />
        <KpiCard
          label="Revenue this month"
          icon={<TrendingUp />}
          value={formatINRCompact(s?.revenue.month)}
          delta={
            bookings
              ? { ...deltaOf(s?.revenue.month ?? 0, derived.prevMtd, `vs ${derived.prevMonthLabel} to date`, formatINRCompact), pct: null }
              : undefined
          }
          sub={!bookings ? `${formatINRCompact(s?.revenue.total)} all time` : undefined}
          loading={statsLoading}
        />
        <KpiCard
          label="Live visits"
          icon={<Radio />}
          value={formatNumber(bookings ? derived.live.length : s?.today.inProgress)}
          live
          sub={
            derived.live.length
              ? [
                  [derived.live.filter((b) => b.status === "en_route").length, "en route"],
                  [derived.live.filter((b) => ["arrived", "testing", "consult"].includes(b.status)).length, "at home"],
                  [derived.live.filter((b) => b.status === "reporting").length, "reporting"],
                ]
                  .filter(([n]) => n)
                  .map(([n, l]) => `${n} ${l}`)
                  .join(", ")
              : "None in progress"
          }
          loading={statsLoading && !bookings}
        />
        <KpiCard
          compact
          label="Completed today"
          icon={<BadgeCheck />}
          value={
            <span>
              {completedToday}
              <span className="text-base font-medium text-muted-foreground"> / {visitsToday}</span>
            </span>
          }
          loading={statsLoading}
          footer={
            !statsLoading && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${completionPct}%` }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground tabular">{completionPct}%</span>
              </div>
            )
          }
        />
        <KpiCard
          compact
          label="Active nurses"
          icon={<UserRound />}
          value={formatNumber(s?.counts.nurses)}
          sub={`${derived.busyNurses} on a visit now`}
          loading={statsLoading}
        />
        <KpiCard
          compact
          label="Active doctors"
          icon={<Stethoscope />}
          value={formatNumber(s?.counts.doctors)}
          sub={derived.busyDoctors ? `${derived.busyDoctors} in consult now` : "All available"}
          loading={statsLoading}
        />
        <KpiCard
          compact
          label="Customers"
          icon={<UsersRound />}
          value={formatNumber(s?.counts.customers)}
          sub={customers.data ? `${newCustomers} booked this month` : undefined}
          loading={statsLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 md:mt-5 md:gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5 lg:col-span-2">
          <NeedsAssignment
            bookings={derived.needs}
            loading={loading}
            onAssign={(b) => {
              setAssignId(b.id);
              setAssignOpen(true);
            }}
          />
          <LiveOperations bookings={derived.live} loading={loading} className="flex-1" />
        </div>
        <ActivityFeed items={feed} loading={loading} className="h-[480px] lg:h-auto lg:min-h-[400px]" />
      </div>

      <div className="mt-4 grid gap-4 md:mt-5 md:gap-5 lg:grid-cols-3">
        <Panel
          title="Last 7 days"
          description="New bookings and revenue collected"
          icon={<TrendingUp />}
          className="lg:col-span-2"
        >
          <TrendCharts stats={s} loading={statsLoading} />
        </Panel>
        <Panel
          title="Booking pipeline"
          description={s ? `${Object.entries(s.statusBreakdown).filter(([k]) => k !== "completed" && k !== "cancelled").reduce((n, [, v]) => n + (v ?? 0), 0)} open bookings by status` : "Open bookings by status"}
          icon={<CalendarCheck2 />}
          bodyClassName="flex flex-col"
        >
          <StatusBreakdown
            stats={s}
            loading={statsLoading}
            onPick={(status) => router.push(`/admin/bookings?status=${status}`)}
          />
        </Panel>
      </div>

      <AssignDialog booking={assignBooking} open={assignOpen} onOpenChange={setAssignOpen} />
    </>
  );
}
