"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Zap } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EXPRESS_SLOT, dayLabel, formatDate, formatINR, slotLabel } from "@/lib/format";
import type { Booking, Catalog } from "@/lib/types";
import { bookingTitle, testsLabel } from "./shared";

/** Compact booking row used on the bookings list. */
export function BookingCard({ booking, catalog, past }: { booking: Booking; catalog: Catalog | null; past?: boolean }) {
  const express = booking.slot === EXPRESS_SLOT;
  return (
    <Link
      href={`/app/bookings/${booking.id}`}
      className="group flex items-stretch gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all outline-none hover:border-primary/30 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={booking.status} audience="patient" size="sm" />
          <span className="tabular font-mono text-[11px] font-medium text-muted-foreground">{booking.code}</span>
        </div>
        <p className="mt-2 truncate text-[15px] font-semibold">{bookingTitle(booking, catalog)}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {booking.patient.relation !== "self" ? `For ${booking.patient.name} · ` : ""}
          {testsLabel(booking.serviceCodes, catalog)}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed border-border pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
            {express ? (
              <Zap className="size-3.5 shrink-0 fill-saffron text-saffron" aria-hidden />
            ) : (
              <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden />
            )}
            <span className="truncate">
              {past ? formatDate(booking.scheduledDate) : dayLabel(booking.scheduledDate)}, {slotLabel(booking.slot)}
            </span>
          </span>
          <span className="tabular shrink-0 text-sm font-semibold">{formatINR(booking.amount)}</span>
        </div>
      </div>
      <ChevronRight
        className="-mr-1 size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
