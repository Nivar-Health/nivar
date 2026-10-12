"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, FileHeart, HeartPulse, ShieldCheck, Sparkles, Stethoscope, Video, Zap } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { ACTIVE_STATUSES, EXPRESS_SLOT, STATUS_META, dayLabel, firstName, formatDate, formatINR, slotLabel } from "@/lib/format";
import { useSocketEvent } from "@/lib/socket";
import { populated, type Booking, type Catalog } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ErrorState,
  PersonAvatar,
  SectionTitle,
  Surface,
  bookingTitle,
  scheduleKey,
  serviceIcon,
  serviceMap,
  useCatalog,
  useMyBookings,
} from "./shared";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function PatientHome() {
  const { user } = useAuth();
  const { bookings, error, loading, reload, upsert } = useMyBookings();
  const { catalog } = useCatalog();

  useSocketEvent<{ booking: Booking }>("booking:updated", (p) => {
    if (p?.booking) upsert(p.booking);
  });

  const active = (bookings ?? [])
    .filter((b) => ACTIVE_STATUSES.includes(b.status))
    .sort((a, b) => {
      const live = Number(STATUS_META[b.status].live) - Number(STATUS_META[a.status].live);
      return live || scheduleKey(a).localeCompare(scheduleKey(b));
    });
  const reports = (bookings ?? []).filter((b) => b.status === "completed").reverse();
  const name = firstName(user?.name);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm text-muted-foreground">{greeting()}{name ? "," : ""}</p>
        <h1 className="font-display text-[2rem] leading-tight md:text-4xl">
          {name ? `${name}.` : "Welcome to Nivar."}
        </h1>
      </header>

      {loading ? (
        <Skeleton className="h-48 rounded-3xl" />
      ) : error && !bookings ? (
        <ErrorState title="Couldn't load your visits" message={error} onRetry={reload} />
      ) : active.length > 0 ? (
        <div className="space-y-2.5">
          <ActiveHero booking={active[0]} catalog={catalog} />
          {active.length > 1 && (
            <Link
              href="/app/bookings"
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <span>
                {active.length - 1} more upcoming visit{active.length - 1 === 1 ? "" : "s"}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          )}
        </div>
      ) : null}

      <BookCta compact={active.length > 0} />

      <section aria-label="Popular packages">
        <SectionTitle
          action={
            <Link href="/app/book" className="text-[13px] font-semibold text-primary hover:underline">
              See all tests
            </Link>
          }
        >
          Popular check-ups
        </SectionTitle>
        <PackagePicks catalog={catalog} />
      </section>

      <section aria-label="Recent reports">
        <SectionTitle
          action={
            reports.length > 3 ? (
              <Link href="/app/bookings" className="text-[13px] font-semibold text-primary hover:underline">
                View all
              </Link>
            ) : undefined
          }
        >
          Recent reports
        </SectionTitle>
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[76px] rounded-2xl" />
            <Skeleton className="h-[76px] rounded-2xl" />
          </div>
        ) : reports.length === 0 ? (
          <EmptyReports hasActive={active.length > 0} />
        ) : (
          <Surface className="divide-y divide-border overflow-hidden">
            {reports.slice(0, 3).map((b) => {
              const doctor = populated(b.doctor);
              return (
                <div key={b.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground">
                    <FileHeart className="size-[18px]" aria-hidden />
                  </span>
                  <Link href={`/app/bookings/${b.id}`} className="min-w-0 flex-1 outline-none">
                    <p className="truncate text-sm font-semibold">{b.report?.diagnosis || bookingTitle(b, catalog)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(b.scheduledDate)}
                      {doctor ? ` · ${doctor.name}` : ""}
                      {b.patient.relation !== "self" ? ` · ${b.patient.name}` : ""}
                    </p>
                  </Link>
                  <Link
                    href={`/app/bookings/${b.id}/report`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-8 shrink-0 rounded-full px-3 text-xs font-semibold")}
                  >
                    View report
                  </Link>
                </div>
              );
            })}
          </Surface>
        )}
      </section>

      <TrustStrip />
    </div>
  );
}

function ActiveHero({ booking, catalog }: { booking: Booking; catalog: Catalog | null }) {
  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  const meta = STATUS_META[booking.status];
  const isConsult = booking.status === "consult";
  const isPending = booking.status === "pending_payment";
  const express = booking.slot === EXPRESS_SLOT;
  const cta = isConsult ? "Join consult" : isPending ? `Complete payment ${formatINR(booking.amount)}` : booking.status === "reporting" ? "View visit" : "Track visit";
  const CtaIcon = isConsult ? Video : ArrowRight;

  return (
    <Link
      href={`/app/bookings/${booking.id}`}
      className="group relative block overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {meta.live && (
        <EcgLine
          beats={4}
          thin
          className="pointer-events-none absolute inset-x-0 top-10 h-20 opacity-60"
          strokeClassName="stroke-white/30"
          glowClassName="stroke-signal"
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge
            status={booking.status}
            audience="patient"
            className="bg-white ring-white"
          />
          <span className="tabular font-mono text-[11px] font-medium text-primary-foreground/60">{booking.code}</span>
        </div>
        <p className="mt-4 font-display text-[1.45rem] leading-tight font-medium">{bookingTitle(booking, catalog)}</p>
        <p className="mt-1 text-[13px] leading-snug text-primary-foreground/75">{meta.patientDescription}</p>
        <div className="mt-4 flex items-center gap-2 text-[13px] font-medium">
          {express ? (
            <Zap className="size-4 fill-current text-white/80" aria-hidden />
          ) : (
            <CalendarDays className="size-4 text-white/80" aria-hidden />
          )}
          {dayLabel(booking.scheduledDate)}, {slotLabel(booking.slot)}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          {nurse || doctor ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex -space-x-2">
                {nurse && <PersonAvatar name={nurse.name} tone="ink" size="sm" className="ring-white/40" />}
                {doctor && <PersonAvatar name={doctor.name} tone="outline" size="sm" className="border-0 ring-primary" />}
              </div>
              <p className="min-w-0 truncate text-xs text-primary-foreground/80">
                {[firstName(nurse?.name), doctor?.name].filter(Boolean).join(" & ")}
              </p>
            </div>
          ) : (
            <p className="text-xs text-primary-foreground/70">
              {isPending ? "Slot held for you" : "Care team being assigned"}
            </p>
          )}
          <span
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-foreground transition-transform group-hover:translate-x-0.5",
            )}
          >
            {isConsult && <CtaIcon className="size-4" aria-hidden />}
            {cta}
            {!isConsult && <CtaIcon className="size-4" aria-hidden />}
          </span>
        </div>
      </div>
    </Link>
  );
}

function BookCta({ compact }: { compact: boolean }) {
  return (
    <Link
      href="/app/book"
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        compact ? "p-4" : "p-5",
      )}
    >
      <div className="relative min-w-0 flex-1">
        {!compact && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
            <Zap className="size-3 fill-current" aria-hidden /> Express visits today
          </span>
        )}
        <p className={cn("font-display leading-tight font-medium tracking-tight", compact ? "text-lg" : "mt-2 text-2xl")}>
          Book a home check-up
        </p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          {compact ? "For you or your family" : "A Nivar nurse at your door, a Nivar doctor on video, report within the hour."}
        </p>
      </div>
      <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
        <ArrowRight className="size-5" aria-hidden />
      </span>
    </Link>
  );
}

function PackagePicks({ catalog }: { catalog: Catalog | null }) {
  if (!catalog) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
    );
  }
  const services = serviceMap(catalog);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {catalog.packages.slice(0, 4).map((p) => {
        const hero = p.serviceCodes.includes("ECG") ? "ECG" : p.serviceCodes.includes("SUGAR") ? "SUGAR" : p.serviceCodes[0];
        const Icon = hero ? serviceIcon(hero) : HeartPulse;
        return (
          <Link
            key={p.id}
            href={`/app/book?package=${p.id}`}
            className={cn(
              "group relative flex flex-col rounded-2xl border bg-card p-3.5 shadow-soft transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              p.popular ? "border-foreground" : "border-border hover:border-foreground/40",
            )}
          >
            {p.popular && (
              <span className="absolute -top-2 right-3 inline-flex items-center gap-0.5 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                <Sparkles className="size-2.5" aria-hidden /> Popular
              </span>
            )}
            <span className="grid size-9 place-items-center rounded-xl border border-border bg-card text-foreground">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <p className="mt-2.5 text-sm leading-snug font-semibold">{p.name}</p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
              {p.serviceCodes.map((c) => services[c]?.shortName ?? c).join(", ")}
            </p>
            <p className="mt-auto flex items-baseline gap-1.5 pt-2.5">
              <span className="tabular text-[15px] font-semibold">{formatINR(p.price)}</span>
              {p.mrp > p.price && (
                <span className="tabular text-[11px] text-muted-foreground line-through">{formatINR(p.mrp)}</span>
              )}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyReports({ hasActive }: { hasActive: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center">
      <span className="relative grid size-14 place-items-center rounded-2xl border border-border bg-card text-foreground">
        <Stethoscope className="size-6" aria-hidden />
        <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background ring-2 ring-card">
          <FileHeart className="size-3.5" aria-hidden />
        </span>
      </span>
      <p className="mt-3 font-semibold">No reports yet</p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
        {hasActive
          ? "Your report will appear here as soon as your doctor publishes it."
          : "Book your first home check-up. Your doctor-signed report and prescription will live here."}
      </p>
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { icon: ShieldCheck, label: "Full-time, verified nurses" },
        { icon: Stethoscope, label: "Nivar doctors, not gig workers" },
        { icon: FileHeart, label: "Report within 60 minutes" },
      ].map((t) => (
        <div key={t.label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3">
          <t.icon className="size-4 text-foreground" aria-hidden />
          <span className="text-[11px] leading-tight font-medium text-muted-foreground">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
