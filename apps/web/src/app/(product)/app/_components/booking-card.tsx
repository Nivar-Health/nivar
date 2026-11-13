"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/lib/auth";
import { dayLabel, formatDate, formatINR, slotLabel } from "@/lib/format";
import type { Booking, Catalog } from "@/lib/types";
import { saveDraftFromVisit } from "./book-wizard";
import { Unbroken, bookAgainHref, bookingTitle, testsLabel } from "./shared";

/**
 * A booking on the bookings list. The card opens the visit; a past visit also offers "Book again",
 * as a row of its own under the card's link so the two never nest. Like the visit page's, it brings
 * the person and the address along and opens on the date.
 */
export function BookingCard({ booking, catalog, past }: { booking: Booking; catalog: Catalog | null; past?: boolean }) {
  const { user } = useAuth();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-colors hover:border-primary/40">
      <Link
        href={`/app/bookings/${booking.id}`}
        className="group flex items-stretch gap-3 p-4 outline-none focus-visible:bg-muted/60 focus-ring focus-visible:-outline-offset-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge status={booking.status} audience="patient" />
            <span className="tabular font-mono text-sm text-muted-foreground">{booking.code}</span>
          </div>
          <p className="mt-2.5 text-base leading-snug font-semibold">
            <Unbroken>{bookingTitle(booking, catalog)}</Unbroken>
          </p>
          {booking.patient.relation !== "self" && (
            <p className="mt-0.5 text-small text-foreground-2">For {booking.patient.name}</p>
          )}
          <p className="mt-0.5 text-sm text-muted-foreground">{testsLabel(booking.serviceCodes)}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-dashed border-border pt-3 text-small">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {past ? formatDate(booking.scheduledDate) : dayLabel(booking.scheduledDate)}, {slotLabel(booking.slot)}
            </span>
            <span className="tabular ml-auto shrink-0 font-semibold">{formatINR(booking.amount)}</span>
          </div>
        </div>
        <ChevronRight
          className="-mr-1 size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
      {past && (
        <Link
          href={bookAgainHref(booking, { onDate: !!user })}
          onClick={user ? () => saveDraftFromVisit(booking, user) : undefined}
          className="flex min-h-11 items-center gap-2 border-t border-border px-4 text-sm font-semibold text-primary transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted focus-ring focus-visible:-outline-offset-2"
        >
          <RotateCcw className="size-4 shrink-0" aria-hidden />
          Book again
          <span className="sr-only">: {bookingTitle(booking, catalog)}</span>
        </Link>
      )}
    </div>
  );
}
