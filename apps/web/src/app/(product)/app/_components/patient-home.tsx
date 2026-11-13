"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, FileHeart, HeartPulse, ShieldCheck, Stethoscope, Video } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { ACTIVE_STATUSES, STATUS_META, checksLabel, dayLabel, firstName, formatDate, formatINR, slotLabel } from "@/lib/format";
import { SITE } from "@/lib/site-facts";
import { useSocketEvent } from "@/lib/socket";
import { populated, type Booking, type Catalog } from "@/lib/types";
import {
  ErrorState,
  IndiaTimeNote,
  PersonAvatar,
  SectionTitle,
  Surface,
  Unbroken,
  bookingTitle,
  scheduleKey,
  sectionLinkClass,
  serviceIcon,
  useCatalog,
  useMyBookings,
} from "./shared";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Whether Home showed a visit in progress the last time it loaded in this tab. */
const HAD_VISIT_KEY = "nivar:home-had-visit";

function hadVisitLastTime(): boolean {
  try {
    return window.sessionStorage.getItem(HAD_VISIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function PatientHome() {
  const { user } = useAuth();
  const { bookings, error, loading, reload, upsert } = useMyBookings();
  const { catalog, error: catalogError, reload: reloadCatalog } = useCatalog();
  // Most people have no visit in progress, so a placeholder for one would only make the page jump
  // when it goes away. It is shown only where a visit was in progress last time.
  const [expectVisit] = useState(hadVisitLastTime);

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
  const failed = Boolean(error && !bookings);
  const hasVisit = active.length > 0;

  useEffect(() => {
    if (!bookings) return;
    try {
      window.sessionStorage.setItem(HAD_VISIT_KEY, hasVisit ? "1" : "0");
    } catch {
      // Storage blocked: the placeholder simply stays off.
    }
  }, [bookings, hasVisit]);

  return (
    <div className="space-y-7">
      <h1>
        <span className="block text-base text-muted-foreground">
          {greeting()}
          {name ? "," : ""}
        </span>
        <span className="block font-display text-[2rem] leading-tight font-semibold md:text-4xl">
          {name ? `${name}.` : "Welcome to Nivar."}
        </span>
      </h1>

      {loading ? (
        expectVisit && <Skeleton className="h-[17.5rem] rounded-3xl" />
      ) : failed ? (
        <ErrorState title="Couldn't load your visits" message={error} onRetry={reload} />
      ) : hasVisit ? (
        <div className="animate-fade-up space-y-2.5">
          <ActiveHero booking={active[0]} catalog={catalog} />
          {active.length > 1 && (
            <Link
              href="/app/bookings"
              className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-small font-medium transition-colors outline-none hover:bg-muted/50 focus-ring"
            >
              <span>
                {active.length - 1} more upcoming visit{active.length - 1 === 1 ? "" : "s"}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          )}
          <IndiaTimeNote className="px-1" />
        </div>
      ) : null}

      <BookCta compact={hasVisit} />

      <section aria-labelledby="home-packages">
        <SectionTitle
          id="home-packages"
          action={
            <Link href="/app/book" className={sectionLinkClass}>
              See all
            </Link>
          }
        >
          Check-up packages
        </SectionTitle>
        {catalog ? (
          <PackagePicks catalog={catalog} />
        ) : catalogError ? (
          <ErrorState compact title="Couldn't load the check-ups." onRetry={reloadCatalog} />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        )}
      </section>

      {/* With no bookings to read, saying "No reports yet" would be untrue: the section stays out. */}
      {!failed && (
        <section aria-labelledby="home-reports">
          <SectionTitle
            id="home-reports"
            action={
              reports.length > 3 ? (
                <Link href="/app/bookings?tab=past" className={sectionLinkClass}>
                  View all
                </Link>
              ) : undefined
            }
          >
            Recent reports
          </SectionTitle>
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-[4.75rem] rounded-2xl" />
              <Skeleton className="h-[4.75rem] rounded-2xl" />
            </div>
          ) : reports.length === 0 ? (
            <EmptyReports hasVisit={hasVisit} />
          ) : (
            <Surface className="divide-y divide-border overflow-hidden">
              {reports.slice(0, 3).map((b) => (
                <ReportRow key={b.id} booking={b} catalog={catalog} />
              ))}
            </Surface>
          )}
        </section>
      )}

      <TrustStrip />
    </div>
  );
}

function ActiveHero({ booking, catalog }: { booking: Booking; catalog: Catalog | null }) {
  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  const meta = STATUS_META[booking.status];
  const isCall = booking.status === "consult";
  const isPending = booking.status === "pending_payment";
  const cta = isCall
    ? "Join video call"
    : isPending
      ? `Complete payment ${formatINR(booking.amount)}`
      : booking.status === "reporting"
        ? "View visit"
        : "Track visit";

  return (
    <Link
      href={`/app/bookings/${booking.id}`}
      className="relative block overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground outline-none focus-ring"
    >
      {meta.live && (
        <EcgLine
          beats={4}
          thin
          className="pointer-events-none absolute inset-x-0 top-10 h-20 opacity-60"
          strokeClassName="stroke-white/30"
          glowClassName="stroke-trace"
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={booking.status} audience="patient" className="bg-card ring-card" />
          <span className="tabular font-mono text-sm text-primary-foreground/75">{booking.code}</span>
        </div>
        <p className="mt-4 font-display text-2xl leading-tight font-semibold">
          <Unbroken>{bookingTitle(booking, catalog)}</Unbroken>
        </p>
        {booking.patient.relation !== "self" && (
          <p className="mt-1 text-small font-medium">For {booking.patient.name}</p>
        )}
        <p className="mt-1 text-small text-primary-foreground/85">{meta.patientDescription}</p>
        <p className="mt-4 flex items-center gap-2 text-small font-medium">
          <CalendarDays className="size-4 shrink-0 text-primary-foreground/80" aria-hidden />
          {dayLabel(booking.scheduledDate)}, {slotLabel(booking.slot)}
        </p>

        {/* Who is coming, then the one action on its own full-width row: nothing to squeeze at 360px. */}
        {nurse || doctor ? (
          <div className="mt-4 flex items-center gap-2.5">
            <div className="flex shrink-0 -space-x-2">
              {nurse && <PersonAvatar name={nurse.name} tone="outline" size="sm" className="border-0 ring-primary" />}
              {doctor && <PersonAvatar name={doctor.name} tone="outline" size="sm" className="border-0 ring-primary" />}
            </div>
            <p className="min-w-0 text-sm text-primary-foreground/85">
              {[firstName(nurse?.name), doctor?.name].filter(Boolean).join(" and ")}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-primary-foreground/85">
            {isPending ? "Slot held for you" : "Assigning your nurse and doctor"}
          </p>
        )}
        <span className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-card px-5 text-base font-semibold text-foreground">
          {isCall && <Video className="size-4 shrink-0" aria-hidden />}
          {cta}
          {!isCall && <ArrowRight className="size-4 shrink-0" aria-hidden />}
        </span>
      </div>
    </Link>
  );
}

/**
 * The way into booking. With no visit in progress it is the screen's main action: a full-width
 * button on phones. Beside a visit in progress it steps back to one quiet row.
 */
function BookCta({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <Link
        href="/app/book"
        className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft transition-colors outline-none hover:border-primary/40 focus-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg leading-tight font-semibold">
            <Unbroken>Book a home check-up</Unbroken>
          </span>
          <span className="mt-1 block text-small text-foreground-2">For you or your family</span>
        </span>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-primary">
          <ArrowRight className="size-5" aria-hidden />
        </span>
      </Link>
    );
  }
  return (
    <Link
      href="/app/book"
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors outline-none hover:border-primary/40 focus-ring sm:flex-row sm:items-center sm:gap-6"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl leading-tight font-semibold">
          <Unbroken>Book a home check-up</Unbroken>
        </span>
        <span className="mt-1.5 block text-small text-foreground-2">
          A registered Nivar nurse comes to your home, and a Nivar doctor joins on video when needed. Your report
          follows, {SITE.report.checkup}.
        </span>
      </span>
      <span className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground sm:h-12">
        <span>
          <Unbroken>Book a check-up</Unbroken>
        </span>
        <ArrowRight className="size-4 shrink-0" aria-hidden />
      </span>
    </Link>
  );
}

function PackagePicks({ catalog }: { catalog: Catalog }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {catalog.packages.slice(0, 4).map((p) => {
        const hero = p.serviceCodes.includes("ECG") ? "ECG" : p.serviceCodes.includes("SUGAR") ? "SUGAR" : p.serviceCodes[0];
        const Icon = hero ? serviceIcon(hero) : HeartPulse;
        return (
          <Link
            key={p.id}
            href={`/app/book?package=${p.id}`}
            className="flex flex-col rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-colors outline-none hover:border-primary/40 focus-ring"
          >
            <span className="grid size-10 place-items-center rounded-xl border border-border bg-card text-primary">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <span className="mt-3 block text-small leading-snug font-semibold">
              <Unbroken>{p.name}</Unbroken>
            </span>
            <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{checksLabel(p.serviceCodes)}</span>
            <span className="tabular mt-auto block pt-3 text-base font-semibold">{formatINR(p.price)}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** One report, one target: the whole row opens the report. The diagnosis stays inside it. */
function ReportRow({ booking, catalog }: { booking: Booking; catalog: Catalog | null }) {
  const doctor = populated(booking.doctor);
  return (
    <Link
      href={`/app/bookings/${booking.id}/report`}
      className="flex items-center gap-3.5 px-4 py-3.5 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted focus-ring focus-visible:-outline-offset-2"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
        <FileHeart className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-small leading-snug font-semibold">
          <Unbroken>{bookingTitle(booking, catalog)}</Unbroken>
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {formatDate(booking.scheduledDate)}
          {doctor ? ` · ${doctor.name}` : ""}
          {booking.patient.relation !== "self" ? ` · for ${firstName(booking.patient.name)}` : ""}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function EmptyReports({ hasVisit }: { hasVisit: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center">
      <span className="relative grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary">
        <Stethoscope className="size-6" aria-hidden />
        <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
          <FileHeart className="size-3.5" aria-hidden />
        </span>
      </span>
      <p className="mt-3 font-semibold">No reports yet</p>
      <p className="mt-1 max-w-xs text-small text-muted-foreground">
        {hasVisit
          ? "Your report will appear here as soon as your doctor publishes it."
          : "After your first check-up, your report and prescription will be kept here."}
      </p>
    </div>
  );
}

/** Three facts about the service, in the site's own words. */
function TrustStrip() {
  const facts = [
    { icon: ShieldCheck, label: "Registered nurses" },
    { icon: Video, label: "A Nivar doctor on video" },
    { icon: FileHeart, label: `Report ${SITE.report.checkup}` },
  ];
  return (
    <ul className="grid gap-x-4 gap-y-2.5 rounded-2xl border border-border bg-card px-4 py-4 sm:grid-cols-3">
      {facts.map((fact) => (
        <li key={fact.label} className="flex items-center gap-2.5 text-small text-foreground-2">
          <fact.icon className="size-4 shrink-0 text-primary" aria-hidden />
          {fact.label}
        </li>
      ))}
    </ul>
  );
}
