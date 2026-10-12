"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Radar, UserPlus, Zap } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EXPRESS_SLOT, dayLabel, formatINR, relative, slotLabel } from "@/lib/format";
import { populated, type Booking, type BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingCode, EmptyState, Panel, PersonCell, ServiceChips } from "./admin-ui";
import { useNow } from "./use-admin-data";

export const LIVE_STATUSES: BookingStatus[] = ["en_route", "arrived", "testing", "consult", "reporting"];

function sinceStatus(b: Booking): string | undefined {
  for (let i = (b.timeline?.length ?? 0) - 1; i >= 0; i--) {
    if (b.timeline[i].status === b.status) return b.timeline[i].at;
  }
  return undefined;
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

/** "18:00-19:00" -> { time: "6:00", period: "PM" }; null for express. */
function slotStart(slot: string): { time: string; period: string } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(slot);
  if (slot === EXPRESS_SLOT || !m) return null;
  const h = Number(m[1]);
  return { time: `${h % 12 || 12}:${m[2]}`, period: h >= 12 ? "PM" : "AM" };
}

function WhenBlock({ date, slot }: { date: string; slot: string }) {
  const day = dayLabel(date);
  const isToday = day === "Today";
  const start = slotStart(slot);
  return (
    <div
      className={cn(
        "flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center leading-tight",
        isToday ? "border-saffron/40 bg-saffron/10" : "border-border bg-muted/40",
      )}
    >
      <span className={cn("text-[10.5px] font-semibold tracking-wide uppercase", isToday ? "text-[#9A5B07]" : "text-muted-foreground")}>
        {day.split(",")[0]}
      </span>
      <span className="mt-0.5 text-[12px] font-semibold text-foreground tabular">
        {start ? (
          <>
            {start.time}
            <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{start.period}</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-0.5">
            <Zap className="size-3 fill-current text-saffron" />
            60 min
          </span>
        )}
      </span>
    </div>
  );
}

export function NeedsAssignment({
  bookings,
  loading,
  onAssign,
  className,
}: {
  bookings: Booking[];
  loading: boolean;
  onAssign: (b: Booking) => void;
  className?: string;
}) {
  return (
    <Panel
      title="Needs assignment"
      description="Paid bookings waiting for a nurse and doctor"
      icon={<UserPlus />}
      className={className}
      action={
        bookings.length > 0 ? (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-100 px-2 text-xs font-semibold text-orange-800 tabular">
            {bookings.length}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <RowsSkeleton rows={2} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title="All caught up"
          body="Every paid booking has a care team. New ones appear here instantly."
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {bookings.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:gap-4 sm:px-5">
              <WhenBlock date={b.scheduledDate} slot={b.slot} />
              <Link href={`/admin/bookings/${b.id}`} className="min-w-0 flex-1 outline-none focus-visible:underline">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <BookingCode code={b.code} className="whitespace-nowrap" />
                  <span className="truncate text-sm font-medium">{b.patient.name}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {b.patient.age}
                    {b.patient.gender?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{b.address.area}</span>
                  <span aria-hidden className="hidden sm:inline">·</span>
                  <span className="font-semibold text-foreground tabular sm:hidden">{formatINR(b.amount)}</span>
                  <ServiceChips codes={b.serviceCodes} max={3} className="hidden sm:inline-flex" />
                </div>
              </Link>
              <span className="hidden text-sm font-semibold tabular md:block">{formatINR(b.amount)}</span>
              <Button size="sm" onClick={() => onAssign(b)} className="h-8 px-3">
                Assign
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function LiveOperations({
  bookings,
  loading,
  className,
}: {
  bookings: Booking[];
  loading: boolean;
  className?: string;
}) {
  useNow(30_000);
  return (
    <Panel
      title="Live operations"
      description="Visits happening right now"
      icon={<Radar />}
      className={className}
      action={
        <Link
          href="/admin/bookings?view=live"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          All live <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      {loading ? (
        <RowsSkeleton rows={2} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Radar />}
          title="No visits in progress"
          body="When a nurse starts a trip it shows up here with live status."
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {bookings.map((b) => {
            const nurse = populated(b.nurse);
            const doctor = populated(b.doctor);
            const since = sinceStatus(b);
            const showDoctor = b.status === "consult" || b.status === "reporting";
            const person = showDoctor ? doctor : nurse;
            return (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookingCode code={b.code} />
                      <span className="truncate text-sm font-medium">{b.patient.name}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {b.address.area} · {slotLabel(b.slot)}
                    </div>
                  </div>
                  <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
                    <PersonCell
                      name={person?.name}
                      sub={showDoctor ? "Doctor" : "Nurse"}
                    />
                  </div>
                  <div className="col-start-2 row-start-1 flex flex-col items-end gap-1 md:col-start-auto md:row-start-auto">
                    <StatusBadge status={b.status} size="sm" />
                    {since && <span className="text-[11px] text-muted-foreground">{relative(since)}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
