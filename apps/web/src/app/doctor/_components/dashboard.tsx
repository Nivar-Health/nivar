"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FilePenLine,
  HeartPulse,
  Radio,
  RefreshCw,
  Stethoscope,
  Timer,
  Video,
} from "lucide-react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { etaMinutes, haversineKm } from "@/components/live/geo";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-menu";
import { useAuth } from "@/lib/auth";
import { firstName, formatTime, slotLabel, todayISO } from "@/lib/format";
import { useNurseLocation } from "@/lib/socket";
import { populated, type Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GENDER_SHORT } from "./clinical";
import { statusAt, useDoctorBookings, useLiveFeed, useNow } from "./hooks";
import { vitalRows } from "./vitals";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "Dr. Ananya Rao" -> "Dr. Ananya" */
function doctorShortName(name: string | undefined): string {
  if (!name) return "Doctor";
  return `Dr. ${firstName(name)}`;
}

function sameLocalDay(ms: number | null, ref: Date): boolean {
  if (ms === null) return false;
  const d = new Date(ms);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function slotStart(b: Booking): string {
  if (b.slot === "express") return "Express";
  return slotLabel(b.slot.split("-")[0]);
}

function patientLine(b: Booking): string {
  return `${b.patient.age}${GENDER_SHORT[b.patient.gender]} · ${b.address.area}`;
}

function formatShortDate(input: string | number): string {
  const d = new Date(typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : input);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function workspaceHref(b: Booking) {
  return `/doctor/consults/${b.id}`;
}

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------

function Kpi({
  label,
  value,
  sub,
  icon,
  tone = "default",
  className,
}: {
  className?: string;
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: "default" | "live" | "warn";
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4 shadow-soft",
        className,
        tone === "live" && "border-primary/25 bg-[linear-gradient(160deg,#ffffff_40%,var(--mint))]",
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-2 sm:min-h-8">
        <span className="truncate text-[13px] font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "hidden size-8 shrink-0 place-items-center rounded-lg sm:grid [&_svg]:size-4",
            tone === "live"
              ? "bg-primary text-primary-foreground"
              : tone === "warn"
                ? "bg-amber-50 text-amber-700"
                : "bg-secondary text-primary",
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[32px] leading-none font-medium tracking-tight tabular-nums">{value}</span>
        {tone === "live" && value !== "0" && <span className="live-dot size-2 text-danger" aria-hidden />}
      </div>
      <span className="text-xs text-muted-foreground sm:truncate">{sub}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section chrome
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  icon,
  action,
}: {
  title: string;
  count?: number;
  icon: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight [&_svg]:size-4 [&_svg]:text-primary">
        {icon}
        {title}
        {typeof count === "number" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live now
// ---------------------------------------------------------------------------

const SHORT_LABEL: Record<string, string> = { bp: "BP", hr: "Heart rate", spo2: "SpO2", sugar: "Sugar" };

function LiveCard({ booking, highlight }: { booking: Booking; highlight: boolean }) {
  const ecg = useLiveFeed(booking.id, "ecg");
  const nurse = populated(booking.nurse);
  const inConsult = booking.status === "consult";
  const rows = vitalRows(booking.vitals, ecg.heartRate).filter((r) => ["bp", "hr", "spo2", "sugar"].includes(r.key));
  const started = statusAt(booking, booking.status);

  return (
    <article
      className={cn(
        "@container/live relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft",
        inConsult ? "border-primary/40" : "border-border",
        highlight && "animate-in ring-4 ring-saffron/50 duration-700 fade-in slide-in-from-bottom-3",
      )}
    >
      {inConsult && (
        <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">
          <span className="flex items-center gap-2">
            <span className="live-dot size-2 text-saffron" aria-hidden />
            Patient is ready for your video consult
          </span>
          {started && (
            <span className="hidden text-primary-foreground/70 tabular-nums sm:inline">
              Waiting since {formatTime(started)}
            </span>
          )}
        </div>
      )}
      <div className="grid gap-4 p-4 @2xl/live:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar name={booking.patient.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{booking.patient.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {booking.code} · {booking.patient.age}
                  {GENDER_SHORT[booking.patient.gender]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {booking.address.area}
                  {nurse ? ` · with ${nurse.name}` : ""}
                </p>
              </div>
            </div>
            {!inConsult && <StatusBadge status={booking.status} size="sm" />}
          </div>

          <dl className="grid grid-cols-2 gap-2 @lg/live:grid-cols-4 @2xl/live:grid-cols-2">
            {rows.map((r) => {
              const abnormal = r.assessment && r.assessment.level !== "normal";
              return (
                <div
                  key={r.key}
                  className={cn(
                    "flex min-w-0 flex-col rounded-xl border px-3 py-2",
                    abnormal ? "border-red-200 bg-red-50/50" : "bg-muted/30",
                  )}
                >
                  <dt className="flex items-center justify-between gap-1 text-[11px] font-medium text-muted-foreground">
                    <span className="truncate">{SHORT_LABEL[r.key] ?? r.label}</span>
                    {abnormal && (
                      <span className="shrink-0 text-[10px] font-semibold tracking-wide text-red-700 uppercase">
                        {r.assessment?.label}
                      </span>
                    )}
                  </dt>
                  <dd className="flex items-baseline gap-1">
                    <span
                      className={cn(
                        "text-base font-semibold tabular-nums",
                        r.value === null && "text-muted-foreground/60",
                        abnormal && "text-red-700",
                      )}
                    >
                      {r.value ?? "--"}
                    </span>
                    {r.value !== null && <span className="text-[11px] text-muted-foreground">{r.unit}</span>}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-auto flex">
            <Link
              href={workspaceHref(booking)}
              className={cn(
                buttonVariants({ variant: inConsult ? "default" : "outline", size: "lg" }),
                "h-10 w-full px-3.5",
              )}
            >
              {inConsult ? <Video /> : null}
              {inConsult ? "Join consult" : "Open workspace"}
              <ArrowRight />
            </Link>
          </div>
        </div>
        <EcgMonitor feed={ecg.feed} heartRate={ecg.heartRate} height={196} className="rounded-xl" />
      </div>
    </article>
  );
}

function LiveEmpty() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#14332E] bg-[#071B18] px-6 py-10 text-center text-[#CFEFE6]">
      <div className="absolute inset-0 bg-ecg-grid-dark opacity-70" aria-hidden />
      <svg
        viewBox="0 0 600 60"
        className="absolute inset-x-0 top-1/2 h-14 w-full -translate-y-1/2 opacity-25"
        aria-hidden
        preserveAspectRatio="none"
      >
        <path d="M0 30 H600" stroke="#3BE3B4" strokeWidth="1.5" strokeDasharray="6 6" fill="none" />
      </svg>
      <div className="relative flex flex-col items-center gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-white/5 text-[#3BE3B4]">
          <Radio className="size-5" />
        </span>
        <p className="text-sm font-semibold">No patients live right now</p>
        <p className="max-w-sm text-xs text-[#9FB8B1]">
          When a nurse starts tests or a video consult, the patient appears here with live vitals and ECG.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function NurseProgress({ booking }: { booking: Booking }) {
  const nurse = populated(booking.nurse);
  const loc = useNurseLocation(booking.status === "en_route" ? booking.id : null, booking.nurseLocation);
  const name = nurse ? firstName(nurse.name) : "Nurse";
  if (booking.status === "en_route") {
    const eta =
      loc && booking.address?.lat
        ? etaMinutes(haversineKm(loc, { lat: booking.address.lat, lng: booking.address.lng }))
        : null;
    return (
      <span className="flex items-center gap-1.5 text-sky-700">
        <span className="live-dot size-1.5" aria-hidden />
        {name} on the way{eta ? `, about ${eta} min` : ""}
      </span>
    );
  }
  if (booking.status === "arrived") {
    return (
      <span className="flex items-center gap-1.5 text-cyan-700">
        <span className="live-dot size-1.5" aria-hidden />
        {name} has arrived, setting up
      </span>
    );
  }
  return <span className="text-muted-foreground">{nurse ? `${nurse.name} assigned` : "Nurse to be assigned"}</span>;
}

function UpcomingRow({ booking }: { booking: Booking }) {
  return (
    <li>
      <Link
        href={workspaceHref(booking)}
        className="group/row flex items-start gap-3 rounded-xl px-3 py-3 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <div className="flex w-[64px] shrink-0 flex-col pt-px">
          <span className="text-[13px] font-semibold whitespace-nowrap tabular-nums">{slotStart(booking)}</span>
          <span className="text-[11px] text-muted-foreground">
            {booking.scheduledDate === todayISO() ? "Today" : formatShortDate(booking.scheduledDate)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{booking.patient.name}</p>
            <StatusBadge status={booking.status} size="sm" />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{patientLine(booking)}</p>
          <p className="mt-1 truncate text-xs">
            <NurseProgress booking={booking} />
          </p>
        </div>
      </Link>
    </li>
  );
}

function ReportRow({ booking, now }: { booking: Booking; now: number }) {
  const since = statusAt(booking, "reporting");
  const mins = since ? Math.max(0, Math.round((now - since) / 60000)) : null;
  const overdue = mins !== null && mins >= 30;
  return (
    <li className="flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 shadow-soft">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
        <FilePenLine className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {booking.patient.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {booking.code} · {patientLine(booking)}
          </span>
        </p>
        <p className={cn("mt-0.5 truncate text-xs", overdue ? "text-amber-700" : "text-muted-foreground")}>
          {booking.report?.diagnosis ? `Draft: ${booking.report.diagnosis}` : "No draft yet"}
          {mins !== null && ` · consult ended ${mins === 0 ? "just now" : `${mins} min ago`}`}
        </p>
      </div>
      <Link href={workspaceHref(booking)} className={cn(buttonVariants({ size: "lg" }), "shrink-0 px-3.5")}>
        Write report
      </Link>
    </li>
  );
}

function CompletedRow({ booking }: { booking: Booking }) {
  const at =
    statusAt(booking, "completed") ??
    (booking.report?.publishedAt ? new Date(booking.report.publishedAt).getTime() : null);
  return (
    <li>
      <Link
        href={workspaceHref(booking)}
        className="group/row flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <CheckCircle2 className="size-4 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{booking.patient.name}</p>
          <p className="truncate text-xs text-muted-foreground">{booking.report?.diagnosis ?? "Report published"}</p>
        </div>
        <span className="shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
          {at ? (sameLocalDay(at, new Date()) ? formatTime(at) : formatShortDate(at)) : ""}
        </span>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const UPCOMING = ["assigned", "en_route", "arrived"] as const;

export function DoctorDashboard() {
  const { user } = useAuth();
  const { bookings, loading, error, reload, justWentLive } = useDoctorBookings();
  const now = useNow(30_000);
  const [showAllDone, setShowAllDone] = useState(false);

  const view = useMemo(() => {
    const today = todayISO();
    const ref = new Date(now);
    const live = bookings
      .filter((b) => b.status === "testing" || b.status === "consult")
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "consult" ? -1 : 1));
    const reporting = bookings
      .filter((b) => b.status === "reporting")
      .sort((a, b) => (statusAt(a, "reporting") ?? 0) - (statusAt(b, "reporting") ?? 0));
    const upcoming = bookings
      .filter(
        (b) =>
          (UPCOMING as readonly string[]).includes(b.status) && (b.scheduledDate === today || b.status !== "assigned"),
      )
      .sort((a, b) => {
        const rank = (x: Booking) => (x.status === "arrived" ? 0 : x.status === "en_route" ? 1 : 2);
        return rank(a) - rank(b) || a.slot.localeCompare(b.slot);
      });
    const later = bookings.filter((b) => b.status === "assigned" && b.scheduledDate > today);
    const completed = bookings
      .filter((b) => b.status === "completed")
      .map((b) => ({ b, at: statusAt(b, "completed") ?? 0 }))
      .sort((x, y) => y.at - x.at);
    const completedToday = completed.filter((c) => sameLocalDay(c.at, ref));
    const todayCount = bookings.filter((b) => b.scheduledDate === today && b.status !== "cancelled").length;

    // Turnaround: nurse arrival to report published, over the last 30 days.
    const cutoff = now - 30 * 864e5;
    const durations = completed
      .filter((c) => c.at >= cutoff)
      .map(({ b, at }) => {
        const start = statusAt(b, "arrived") ?? statusAt(b, "testing");
        return start ? (at - start) / 60000 : null;
      })
      .filter((m): m is number => m !== null && m > 0 && m < 600);
    const avgTurnaround = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    return { live, reporting, upcoming, later, completed, completedToday, todayCount, avgTurnaround };
  }, [bookings, now]);

  const date = new Date(now);
  const needYou = view.live.filter((b) => b.status === "consult").length + view.reporting.length;
  const doneList = showAllDone ? view.completed.slice(0, 20) : view.completed.slice(0, 6);

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-7">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 font-display text-[28px] leading-tight font-medium tracking-tight sm:text-[34px]">
            {greeting(date)}, {doctorShortName(user?.name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading your consult queue"
              : needYou > 0
                ? `${needYou} ${needYou === 1 ? "patient needs" : "patients need"} you right now.`
                : view.live.length > 0
                  ? "Tests are underway. You will be notified when a patient is ready."
                  : "Your queue is clear. New consults appear here live."}
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={reload} className="px-3">
          <RefreshCw /> Refresh
        </Button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* KPIs */}
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[124px] rounded-2xl" />)
        ) : (
          <>
            <Kpi
              label="Consults today"
              value={String(view.todayCount)}
              sub={`${view.upcoming.length} upcoming, ${view.completedToday.length} done`}
              icon={<CalendarClock />}
            />
            <Kpi
              label="Live now"
              value={String(view.live.length)}
              sub={
                view.live.some((b) => b.status === "consult")
                  ? `${view.live.filter((b) => b.status === "consult").length} waiting in consult`
                  : "Testing or in consult"
              }
              icon={<HeartPulse />}
              tone="live"
            />
            <Kpi
              label="Awaiting report"
              value={String(view.reporting.length)}
              sub={view.reporting.length ? "Publish to close the visit" : "Nothing pending"}
              icon={<FilePenLine />}
              tone={view.reporting.length ? "warn" : "default"}
            />
            <Kpi
              label="Completed"
              value={String(view.completedToday.length)}
              sub={`Today, ${view.completed.length} all time`}
              icon={<CheckCircle2 />}
            />
            <Kpi
              label="Avg turnaround"
              value={view.avgTurnaround !== null ? `${view.avgTurnaround}m` : "--"}
              sub="Arrival to published report"
              className="col-span-2 md:col-span-1"
              icon={<Timer />}
            />
          </>
        )}
      </section>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-7">
          <section className="flex flex-col gap-3" aria-label="Live now">
            <SectionHeader
              title="Live now"
              count={loading ? undefined : view.live.length}
              icon={<span className="live-dot size-2 text-danger" />}
            />
            {loading ? (
              <Skeleton className="h-[230px] rounded-2xl" />
            ) : view.live.length === 0 ? (
              <LiveEmpty />
            ) : (
              <div className="flex flex-col gap-4">
                {view.live.map((b) => (
                  <LiveCard key={b.id} booking={b} highlight={justWentLive.has(b.id)} />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-label="Awaiting your report">
            <SectionHeader
              title="Awaiting your report"
              count={loading ? undefined : view.reporting.length}
              icon={<FilePenLine />}
            />
            {loading ? (
              <Skeleton className="h-[72px] rounded-2xl" />
            ) : view.reporting.length === 0 ? (
              <EmptyRow>No reports pending. Nicely done.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {view.reporting.map((b) => (
                  <ReportRow key={b.id} booking={b} now={now} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-7">
          <section className="flex flex-col gap-3" aria-label="Upcoming today">
            <SectionHeader title="Upcoming today" count={loading ? undefined : view.upcoming.length} icon={<Clock />} />
            <div className="rounded-2xl border bg-card p-1.5 shadow-soft">
              {loading ? (
                <div className="flex flex-col gap-2 p-2">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : view.upcoming.length === 0 ? (
                <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                  {view.later.length
                    ? `No more visits today. ${view.later.length} scheduled later.`
                    : "No more visits today."}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border/70">
                  {view.upcoming.map((b) => (
                    <UpcomingRow key={b.id} booking={b} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-label="Completed">
            <SectionHeader
              title="Completed"
              count={view.completedToday.length || undefined}
              icon={<Stethoscope />}
              action={
                view.completed.length > 6 ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowAllDone((v) => !v)}>
                    {showAllDone ? "Show less" : "Show more"}
                  </Button>
                ) : null
              }
            />
            <div className="rounded-2xl border bg-card p-1.5 shadow-soft">
              {loading ? (
                <div className="flex flex-col gap-2 p-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : doneList.length === 0 ? (
                <p className="px-3 py-5 text-center text-sm text-muted-foreground">No completed consults yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {doneList.map(({ b }) => (
                    <CompletedRow key={b.id} booking={b} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
