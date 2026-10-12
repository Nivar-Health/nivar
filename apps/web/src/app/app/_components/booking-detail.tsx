"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleX,
  CreditCard,
  FileHeart,
  FilePenLine,
  House,
  LoaderCircle,
  MapPin,
  Phone,
  Pill,
  ShieldCheck,
  Star,
  UserRound,
  Video,
  Zap,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  CANCELLABLE_STATUSES,
  EXPRESS_SLOT,
  STATUS_META,
  dayLabel,
  firstName,
  formatDateTime,
  formatINR,
  relative,
  slotLabel,
} from "@/lib/format";
import { useBooking, useNurseLocation, useSocket } from "@/lib/socket";
import { populated, type Booking, type UserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckoutDialog } from "./checkout-dialog";
import {
  ErrorState,
  GENDER_LABEL,
  METHOD_LABEL,
  PersonAvatar,
  RELATION_LABEL,
  SectionTitle,
  Surface,
  bookingTitle,
  serviceIcon,
  serviceMap,
  useCatalog,
} from "./shared";
import { VitalsSection } from "./vitals-section";

export function BookingDetail({ id }: { id: string }) {
  const { booking, setBooking, loading, error, errorStatus, reload } = useBooking(id);
  const { catalog } = useCatalog();

  if (loading) return <DetailSkeleton />;
  if (!booking) {
    return (
      <div className="pt-2">
        <BackLink />
        <ErrorState
          className="mt-4"
          title={errorStatus === 404 ? "Booking not found" : errorStatus === 403 ? "This booking isn't yours" : "Couldn't load this booking"}
          message={errorStatus === 404 || errorStatus === 403 ? "Check the link, or open it from My bookings." : error}
          onRetry={errorStatus === 404 || errorStatus === 403 ? undefined : reload}
        />
      </div>
    );
  }

  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  const status = booking.status;
  const showVitals = ["arrived", "testing", "consult", "reporting", "completed"].includes(status);
  const showTeamStrip = Boolean(nurse || doctor) && status !== "assigned" && status !== "cancelled";

  return (
    <div className="space-y-5 pb-4">
      <div>
        <BackLink />
        <header className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="tabular font-mono text-xs font-semibold tracking-wider text-muted-foreground">{booking.code}</span>
            <StatusBadge status={status} audience="patient" />
          </div>
          <h1 className="mt-1.5 font-display text-[1.65rem] leading-tight md:text-3xl">
            {bookingTitle(booking, catalog)}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {booking.slot === EXPRESS_SLOT ? (
                <Zap className="size-3.5 fill-current text-foreground" aria-hidden />
              ) : (
                <CalendarDays className="size-3.5" aria-hidden />
              )}
              {dayLabel(booking.scheduledDate)}, {slotLabel(booking.slot)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden />
              {booking.patient.name}
            </span>
          </p>
        </header>
      </div>

      <StatusPanel booking={booking} setBooking={setBooking} />

      {showVitals && <VitalsSection booking={booking} />}

      {showTeamStrip && <TeamStrip nurse={nurse} doctor={doctor} />}

      <Surface className="p-4 sm:p-5">
        <SectionTitle>Visit journey</SectionTitle>
        <BookingStepper booking={booking} orientation="vertical" />
      </Surface>

      <DetailsAccordion booking={booking} />

      {CANCELLABLE_STATUSES.includes(status) && <CancelBooking booking={booking} setBooking={setBooking} />}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/app/bookings"
      className="-ml-1.5 inline-flex h-8 items-center gap-1 rounded-full pr-3 pl-1.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
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
// Status-driven context card
// ---------------------------------------------------------------------------

function StatusPanel({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
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
          tone="outline"
          title={`${firstName(nurse?.name) || "Your nurse"} has arrived`}
          body="She is setting up the smart ECG and stethoscope. Your readings will appear below as they are recorded."
        />
      );
    case "testing":
      return (
        <HeroCard
          icon={STATUS_META.testing.icon}
          tone="ink"
          live
          title="Tests in progress"
          body={`${firstName(nurse?.name) || "Your nurse"} is recording your vitals. ${doctor ? `${doctor.name} is watching your readings live.` : "Your doctor will review them live."}`}
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
  ink: "bg-foreground text-background",
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
          {live && <span aria-hidden className="absolute -top-0.5 -right-0.5 z-10 flex rounded-full ring-2 ring-card"><span className="live-dot size-2.5 text-signal" /></span>}
          <Icon className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold">{title}</p>
          {body && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>}
        </div>
      </div>
      {children}
    </Surface>
  );
}

function PendingPaymentPanel({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <Surface className="animate-fade-up overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
          <CreditCard className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Complete payment to confirm</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Your slot is held. Pay now and we will assign a nurse and doctor right away.
          </p>
        </div>
      </div>
      <Button onClick={() => setOpen(true)} className="mt-4 h-12 w-full rounded-xl text-[15px] font-semibold">
        Complete payment {formatINR(booking.amount)}
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
  return (
    <Surface className="animate-fade-up overflow-hidden">
      <div className="relative flex flex-col items-center px-5 pt-7 pb-6 text-center">
        <div className="relative flex items-center">
          <span className="relative z-10 grid size-14 place-items-center rounded-full border border-border bg-card ring-4 ring-card">
            <span className="absolute inset-0 rounded-full bg-foreground/10 animate-pulse-ring" />
            <UserRound className="size-6 text-foreground" aria-hidden />
          </span>
          <span className="relative -ml-3 grid size-14 place-items-center rounded-full bg-foreground text-background ring-4 ring-card">
            <LoaderCircle className="size-6 animate-spin [animation-duration:1.6s]" aria-hidden />
          </span>
          <span className="relative z-10 -ml-3 grid size-14 place-items-center rounded-full border border-border bg-card ring-4 ring-card">
            <span className="absolute inset-0 rounded-full bg-foreground/10 animate-pulse-ring [animation-delay:0.6s]" />
            <ShieldCheck className="size-6 text-foreground" aria-hidden />
          </span>
        </div>
        <p className="relative mt-4 text-base font-semibold">Booking confirmed. Assigning your care team</p>
        <p className="relative mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {express
            ? "Express visit: we are matching the nearest Nivar nurse. She will be at your door within 60 minutes."
            : "We are matching a certified Nivar nurse and doctor for your visit. This usually takes a few minutes."}
        </p>
        <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border ring-inset">
          <BadgeCheck className="size-3.5 text-success" aria-hidden /> {formatINR(booking.amount)} paid via {METHOD_LABEL[booking.payment.method ?? "upi"]}
        </span>
      </div>
    </Surface>
  );
}

function StaffCard({ person, kind }: { person: UserSummary; kind: "nurse" | "doctor" }) {
  const meta =
    kind === "doctor"
      ? [person.specialization, person.yearsExperience ? `${person.yearsExperience} yrs exp` : null]
      : [person.yearsExperience ? `${person.yearsExperience} yrs exp` : null, "Nivar certified"];
  return (
    <div className="flex items-start gap-3.5 rounded-2xl border border-border bg-background p-3.5">
      <PersonAvatar name={person.name} tone={kind === "nurse" ? "ink" : "outline"} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">
          {kind === "nurse" ? "Your nurse" : "Your doctor"}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold">
          <span className="truncate">{person.name}</span>
          <BadgeCheck className="size-4 shrink-0 text-success" aria-label="Verified" />
        </p>
        {person.qualifications && <p className="text-[13px] leading-snug text-muted-foreground">{person.qualifications}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">{meta.filter(Boolean).join(" · ")}</p>
      </div>
      {kind === "nurse" && person.phone && (
        <a
          href={`tel:+91${person.phone}`}
          aria-label={`Call ${person.name}`}
          className={cn(buttonVariants({ variant: "secondary", size: "icon-lg" }), "rounded-full")}
        >
          <Phone aria-hidden />
        </a>
      )}
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
  return (
    <Surface className="animate-fade-up p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground">
          <BadgeCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">Your care team is ready</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {firstName(nurse?.name) || "Your nurse"} will start{" "}
            {express ? "towards you shortly" : `soon for your ${slotLabel(booking.slot)} visit`}. You can track her
            live on the map.
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
  const home = { lat: booking.address.lat, lng: booking.address.lng, label: booking.address.label || "Home" };
  const km = live ? haversineKm(live, home) : null;
  const name = firstName(nurse?.name) || "Your nurse";
  const near = km !== null && km < 0.08;
  return (
    <Surface className="animate-fade-up overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 sm:px-5">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
          <span aria-hidden className="absolute -top-0.5 -right-0.5 z-10 flex rounded-full ring-2 ring-card"><span className="live-dot size-2.5 text-signal" /></span>
          <STATUS_META.en_route.icon className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {km === null ? (
            <>
              <p className="text-base font-semibold">{name} is on the way</p>
              <p className="text-[13px] text-muted-foreground">Waiting for live location...</p>
            </>
          ) : near ? (
            <>
              <p className="text-base font-semibold">{name} is at your door</p>
              <p className="text-[13px] text-muted-foreground">Please let her in</p>
            </>
          ) : (
            <>
              <p className="tabular text-base font-semibold">
                Arriving in about {etaMinutes(km)} min
              </p>
              <p className="tabular text-[13px] text-muted-foreground">
                {name} is {formatDistance(km)} away
                {live?.at ? ` · updated ${relative(live.at)}` : ""}
              </p>
            </>
          )}
        </div>
      </div>
      <LiveMap home={home} nurse={live} nurseName={nurse?.name} height={300} showEta={false} className="mx-0 rounded-none border-x-0" />
      {nurse && (
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <PersonAvatar name={nurse.name} tone="ink" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{nurse.name}</p>
            <p className="truncate text-xs text-muted-foreground">{nurse.qualifications || "Nivar certified nurse"}</p>
          </div>
          {nurse.phone && (
            <a
              href={`tel:+91${nurse.phone}`}
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-10 rounded-full px-4")}
            >
              <Phone aria-hidden /> Call
            </a>
          )}
        </div>
      )}
    </Surface>
  );
}

function ConsultPanel({ booking, doctor }: { booking: Booking; doctor: UserSummary | null }) {
  const [inCall, setInCall] = useState(false);
  const socket = useSocket();
  const { user } = useAuth();
  const docName = doctor?.name ?? "your doctor";

  // Close the call overlay when the consult ends (doctor moves to reporting).
  const showCall = inCall && booking.status === "consult" && socket;

  useEffect(() => {
    if (!showCall) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCall]);

  return (
    <>
      <div className="relative animate-fade-up overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground">
        <EcgLine beats={4} thin className="pointer-events-none absolute inset-x-0 top-3 h-14 opacity-60" strokeClassName="stroke-white/30" glowClassName="stroke-signal" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-medium">
            <span className="live-dot size-1.5 text-signal" /> Doctor is ready
          </span>
          <div className="mt-4 flex items-center gap-3.5">
            <PersonAvatar name={doctor?.name} tone="outline" size="lg" className="border-0 ring-white/20" />
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight font-medium">{docName}</p>
              <p className="text-[13px] text-primary-foreground/75">
                {[doctor?.specialization, doctor?.qualifications].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-primary-foreground/80">
            Your readings are with the doctor. Join the video consult to discuss them. Your nurse stays with you.
          </p>
          <Button
            onClick={() => setInCall(true)}
            disabled={!socket}
            className="mt-5 h-auto min-h-12 w-full rounded-xl bg-white px-4 py-3 text-[15px] leading-snug font-semibold whitespace-normal text-foreground hover:bg-white/90"
          >
            <Video className="size-5" aria-hidden /> Join video consult with {doctor ? `Dr. ${firstName(doctor.name)}` : "your doctor"}
          </Button>
        </div>
      </div>

      {showCall && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Video consult with ${docName}`}
          className="fixed inset-x-0 top-0 z-[60] flex h-dvh flex-col bg-[#0a0a0a] pb-safe sm:p-6"
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-white sm:px-0 sm:pt-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Consult with {docName}</p>
                <p className="text-xs text-white/60">{booking.code} · Private video consult</p>
              </div>
              <button
                type="button"
                onClick={() => setInCall(false)}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-white/10 px-3.5 text-sm font-medium text-white transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronLeft className="size-4" aria-hidden /> Back to visit
              </button>
            </div>
            <VideoCall
              socket={socket}
              bookingId={booking.id}
              self={{ name: user?.name || booking.patient.name, role: "customer" }}
              onLeave={() => setInCall(false)}
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
          <span aria-hidden className="absolute -top-0.5 -right-0.5 z-10 flex rounded-full ring-2 ring-card"><span className="live-dot size-2.5 text-signal" /></span>
          <FilePenLine className="relative size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{doctor?.name ?? "Your doctor"} is writing your report</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Diagnosis, prescription and advice will appear here as soon as it is published. Usually within 15 minutes.
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
  const report = booking.report;
  const rxCount = report?.prescription?.length ?? 0;
  return (
    <div className="space-y-4">
      <Surface className="animate-fade-up overflow-hidden">
        <div className="relative border-b border-border px-4 pt-4 pb-4 sm:px-5">
          <div className="relative flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
              <FileHeart className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">Your report is ready</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                By {doctor?.name ?? "your doctor"}
                {report?.publishedAt ? ` · ${formatDateTime(report.publishedAt)}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4 sm:px-5">
          {report?.diagnosis && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
              <p className="mt-0.5 text-[15px] leading-snug font-semibold">{report.diagnosis}</p>
            </div>
          )}
          {report?.summary && <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{report.summary}</p>}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              <Pill className="size-3.5 text-muted-foreground" aria-hidden />
              {rxCount ? `${rxCount} medicine${rxCount === 1 ? "" : "s"} prescribed` : "No medicines prescribed"}
            </span>
            {report?.followUp && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden /> Follow-up advised
              </span>
            )}
          </div>
          <Link
            href={`/app/bookings/${booking.id}/report`}
            className={cn(buttonVariants({ size: "lg" }), "mt-1 h-12 w-full rounded-xl text-[15px] font-semibold")}
          >
            View full report <ChevronRight aria-hidden />
          </Link>
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
      toast.error("Couldn't save your rating", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (rated) {
    return (
      <Surface className="flex items-center gap-3.5 p-4 sm:p-5">
        <div className="flex gap-0.5" aria-label={`You rated ${rated} out of 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={cn("size-5", i <= rated ? "fill-foreground text-foreground" : "text-border")} aria-hidden />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Thanks for rating your visit</p>
          {booking.rating?.comment && <p className="truncate text-[13px] text-muted-foreground">&ldquo;{booking.rating.comment}&rdquo;</p>}
        </div>
      </Surface>
    );
  }

  const shown = hover || score;
  const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
  return (
    <Surface className="p-4 sm:p-5">
      <p className="text-sm font-semibold">How was your visit{nurse ? ` with ${firstName(nurse.name)}` : ""}?</p>
      <p className="text-[13px] text-muted-foreground">Your rating helps our nurses and doctors.</p>
      <div className="mt-3 flex items-center gap-3">
        <div role="radiogroup" aria-label="Rating" className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={score === i}
              aria-label={`${i} star${i === 1 ? "" : "s"}`}
              onClick={() => setScore(i)}
              onMouseEnter={() => setHover(i)}
              className="grid size-10 place-items-center rounded-full transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-95"
            >
              <Star
                className={cn("size-7 transition-colors", i <= shown ? "fill-foreground text-foreground" : "text-input")}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
          ))}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{LABELS[shown]}</span>
      </div>
      {score > 0 && (
        <div className="mt-3 animate-fade-up space-y-3">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything you'd like to share? (optional)"
            rows={2}
            maxLength={1000}
            className="rounded-xl bg-card px-3.5 py-2.5 text-[15px] md:text-[15px]"
          />
          <Button onClick={submit} disabled={saving} className="h-11 w-full rounded-xl font-semibold">
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
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {entry?.note || "No visit will take place."}
            {entry?.at ? ` · ${formatDateTime(entry.at)}` : ""}
          </p>
          {booking.payment.method && refunded && (
            <p className="mt-2 text-[13px] text-muted-foreground">
              Any amount paid is refunded to your original payment method in 3 to 5 working days.
            </p>
          )}
        </div>
      </div>
      <Link href="/app/book" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 h-11 w-full rounded-xl")}>
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
              <p className="text-[11px] font-medium text-muted-foreground">{role}</p>
              <p className="truncate text-[13px] font-semibold">{p.name}</p>
            </div>
          </div>
        ) : (
          <div key={role} />
        ),
      )}
    </Surface>
  );
}

function DetailsAccordion({ booking }: { booking: Booking }) {
  const { catalog } = useCatalog();
  const services = serviceMap(catalog);
  const a = booking.address;
  return (
    <Surface className="px-4 sm:px-5">
      <Accordion>
        <AccordionItem value="tests">
          <AccordionTrigger className="py-4 text-[15px] font-semibold hover:no-underline">
            Tests ({booking.serviceCodes.length})
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2.5 pb-2">
              {booking.serviceCodes.map((c) => {
                const Icon = serviceIcon(c);
                return (
                  <li key={c} className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg border border-border bg-card text-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm">{services[c]?.name ?? c}</span>
                  </li>
                );
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="patient">
          <AccordionTrigger className="py-4 text-[15px] font-semibold hover:no-underline">Patient</AccordionTrigger>
          <AccordionContent>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 pb-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{booking.patient.name}</dd>
              <dt className="text-muted-foreground">Age, gender</dt>
              <dd>
                {booking.patient.age} yrs, {GENDER_LABEL[booking.patient.gender] ?? booking.patient.gender}
              </dd>
              <dt className="text-muted-foreground">Relation</dt>
              <dd>{RELATION_LABEL[booking.patient.relation] ?? booking.patient.relation}</dd>
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
          <AccordionTrigger className="py-4 text-[15px] font-semibold hover:no-underline">Address</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-start gap-3 pb-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="text-sm leading-relaxed">
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
          <AccordionTrigger className="py-4 text-[15px] font-semibold hover:no-underline">Payment</AccordionTrigger>
          <AccordionContent>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 pb-2 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="tabular font-semibold">{formatINR(booking.amount)}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{booking.payment.status === "paid" ? "Paid" : booking.payment.status}</dd>
              {booking.payment.method && (
                <>
                  <dt className="text-muted-foreground">Method</dt>
                  <dd>{METHOD_LABEL[booking.payment.method]}</dd>
                </>
              )}
              {booking.payment.txnId && (
                <>
                  <dt className="text-muted-foreground">Transaction</dt>
                  <dd className="tabular font-mono text-xs leading-5 break-all">{booking.payment.txnId}</dd>
                </>
              )}
              {booking.payment.paidAt && (
                <>
                  <dt className="text-muted-foreground">Paid on</dt>
                  <dd>{formatDateTime(booking.payment.paidAt)}</dd>
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Surface>
  );
}

function CancelBooking({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      const { booking: next } = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/cancel`, {
        reason: reason.trim() || undefined,
      });
      setBooking(next);
      setOpen(false);
      toast("Booking cancelled", { description: `${next.code} has been cancelled.` });
    } catch (err) {
      toast.error("Couldn't cancel", { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => setOpen(true)} className="h-10 rounded-full px-4 text-muted-foreground hover:text-destructive">
          Cancel booking
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Cancel this booking?</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {booking.code} · {dayLabel(booking.scheduledDate)}, {slotLabel(booking.slot)}.{" "}
              {booking.payment.status === "paid"
                ? `${formatINR(booking.amount)} will be refunded to your ${METHOD_LABEL[booking.payment.method ?? "upi"]} in 3 to 5 working days.`
                : "No payment has been taken."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={2}
            maxLength={500}
            className="rounded-xl px-3.5 py-2.5 text-[15px] md:text-[15px]"
          />
          <DialogFooter className="-mx-5 -mb-5 gap-2 rounded-b-2xl border-t bg-muted/40 p-4 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="h-11 w-full rounded-xl sm:w-auto sm:flex-1">
              Keep booking
            </Button>
            <Button
              onClick={cancel}
              disabled={busy}
              className="h-11 w-full rounded-xl sm:w-auto sm:flex-1 bg-destructive text-white hover:bg-destructive/90"
            >
              {busy && <LoaderCircle className="animate-spin" aria-hidden />} Yes, cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

