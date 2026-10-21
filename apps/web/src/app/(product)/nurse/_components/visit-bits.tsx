import Link from "next/link";
import { ArrowRight, ChevronRight, Clock, MapPin, Zap } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EXPRESS_SLOT, dayLabel, slotLabel } from "@/lib/format";
import type { Booking, ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ONGOING, TEST_META, ageGender, nurseTests, slotStart } from "./visit-utils";

export function TestChips({
  codes,
  className,
  size = "default",
}: {
  codes: ServiceCode[];
  className?: string;
  size?: "sm" | "default";
}) {
  const tests = nurseTests(codes);
  const hasConsult = codes.includes("CONSULT");
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Tests">
      {tests.map((code) => {
        const meta = TEST_META[code];
        const Icon = meta.icon;
        return (
          <li
            key={code}
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-muted font-medium text-foreground",
              size === "sm" ? "h-6 px-2 text-[11px] [&_svg]:size-3" : "h-7 px-2.5 text-xs [&_svg]:size-3.5",
            )}
          >
            <Icon aria-hidden />
            {meta.short}
          </li>
        );
      })}
      {hasConsult && (
        <li
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border font-medium text-muted-foreground",
            size === "sm" ? "h-6 px-2 text-[11px] [&_svg]:size-3" : "h-7 px-2.5 text-xs [&_svg]:size-3.5",
          )}
        >
          <TEST_META.CONSULT.icon aria-hidden />
          Doctor consult
        </li>
      )}
    </ul>
  );
}

/** "BP, ECG, Stethoscope + consult" */
export function testsText(codes: ServiceCode[]): string {
  const tests = nurseTests(codes)
    .map((c) => TEST_META[c].short)
    .join(", ");
  return codes.includes("CONSULT") ? `${tests} + consult` : tests;
}

/** The highlighted next or in-progress visit. */
export function VisitHeroCard({ booking }: { booking: Booking }) {
  const ongoing = ONGOING.includes(booking.status);
  const express = booking.slot === EXPRESS_SLOT;
  return (
    <article className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-5 pt-4 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            {ongoing && <span className="live-dot size-1.5 text-signal" aria-hidden />}
            {ongoing ? "Visit in progress" : "Next visit"}
          </p>
          <StatusBadge status={booking.status} audience="staff" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          {express ? (
            <Zap className="size-4 fill-current text-foreground" aria-hidden />
          ) : (
            <Clock className="size-4 text-muted-foreground" aria-hidden />
          )}
          <p className="text-base font-semibold text-foreground tabular-nums">{slotLabel(booking.slot)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="truncate font-display text-2xl">{booking.patient.name}</h2>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{booking.code}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{ageGender(booking.patient)}</p>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-medium">{booking.address.area}</span>
              {booking.address.line1 ? <span className="text-muted-foreground">, {booking.address.line1}</span> : null}
            </span>
          </p>
        </div>
        <TestChips codes={booking.serviceCodes} />
        <Link
          href={`/nurse/visits/${booking.id}`}
          className={cn(buttonVariants({ size: "lg" }), "h-12 w-full rounded-xl text-base font-semibold")}
        >
          {ongoing ? "Continue visit" : "Open visit"}
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </article>
  );
}

/** Compact list row for a visit. */
export function VisitRow({ booking, showDay = false }: { booking: Booking; showDay?: boolean }) {
  const express = booking.slot === EXPRESS_SLOT;
  return (
    <Link
      href={`/nurse/visits/${booking.id}`}
      className="group flex items-stretch gap-3.5 rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-colors outline-none hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring/40 active:bg-muted/40"
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-muted/70 px-1 py-2 text-center">
        {showDay && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {dayLabel(booking.scheduledDate)}
          </span>
        )}
        {express ? (
          <Zap className="size-4 fill-current text-foreground" aria-label="Express" />
        ) : (
          <span className="text-sm leading-tight font-semibold tabular-nums">
            {slotStart(booking.slot).split(" ")[0]}
          </span>
        )}
        <span className="text-[11px] leading-tight text-muted-foreground">
          {express ? "Express" : slotStart(booking.slot).split(" ")[1]}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="truncate font-semibold">{booking.patient.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ageGender(booking.patient)} · {booking.address.area}
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <StatusBadge status={booking.status} audience="staff" size="sm" />
          <p className="min-w-0 truncate text-xs text-muted-foreground">{testsText(booking.serviceCodes)}</p>
        </div>
      </div>
      <ChevronRight
        className="size-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
