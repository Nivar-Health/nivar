"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_STATUSES } from "@/lib/format";
import { useSocketEvent } from "@/lib/socket";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingCard } from "./booking-card";
import { ErrorState, scheduleKey, useCatalog, useMyBookings } from "./shared";

type Tab = "upcoming" | "past";

export function BookingsList() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const { bookings, error, loading, reload, upsert } = useMyBookings();
  const { catalog } = useCatalog();

  useSocketEvent<{ booking: Booking }>("booking:updated", (p) => {
    if (p?.booking) upsert(p.booking);
  });

  const upcoming = (bookings ?? [])
    .filter((b) => ACTIVE_STATUSES.includes(b.status))
    .sort((a, b) => scheduleKey(a).localeCompare(scheduleKey(b)));
  // The API sorts ascending; the most recent past visit should come first.
  const past = (bookings ?? [])
    .filter((b) => !ACTIVE_STATUSES.includes(b.status))
    .sort((a, b) => scheduleKey(b).localeCompare(scheduleKey(a)));
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-tight md:text-3xl">My bookings</h1>
        <Link
          href="/app/book"
          className={cn(buttonVariants({ size: "lg" }), "h-9 rounded-full px-3.5 font-semibold")}
        >
          <CalendarPlus aria-hidden /> Book
        </Link>
      </div>

      <div role="tablist" aria-label="Bookings" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {(
          [
            { id: "upcoming", label: "Upcoming", count: upcoming.length },
            { id: "past", label: "Past", count: past.length },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {bookings && (
              <span
                className={cn(
                  "tabular grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]",
                  tab === t.id ? "bg-secondary text-secondary-foreground" : "bg-background/70",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[138px] rounded-2xl" />
          ))}
        </div>
      ) : error && !bookings ? (
        <ErrorState title="Couldn't load your bookings" message={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <p className="mt-3 font-semibold">{tab === "upcoming" ? "No upcoming visits" : "No past visits yet"}</p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {tab === "upcoming"
              ? "Book a check-up and a Nivar nurse will be at your door. Express visits arrive within 60 minutes."
              : "Completed and cancelled visits will show up here with their reports."}
          </p>
          {tab === "upcoming" && (
            <Link href="/app/book" className={cn(buttonVariants({ size: "lg" }), "mt-4 h-11 rounded-full px-5 font-semibold")}>
              Book a home check-up
            </Link>
          )}
        </div>
      ) : (
        <div key={tab} className="animate-fade-up space-y-3">
          {list.map((b) => (
            <BookingCard key={b.id} booking={b} catalog={catalog} past={tab === "past"} />
          ))}
        </div>
      )}
    </div>
  );
}
