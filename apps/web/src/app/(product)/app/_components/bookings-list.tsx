"use client";

import { useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarPlus, ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_STATUSES } from "@/lib/format";
import { useSocketEvent } from "@/lib/socket";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingCard } from "./booking-card";
import { ErrorState, IndiaTimeNote, Unbroken, scheduleKey, useCatalog, useMyBookings } from "./shared";

const TABS = ["upcoming", "past"] as const;
type Tab = (typeof TABS)[number];

export function BookingsList() {
  // The tab lives in the URL (?tab=past), so coming back from a visit, or in from Home's
  // "View all", opens the list that was asked for.
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "past" ? "past" : "upcoming";
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const { bookings, error, loading, reload, upsert } = useMyBookings();
  const { catalog } = useCatalog();

  useSocketEvent<{ booking: Booking }>("booking:updated", (p) => {
    if (p?.booking) upsert(p.booking);
  });

  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "past") params.set("tab", "past");
    else params.delete("tab");
    // Replaced, not pushed: Back leaves the list instead of walking through its tabs.
    window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname);
  };

  const onTabKey = (e: KeyboardEvent) => {
    const other = tab === "upcoming" ? "past" : "upcoming";
    const next =
      e.key === "ArrowRight" || e.key === "ArrowLeft" ? other : e.key === "Home" ? TABS[0] : e.key === "End" ? TABS[1] : null;
    if (!next) return;
    e.preventDefault();
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold md:text-3xl">My bookings</h1>
        <Link href="/app/book" className={cn(buttonVariants(), "h-11 rounded-full px-4 text-sm font-semibold")}>
          <CalendarPlus aria-hidden /> Book
        </Link>
      </div>

      <div role="tablist" aria-label="Bookings" onKeyDown={onTabKey} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(
          [
            { id: "upcoming", label: "Upcoming", count: upcoming.length },
            { id: "past", label: "Past", count: past.length },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`bookings-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="bookings-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-full text-small font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                selected ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {bookings && (
                <span
                  className={cn(
                    "tabular grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-sm",
                    selected ? "bg-accent text-primary" : "bg-background/70",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="bookings-panel" aria-labelledby={`bookings-tab-${tab}`} className="space-y-3">
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
        ) : error && !bookings ? (
          <ErrorState title="Couldn't load your bookings" message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary">
              <ClipboardList className="size-6" aria-hidden />
            </span>
            <p className="mt-3 font-semibold">{tab === "upcoming" ? "No upcoming visits" : "No past visits yet"}</p>
            <p className="mt-1 max-w-xs text-small text-muted-foreground">
              {tab === "upcoming"
                ? "Book a check-up and a Nivar nurse will come to your home."
                : "Completed and cancelled visits will show up here with their reports."}
            </p>
            {tab === "upcoming" && (
              <Link
                href="/app/book"
                className={cn(buttonVariants(), "mt-5 h-14 w-full rounded-full px-6 text-base font-semibold sm:h-12 sm:w-auto")}
              >
                <span>
                  <Unbroken>Book a home check-up</Unbroken>
                </span>
              </Link>
            )}
          </div>
        ) : (
          <div key={tab} className="animate-fade-up space-y-3">
            <IndiaTimeNote className="px-1" />
            {list.map((b) => (
              <BookingCard key={b.id} booking={b} catalog={catalog} past={tab === "past"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
