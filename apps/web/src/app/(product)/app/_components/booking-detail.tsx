"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleX,
  Clock,
  CreditCard,
  FileHeart,
  FilePenLine,
  House,
  LoaderCircle,
  MapPin,
  Phone,
  Pill,
  RotateCcw,
  ShieldCheck,
  Star,
  UserRound,
  Video,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { BookingStepper } from "@/components/booking-stepper";
import { EcgLine } from "@/components/brand/ecg-line";
import { LiveMap } from "@/components/live/live-map";
import { VideoCall } from "@/components/live/video-call";
import { etaMinutes, formatDistance, haversineKm } from "@/components/live/geo";
import { StatusBadge } from "@/components/status-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CANCELLABLE_STATUSES,
  EARLIEST_VISIT,
  EXPRESS_SLOT,
  STATUS_META,
  checksLabel,
  dayLabel,
  firstName,
  formatDate,
  formatDateTime,
  formatINR,
  relative,
  slotLabel,
  testName,
  todayISO,
} from "@/lib/format";
import { useBooking, useNurseLocation, useSignalling, useSocketConnected } from "@/lib/socket";
import { populated, type Booking, type BookingStatus, type PaymentStatus, type UserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addDays } from "@/server/time";
import { saveDraftFromVisit } from "./book-wizard";
import { SHEET_BACKDROP, SHEET_POPUP, CheckoutDialog, chooseWithArrowKeys, useBackToClose } from "./checkout-dialog";
import {
  ErrorState,
  GENDER_LABEL,
  HelpCard,
  METHOD_LABEL,
  PersonAvatar,
  RELATION_LABEL,
  SectionTitle,
  Surface,
  Unbroken,
  bookAgainHref,
  bookingTitle,
  serviceIcon,
  useCatalog,
} from "./shared";
import { VitalsSection } from "./vitals-section";

/** Before the nurse is at the door the journey is the news; after that it is a record, kept in the details. */
const JOURNEY_UP_FRONT: BookingStatus[] = ["pending_payment", "confirmed", "assigned", "en_route"];
/** Statuses where something on this page changes by itself, so a lost connection matters. */
const LIVE_STATUSES: BookingStatus[] = ["assigned", "en_route", "arrived", "testing", "consult", "reporting"];
/** A nurse position older than this is shown as the last known place, not as live. */
const STALE_LOCATION_MS = 2 * 60_000;

/** Current time, re-rendered every `intervalMs`, for labels such as "updated 2 minutes ago". */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** True once the live connection has been down for a few seconds (a blip is not worth a word). */
function useConnectionLost(): boolean {
  const connected = useSocketConnected();
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (connected) return;
    const id = window.setTimeout(() => setLost(true), 5000);
    return () => {
      window.clearTimeout(id);
      setLost(false);
    };
  }, [connected]);
  return lost && !connected;
}

/** Phones drop live connections in the background: fetch the visit again when it is looked at or back online. */
function useCatchUp(reload: () => void) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", reload);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", reload);
    };
  }, [reload]);
}

/** "today", "tomorrow" or "on Mon, 16 Nov", to end a sentence about the visit's day. */
function dayInSentence(date: string): string {
  const today = todayISO();
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return `on ${formatDate(date)}`;
}

/** "Today, 9:00 - 10:00 AM" or "Today, Earliest available". */
function whenLabel(booking: Booking): string {
  return `${dayLabel(booking.scheduledDate)}, ${booking.slot === EXPRESS_SLOT ? EARLIEST_VISIT.label : slotLabel(booking.slot)}`;
}

const PAYMENT_WORD: Record<PaymentStatus, string> = {
  paid: "Paid",
  pending: "Not paid yet",
  refunded: "Refunded",
};

// Text sizes for this page: facts and instructions at 15px, meta at 14px, nothing smaller.
const BODY = "text-small leading-relaxed text-foreground-2";
const META = "text-sm text-muted-foreground";
const MAIN_ACTION = "h-14 w-full rounded-full text-base font-semibold sm:h-12";

export function BookingDetail({ id }: { id: string }) {
  const { booking, setBooking, loading, error, errorStatus, reload } = useBooking(id);
  const { catalog } = useCatalog();
  const lost = useConnectionLost();
  useCatchUp(reload);

  if (loading) return <DetailSkeleton />;
  if (!booking) {
    const gone = errorStatus === 404 || errorStatus === 403;
    return (
      <div className="pt-2">
        <BackLink />
        <ErrorState
          className="mt-4"
          title={errorStatus === 404 ? "Booking not found" : errorStatus === 403 ? "This booking isn't yours" : "Couldn't load this booking"}
          message={gone ? "Check the link, or open it from My bookings." : error}
          onRetry={gone ? undefined : reload}
        />
        {gone && (
          <Link href="/app/bookings" className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-12 w-full rounded-full text-small font-semibold")}>
            Go to My bookings
          </Link>
        )}
      </div>
    );
  }

  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  const status = booking.status;
  const showVitals = ["arrived", "testing", "consult", "reporting", "completed"].includes(status);
  const showTeamStrip = Boolean(nurse || doctor) && !["assigned", "en_route", "cancelled"].includes(status);
  const journeyUpFront = JOURNEY_UP_FRONT.includes(status);
  const past = status === "completed" || status === "cancelled";

  return (
    <div className="space-y-5 pb-4">
      <div>
        <BackLink past={past} />
        <header className="mt-2">
          <div className="flex items-center justify-between gap-3">
            <span className="tabular font-mono text-sm font-semibold tracking-wider text-muted-foreground">{booking.code}</span>
            <span className="flex flex-wrap items-center justify-end gap-2">
              {lost && LIVE_STATUSES.includes(status) && (
                <span role="status" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-bg px-2.5 text-sm font-medium text-warning-ink">
                  <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
                </span>
              )}
              <StatusBadge status={status} audience="patient" className="h-7 px-3 text-sm" />
            </span>
          </div>
          <h1 className="mt-1.5 font-display text-[1.65rem] leading-tight md:text-3xl">
            <Unbroken>{bookingTitle(booking, catalog)}</Unbroken>
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-foreground-2">
            <span className="tabular inline-flex items-center gap-1.5">
              {booking.slot === EXPRESS_SLOT ? (
                <Clock className="size-4 shrink-0" aria-hidden />
              ) : (
                <CalendarDays className="size-4 shrink-0" aria-hidden />
              )}
              {whenLabel(booking)}
            </span>
            {/* The account holder knows who they are; a visit for someone else says so. */}
            {booking.patient.relation !== "self" && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4 shrink-0" aria-hidden />
                For {booking.patient.name}
              </span>
            )}
          </p>
        </header>
      </div>

      <StatusPanel booking={booking} setBooking={setBooking} />

      {showVitals && <VitalsSection booking={booking} />}

      {showTeamStrip && <TeamStrip nurse={nurse} doctor={doctor} />}

      {journeyUpFront && (
        <Surface className="p-4 sm:p-5">
          <SectionTitle>Visit journey</SectionTitle>
          <BookingStepper booking={booking} orientation="vertical" audience="patient" />
        </Surface>
      )}

      <DetailsAccordion booking={booking} withTimeline={!journeyUpFront} />

      {CANCELLABLE_STATUSES.includes(status) && <CancelBooking booking={booking} setBooking={setBooking} />}

      <section aria-labelledby="visit-help" className="pt-2">
        <SectionTitle id="visit-help">Need help with this visit?</SectionTitle>
        <HelpCard about={`my booking ${booking.code}`} />
      </section>
    </div>
  );
}

function BackLink({ past = false }: { past?: boolean }) {
  return (
    <Link
      // A finished visit is listed under Past, so going back lands where it came from.
      href={past ? "/app/bookings?tab=past" : "/app/bookings"}
      className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pr-3 pl-2 text-small font-medium text-foreground-2 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <ChevronLeft className="size-4" aria-hidden /> My bookings
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-6 w-28 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// One panel for the status: what is happening now, who, and the one thing to do
// ---------------------------------------------------------------------------

function StatusPanel({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  const nurseName = firstName(nurse?.name) || "Your nurse";
  switch (booking.status) {
    case "pending_payment":
      return <PendingPaymentPanel booking={booking} setBooking={setBooking} />;
    case "confirmed":
      return <ConfirmedPanel booking={booking} />;
    case "assigned":
      return <AssignedPanel booking={booking} nurse={nurse} doctor={doctor} />;
    case "en_route":
      return <EnRoutePanel booking={booking} nurse={nurse} />;
    case "arrived":
      return (
        <HeroCard
          icon={House}
          title={`${nurseName} has arrived`}
          body={`${nurseName} is setting up. Your readings will appear below as they are taken.`}
        />
      );
    case "testing":
      return (
        <HeroCard
          icon={STATUS_META.testing.icon}
          tone="primary"
          live
          title="Tests in progress"
          body={`${nurseName} is taking your readings. ${doctor ? `${doctor.name} can see them as they come in.` : "Your doctor will review them."}`}
        />
      );
    case "consult":
      return <ConsultPanel booking={booking} doctor={doctor} />;
    case "reporting":
      return <ReportingPanel doctor={doctor} />;
    case "completed":
      return <CompletedPanel booking={booking} setBooking={setBooking} doctor={doctor} />;
    case "cancelled":
      return <CancelledPanel booking={booking} />;
  }
}

const TONES = {
  primary: "bg-primary text-primary-foreground",
  outline: "border border-border bg-card text-foreground",
} as const;

function HeroCard({
  icon: Icon,
  title,
  body,
  tone = "outline",
  live,
  children,
  className,
}: {
  icon: typeof House;
  title: string;
  body?: React.ReactNode;
  tone?: keyof typeof TONES;
  live?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface className={cn("animate-fade-up overflow-hidden p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3.5">
        <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-2xl", TONES[tone])}>
          {live && <LiveDot />}
          <Icon className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold">{title}</p>
          {body && <p className={cn("mt-1", BODY)}>{body}</p>}
        </div>
      </div>
      {children}
    </Surface>
  );
}

function LiveDot() {
  return (
    <span aria-hidden className="absolute -top-0.5 -right-0.5 z-10 flex rounded-full ring-2 ring-card">
      <span className="live-dot size-2.5 text-signal" />
    </span>
  );
}

function PendingPaymentPanel({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <Surface className="animate-fade-up overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <CreditCard className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Complete payment to confirm</p>
          <p className={cn("mt-1", BODY)}>Your slot is held. Pay now and we will assign a nurse and doctor right away.</p>
        </div>
      </div>
      <Button onClick={() => setOpen(true)} className={cn("mt-4", MAIN_ACTION)}>
        Complete payment <span className="tabular">{formatINR(booking.amount)}</span>
      </Button>
      <CheckoutDialog
        booking={booking}
        open={open}
        onOpenChange={setOpen}
        phone={user?.phone}
        onPaid={(next) => {
          setBooking(next);
          setOpen(false);
          toast.success("Payment successful", { description: `${next.code} is confirmed.` });
        }}
      />
    </Surface>
  );
}

function ConfirmedPanel({ booking }: { booking: Booking }) {
  const express = booking.slot === EXPRESS_SLOT;
  // Assigning takes a while for a visit days away: the motion is only for a visit today.
  const today = booking.scheduledDate === todayISO();
  return (
    <Surface className="animate-fade-up overflow-hidden">
      <div className="relative flex flex-col items-center px-5 pt-7 pb-6 text-center">
        <div className="relative flex items-center" aria-hidden>
          <span className="relative z-10 grid size-14 place-items-center rounded-full border border-border bg-card ring-4 ring-card">
            {today && <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-ring" />}
            <UserRound className="size-6 text-foreground" />
          </span>
          <span className="relative -ml-3 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-card">
            {today ? <LoaderCircle className="size-6 animate-spin [animation-duration:1.6s]" /> : <CalendarCheck className="size-6" />}
          </span>
          <span className="relative z-10 -ml-3 grid size-14 place-items-center rounded-full border border-border bg-card ring-4 ring-card">
            {today && <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-ring [animation-delay:0.6s]" />}
            <ShieldCheck className="size-6 text-foreground" />
          </span>
        </div>
        <p className="relative mt-4 text-base font-semibold">Booking confirmed. We are assigning your nurse and doctor.</p>
        <p className={cn("relative mt-1 max-w-sm", BODY)}>
          {express
            ? `${EARLIEST_VISIT.title}: we are assigning the next available nurse. You will see who is coming here.`
            : "You will see your nurse's and doctor's names here once they are assigned. You do not need to keep this page open."}
        </p>
        <span className="relative mt-4 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-background px-3 py-1 text-sm font-medium text-foreground ring-1 ring-border ring-inset">
          <BadgeCheck className="size-4 text-success" aria-hidden />
          <span className="tabular">{formatINR(booking.amount)}</span> paid via {METHOD_LABEL[booking.payment.method ?? "upi"]}
        </span>
      </div>
    </Surface>
  );
}

/** A labelled call button, 44px tall: a phone icon alone is easy to miss and hard to hit. */
function CallButton({ phone, name, primary = false }: { phone: string; name: string; primary?: boolean }) {
  return (
    <a
      href={`tel:+91${phone}`}
      aria-label={`Call ${name}`}
      className={cn(
        buttonVariants({ variant: primary ? "default" : "outline" }),
        "h-11 shrink-0 rounded-full px-4 text-small font-semibold",
      )}
    >
      <Phone aria-hidden /> Call
    </a>
  );
}

function StaffCard({ person, kind }: { person: UserSummary; kind: "nurse" | "doctor" }) {
  const years = person.yearsExperience ? `${person.yearsExperience} years' experience` : null;
  const meta = kind === "doctor" ? [person.specialization, years] : [years];
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-border bg-background p-3.5">
      <PersonAvatar name={person.name} tone={kind === "nurse" ? "ink" : "outline"} size="md" />
      <div className="min-w-0 flex-1">
        <p className={META}>{kind === "nurse" ? "Your nurse" : "Your doctor"}</p>
        <p className="mt-0.5 text-base leading-snug font-semibold break-words">{person.name}</p>
        {person.qualifications && <p className={BODY}>{person.qualifications}</p>}
        {meta.some(Boolean) && <p className={cn("mt-0.5", META)}>{meta.filter(Boolean).join(" · ")}</p>}
        {/* The registration number is the checkable fact behind the doctor's title. */}
        {kind === "doctor" && person.registrationNo && (
          <p className={cn("tabular mt-0.5", META)}>Reg. No. {person.registrationNo}</p>
        )}
      </div>
      {kind === "nurse" && person.phone && <CallButton phone={person.phone} name={person.name} />}
    </div>
  );
}

function AssignedPanel({
  booking,
  nurse,
  doctor,
}: {
  booking: Booking;
  nurse: UserSummary | null;
  doctor: UserSummary | null;
}) {
  const express = booking.slot === EXPRESS_SLOT;
  const first = firstName(nurse?.name);
  const who = first || "Your nurse";
  const whoLater = first || "your nurse";
  return (
    <Surface className="animate-fade-up p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground">
          <BadgeCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Your care team is ready</p>
          <p className={cn("mt-1", BODY)}>
            {express
              ? `${who} is your nurse for the visit today.`
              : `${who} will come to your home for the ${slotLabel(booking.slot)} visit ${dayInSentence(booking.scheduledDate)}.`}{" "}
            You can follow the trip here once {whoLater} is on the way.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2.5">
        {nurse && <StaffCard person={nurse} kind="nurse" />}
        {doctor && <StaffCard person={doctor} kind="doctor" />}
      </div>
    </Surface>
  );
}

function EnRoutePanel({ booking, nurse }: { booking: Booking; nurse: UserSummary | null }) {
  const live = useNurseLocation(booking.id, booking.nurseLocation);
  // Re-render on a clock, so "updated 20 seconds ago" keeps telling the truth between positions.
  const now = useNow(30_000);
  const home = { lat: booking.address.lat, lng: booking.address.lng, label: booking.address.label || "Home" };
  const km = live ? haversineKm(live, home) : null;
  const first = firstName(nurse?.name);
  const name = first || "Your nurse";
  const near = km !== null && km < 0.08;
  const at = live?.at ? Date.parse(live.at) : NaN;
  const stale = Number.isFinite(at) && now - at > STALE_LOCATION_MS;
  const staleMinutes = Math.max(1, Math.round((now - at) / 60_000));

  let title: string;
  let line: React.ReactNode;
  if (km === null) {
    title = `${name} is on the way`;
    line = `Getting ${first ? `${first}'s` : "your nurse's"} location…`;
  } else if (stale) {
    // An old position would give a wrong arrival time, so the page says how old it is instead.
    title = `${name} is on the way`;
    line = (
      <span className="inline-flex items-start gap-1.5 text-warning-ink">
        <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden />
        <span>
          Last location {staleMinutes} min ago. It will update when the nurse&apos;s phone is back online.
        </span>
      </span>
    );
  } else if (near) {
    title = `${name} is at your door`;
    line = "Please open the door.";
  } else {
    title = `Arriving in about ${etaMinutes(km)} min`;
    line = `${name} is ${formatDistance(km)} away${live?.at ? ` · updated ${relative(live.at)}` : ""}`;
  }

  return (
    <Surface className="animate-fade-up overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 sm:px-5">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          {!stale && <LiveDot />}
          <STATUS_META.en_route.icon className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="tabular text-base font-semibold">{title}</p>
          <p className={cn("tabular", BODY)}>{line}</p>
        </div>
      </div>
      {/* On a phone a finger on the map scrolls the page, so the nurse card and Call stay in reach. */}
      <LiveMap
        home={home}
        nurse={live}
        nurseName={nurse?.name}
        height={280}
        showEta={false}
        touchScrollsPage
        className="mx-0 rounded-none border-x-0"
      />
      {nurse && (
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <PersonAvatar name={nurse.name} tone="ink" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-semibold">{nurse.name}</p>
            <p className={cn("truncate", META)}>{nurse.qualifications || "Registered nurse"}</p>
          </div>
          {nurse.phone && <CallButton phone={nurse.phone} name={nurse.name} primary />}
        </div>
      )}
    </Surface>
  );
}

function ConsultPanel({ booking, doctor }: { booking: Booking; doctor: UserSummary | null }) {
  const [inCall, setInCall] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const signalling = useSignalling();
  const { user } = useAuth();
  const docName = doctor?.name ?? "Your doctor";
  const overlayRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const joinRef = useRef<HTMLButtonElement>(null);

  // The overlay closes by itself when the call ends (the doctor moves on to the report).
  const showCall = inCall && booking.status === "consult" && Boolean(signalling);

  const leave = () => {
    setConfirmLeave(false);
    setInCall(false);
    joinRef.current?.focus();
  };

  // Back and Escape ask first: leaving by accident would drop the doctor.
  useBackToClose(showCall, () => {
    setConfirmLeave(true);
    return false;
  });

  useEffect(() => {
    if (!showCall) return;
    overlayRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCall]);

  useEffect(() => {
    if (confirmLeave) stayRef.current?.focus();
  }, [confirmLeave]);

  return (
    <>
      <div className="relative animate-fade-up overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground">
        <EcgLine beats={4} thin className="pointer-events-none absolute inset-x-0 top-3 h-14 opacity-60" strokeClassName="stroke-white/30" glowClassName="stroke-trace" />
        <div className="relative">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/12 px-2.5 text-sm font-medium">
            <span className="live-dot size-1.5 text-trace" aria-hidden /> Doctor is ready
          </span>
          <div className="mt-4 flex items-center gap-3.5">
            <PersonAvatar name={doctor?.name} tone="outline" size="lg" className="border-0 ring-white/20" />
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight font-medium">{docName}</p>
              <p className="text-small text-primary-foreground/80">
                {[doctor?.specialization, doctor?.qualifications].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-small leading-relaxed text-primary-foreground/85">
            Your readings are with the doctor. Join the video call to discuss them. Your nurse stays with you.
          </p>
          <Button
            ref={joinRef}
            onClick={() => setInCall(true)}
            disabled={!signalling}
            className="mt-5 h-auto min-h-14 w-full rounded-full bg-white px-4 py-3 text-base leading-snug font-semibold whitespace-normal text-foreground hover:bg-white/90 sm:min-h-12"
          >
            <Video className="size-5" aria-hidden /> Join video call with {doctor ? `Dr. ${firstName(doctor.name)}` : "your doctor"}
          </Button>
        </div>
      </div>

      {showCall && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Video call with ${docName}`}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            setConfirmLeave((open) => !open);
          }}
          className="fixed inset-x-0 top-0 z-[60] flex h-dvh flex-col bg-[#0a0a0a] pb-safe outline-none sm:p-6"
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <div className="px-4 py-3 text-white sm:px-0 sm:pt-0">
              <p className="truncate text-small font-semibold">{docName}</p>
              <p className="text-sm text-white/70">{booking.code} · Private video call</p>
            </div>
            {confirmLeave && (
              <div role="alertdialog" aria-label="Leave the video call?" className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-2xl bg-white/10 p-3 text-white sm:mx-0">
                <p className="min-w-0 flex-1 basis-40 text-small font-semibold">Leave the video call?</p>
                <button
                  ref={stayRef}
                  type="button"
                  onClick={() => setConfirmLeave(false)}
                  className="h-11 rounded-full bg-white px-5 text-small font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={leave}
                  className="h-11 rounded-full bg-white/10 px-5 text-small font-semibold text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  Leave call
                </button>
              </div>
            )}
            <VideoCall
              signalling={signalling!}
              bookingId={booking.id}
              self={{ name: user?.name || booking.patient.name, role: "customer" }}
              onLeave={leave}
              className="h-full min-h-0 flex-1 rounded-none sm:rounded-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}

function ReportingPanel({ doctor }: { doctor: UserSummary | null }) {
  return (
    <Surface className="animate-fade-up overflow-hidden">
      <div className="flex items-start gap-3.5 p-4 sm:p-5">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground">
          <LiveDot />
          <FilePenLine className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{doctor?.name ?? "Your doctor"} is writing your report</p>
          <p className={cn("mt-1", BODY)}>
            Your diagnosis, prescription and advice will appear here as soon as the doctor publishes the report.
          </p>
        </div>
      </div>
      <div className="space-y-2 border-t border-border px-4 py-4 sm:px-5" aria-hidden>
        {["w-3/4", "w-full", "w-5/6", "w-2/5"].map((w, i) => (
          <div key={w} className={cn("h-2.5 animate-pulse rounded-full bg-muted", w)} style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </Surface>
  );
}

function CompletedPanel({
  booking,
  setBooking,
  doctor,
}: {
  booking: Booking;
  setBooking: (b: Booking) => void;
  doctor: UserSummary | null;
}) {
  const { user } = useAuth();
  const report = booking.report;
  const rxCount = report?.prescription?.length ?? 0;
  // Same check-up, person and address; the wizard opens on the date, the one thing left to choose.
  const again = bookAgainHref(booking);
  const againHref = `${again}${again.includes("?") ? "&" : "?"}step=4`;
  return (
    <div className="space-y-4">
      <Surface className="animate-fade-up overflow-hidden">
        <div className="relative border-b border-border px-4 pt-4 pb-4 sm:px-5">
          <div className="relative flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <FileHeart className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">Your report is ready</p>
              <p className={cn("tabular mt-0.5", META)}>
                By {doctor?.name ?? "your doctor"}
                {report?.publishedAt ? ` · ${formatDateTime(report.publishedAt)}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4 sm:px-5">
          {report?.diagnosis && (
            <div>
              <p className={META}>Diagnosis</p>
              <p className="mt-0.5 text-base leading-snug font-semibold">{report.diagnosis}</p>
            </div>
          )}
          {report?.summary && <p className={cn("line-clamp-3", BODY)}>{report.summary}</p>}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
              <Pill className="size-4 text-muted-foreground" aria-hidden />
              {rxCount ? `${rxCount} medicine${rxCount === 1 ? "" : "s"} prescribed` : "No medicines prescribed"}
            </span>
            {report?.followUp && (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden /> Follow-up advised
              </span>
            )}
          </div>
          <Link href={`/app/bookings/${booking.id}/report`} className={cn(buttonVariants(), "mt-1", MAIN_ACTION)}>
            View full report <ChevronRight aria-hidden />
          </Link>
          {user && (
            <Link
              href={againHref}
              onClick={() => saveDraftFromVisit(booking, user)}
              className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full rounded-full text-small font-semibold")}
            >
              <RotateCcw aria-hidden /> Book again
            </Link>
          )}
        </div>
      </Surface>
      <RatingCard booking={booking} setBooking={setBooking} />
    </div>
  );
}

function RatingCard({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const rated = booking.rating?.score;
  const nurse = populated(booking.nurse);

  const submit = async () => {
    if (!score) return;
    setSaving(true);
    try {
      const { booking: next } = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/rate`, {
        score,
        comment: comment.trim(),
      });
      setBooking(next);
      toast.success("Thank you for your feedback");
    } catch (err) {
      toast.error("Couldn't save your rating", { description: errorMessage(err), duration: 10_000 });
    } finally {
      setSaving(false);
    }
  };

  if (rated) {
    return (
      <Surface className="flex items-center gap-3.5 p-4 sm:p-5">
        <div className="flex gap-0.5" role="img" aria-label={`You rated ${rated} out of 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={cn("size-5", i <= rated ? "fill-foreground text-foreground" : "text-border")} aria-hidden />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-small font-semibold">Thanks for rating your visit</p>
          {booking.rating?.comment && <p className={cn("truncate", META)}>&ldquo;{booking.rating.comment}&rdquo;</p>}
        </div>
      </Surface>
    );
  }

  const shown = hover || score;
  const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
  return (
    <Surface className="p-4 sm:p-5">
      <p className="text-small font-semibold">How was your visit{nurse ? ` with ${firstName(nurse.name)}` : ""}?</p>
      <p className={META}>Your rating helps our nurses and doctors.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div role="radiogroup" aria-label="Rating" className="flex gap-0.5" onMouseLeave={() => setHover(0)} onKeyDown={chooseWithArrowKeys}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={score === i}
              aria-label={`${i} star${i === 1 ? "" : "s"}, ${LABELS[i]}`}
              onClick={() => setScore(i)}
              onMouseEnter={() => setHover(i)}
              className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <Star
                className={cn("size-7 transition-colors", i <= shown ? "fill-foreground text-foreground" : "text-input")}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
          ))}
        </div>
        <span className="text-small font-medium text-foreground-2" aria-hidden>
          {LABELS[shown]}
        </span>
      </div>
      {score > 0 && (
        <div className="mt-3 animate-fade-up space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything you'd like to share? (optional)"
            aria-label="Anything you'd like to share? (optional)"
            rows={2}
            maxLength={1000}
            className="rounded-xl bg-card px-3.5 py-2.5 text-base md:text-base"
          />
          <Button onClick={submit} disabled={saving} className="h-12 w-full rounded-full text-small font-semibold">
            {saving && <LoaderCircle className="animate-spin" aria-hidden />} Submit rating
          </Button>
        </div>
      )}
    </Surface>
  );
}

function CancelledPanel({ booking }: { booking: Booking }) {
  const entry = [...(booking.timeline ?? [])].reverse().find((t) => t.status === "cancelled");
  const refunded = booking.payment.status === "refunded" || booking.payment.status === "paid";
  return (
    <Surface className="animate-fade-up p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-danger">
          <CircleX className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">This booking was cancelled</p>
          <p className={cn("mt-1", BODY)}>
            {entry?.note || "No visit will take place."}
            {entry?.at ? ` · ${formatDateTime(entry.at)}` : ""}
          </p>
          {booking.payment.method && refunded && (
            <p className={cn("mt-2", BODY)}>Any amount paid is refunded to your original payment method in 3 to 5 working days.</p>
          )}
        </div>
      </div>
      <Link href="/app/book" className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-12 w-full rounded-full text-small font-semibold")}>
        Book a new check-up
      </Link>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Care team strip, details, cancel
// ---------------------------------------------------------------------------

function TeamStrip({ nurse, doctor }: { nurse: UserSummary | null; doctor: UserSummary | null }) {
  return (
    <Surface className="grid grid-cols-2 divide-x divide-border">
      {[
        { p: nurse, role: "Nurse", tone: "ink" as const },
        { p: doctor, role: "Doctor", tone: "outline" as const },
      ].map(({ p, role, tone }) =>
        p ? (
          <div key={role} className="flex min-w-0 items-center gap-2.5 p-3.5">
            <PersonAvatar name={p.name} tone={tone} size="sm" />
            <div className="min-w-0">
              <p className={META}>{role}</p>
              <p className="text-small leading-snug font-semibold break-words">{p.name}</p>
            </div>
          </div>
        ) : (
          <div key={role} />
        ),
      )}
    </Surface>
  );
}

const TRIGGER = "py-4 text-base font-semibold hover:no-underline";
const DETAILS_GRID = "grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 pb-2 text-small";

function DetailsAccordion({ booking, withTimeline }: { booking: Booking; withTimeline: boolean }) {
  const a = booking.address;
  const p = booking.patient;
  return (
    <Surface className="px-4 sm:px-5">
      <Accordion multiple>
        <AccordionItem value="tests">
          <AccordionTrigger className={TRIGGER}>What&apos;s included ({checksLabel(booking.serviceCodes)})</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2.5 pb-2">
              {booking.serviceCodes.map((c) => {
                const Icon = serviceIcon(c);
                return (
                  <li key={c} className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-small">{testName(c)}</span>
                  </li>
                );
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
        {withTimeline && (
          <AccordionItem value="timeline">
            <AccordionTrigger className={TRIGGER}>Visit timeline</AccordionTrigger>
            <AccordionContent>
              <div className="pt-1 pb-2">
                <BookingStepper booking={booking} orientation="vertical" audience="patient" />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        <AccordionItem value="patient">
          <AccordionTrigger className={TRIGGER}>Patient</AccordionTrigger>
          <AccordionContent>
            <dl className={DETAILS_GRID}>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{p.name}</dd>
              <dt className="text-muted-foreground">Age, gender</dt>
              <dd>
                {p.age} years, {GENDER_LABEL[p.gender] ?? p.gender}
              </dd>
              <dt className="text-muted-foreground">Relation</dt>
              <dd>{RELATION_LABEL[p.relation] ?? p.relation}</dd>
              {booking.notes && (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="leading-relaxed">{booking.notes}</dd>
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="address">
          <AccordionTrigger className={TRIGGER}>Address</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-start gap-3 pb-2">
              <MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <p className="text-small leading-relaxed">
                <span className="font-medium">{a.label}</span>
                <br />
                {a.line1}
                <br />
                {[a.area, a.city, a.pincode].filter(Boolean).join(", ")}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="payment">
          <AccordionTrigger className={TRIGGER}>Payment</AccordionTrigger>
          <AccordionContent>
            <dl className={DETAILS_GRID}>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular font-semibold">{formatINR(booking.amount)}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{PAYMENT_WORD[booking.payment.status] ?? booking.payment.status}</dd>
              {booking.payment.method && (
                <>
                  <dt className="text-muted-foreground">Method</dt>
                  <dd>{METHOD_LABEL[booking.payment.method]}</dd>
                </>
              )}
              {booking.payment.txnId && (
                <>
                  <dt className="text-muted-foreground">Transaction</dt>
                  <dd className="tabular font-mono text-sm leading-6 break-all">{booking.payment.txnId}</dd>
                </>
              )}
              {booking.payment.paidAt && (
                <>
                  <dt className="text-muted-foreground">Paid on</dt>
                  <dd className="tabular">{formatDateTime(booking.payment.paidAt)}</dd>
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Surface>
  );
}

const CANCEL_REASONS = ["Change of plans", "Booked by mistake", "Found another time", "Other"] as const;

function CancelBooking({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<(typeof CANCEL_REASONS)[number] | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  const close = (next: boolean) => {
    if (busy) return;
    setOpen(next);
  };
  useBackToClose(open, () => {
    if (busy) return false;
    setOpen(false);
  });

  const cancel = async () => {
    setBusy(true);
    const reason = choice === "Other" ? other.trim() : (choice ?? "");
    try {
      const { booking: next } = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/cancel`, {
        reason: reason || undefined,
      });
      setBooking(next);
      setOpen(false);
      toast("Booking cancelled", { description: `${next.code} has been cancelled.` });
    } catch (err) {
      toast.error("Couldn't cancel this booking", { description: errorMessage(err), duration: 10_000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => setOpen(true)} className="h-12 rounded-full px-5 text-small text-foreground-2 hover:text-destructive">
          Cancel booking
        </Button>
      </div>
      {/* A sheet on phones like the checkout, opening on "Keep booking" so no keyboard jumps up over the buttons. */}
      <DialogPrimitive.Root open={open} onOpenChange={close} disablePointerDismissal={busy}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className={SHEET_BACKDROP} />
          <DialogPrimitive.Popup className={SHEET_POPUP} initialFocus={keepRef}>
            <div className="overflow-y-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pt-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
              <DialogPrimitive.Title className="text-lg font-semibold">Cancel this booking?</DialogPrimitive.Title>
              <DialogPrimitive.Description className={cn("mt-1.5", BODY)}>
                {booking.code} · {whenLabel(booking)}.{" "}
                {booking.payment.status === "paid"
                  ? `${formatINR(booking.amount)} will be refunded to your ${METHOD_LABEL[booking.payment.method ?? "upi"]} in 3 to 5 working days.`
                  : "No payment has been taken."}
              </DialogPrimitive.Description>

              <p id="cancel-why" className="mt-5 text-small font-medium text-foreground">
                Tell us why <span className="font-normal text-muted-foreground">(optional)</span>
              </p>
              <div role="radiogroup" aria-labelledby="cancel-why" onKeyDown={chooseWithArrowKeys} className="mt-2 flex flex-wrap gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={choice === r}
                    onClick={() => setChoice(choice === r ? null : r)}
                    className={cn(
                      "h-11 rounded-full border px-4 text-small font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      choice === r ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {choice === "Other" && (
                <Textarea
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  aria-label="Tell us why (optional)"
                  rows={2}
                  maxLength={500}
                  className="mt-3 rounded-xl px-3.5 py-2.5 text-base md:text-base"
                />
              )}

              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                <Button
                  onClick={cancel}
                  disabled={busy}
                  className="h-12 w-full rounded-full bg-destructive text-small font-semibold text-white hover:bg-destructive/90 sm:order-2"
                >
                  {busy && <LoaderCircle className="animate-spin" aria-hidden />} Yes, cancel
                </Button>
                <Button
                  ref={keepRef}
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="h-12 w-full rounded-full text-small font-semibold sm:order-1"
                >
                  Keep booking
                </Button>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

