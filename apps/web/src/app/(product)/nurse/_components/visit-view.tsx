"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheckBig,
  Clock,
  ExternalLink,
  House,
  ListChecks,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Plus,
  RotateCw,
  Route,
  Video,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { LiveMap, VideoCall, etaMinutes, formatDistance, haversineKm } from "@/components/live";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-menu";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { demoMode } from "@/lib/features";
import { EXPRESS_SLOT, firstName, formatPhone, formatTime, scheduleLabel, vitalAssessment } from "@/lib/format";
import { phoneDigits } from "@/lib/phone";
import { useBooking, useSignalling, useSocketConnected } from "@/lib/socket";
import { populated, type Booking, type BookingStatus, type DeviceKind, type ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeviceCard } from "./device-card";
import { TestChips } from "./visit-bits";
import {
  TEST_META,
  addressLine,
  ageGender,
  bookedBy,
  mapsDirectionsUrl,
  nurseTests,
  testDone,
} from "./visit-utils";
import { useLocationSharing, type LocationSharing } from "./use-location-sharing";
import { VitalsPanel, hasOptionalVitals, optionalVitalNames } from "./vitals-panel";

/* ------------------------------------------------------------------------- */
/* Small building blocks                                                     */
/* ------------------------------------------------------------------------- */

const STEPS: { label: string; statuses: BookingStatus[] }[] = [
  { label: "Trip", statuses: ["assigned", "en_route"] },
  { label: "Arrive", statuses: ["arrived"] },
  { label: "Tests", statuses: ["testing"] },
  { label: "Consult", statuses: ["consult"] },
  { label: "Done", statuses: ["reporting", "completed"] },
];

/** Read out when the visit moves on, for screen-reader and switch users. */
const STEP_ANNOUNCEMENT: Partial<Record<BookingStatus, string>> = {
  en_route: "Step 1 of 5: on the way",
  arrived: "Step 2 of 5: arrived",
  testing: "Step 3 of 5: tests",
  consult: "Step 4 of 5: doctor consult",
  reporting: "Step 5 of 5: visit complete",
  completed: "Visit complete. The report is published.",
  cancelled: "This visit was cancelled",
};

/** After a step changes, the next step's button sits under the same thumb: hold it this long. */
const STEP_GUARD_MS = 800;
/** "I've arrived" further than this from the home (or with no location) asks once before telling the family. */
const ARRIVE_CHECK_KM = 0.3;

function NurseProgress({ status }: { status: BookingStatus }) {
  const current = STEPS.findIndex((s) => s.statuses.includes(status));
  if (current < 0) return null;
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Visit progress">
      {STEPS.map((s, i) => {
        const state = i < current || status === "completed" ? "done" : i === current ? "current" : "upcoming";
        return (
          <li key={s.label} className="flex flex-col gap-1.5" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "h-1.5 rounded-full",
                state === "done" && "bg-foreground",
                state === "current" && "bg-foreground/50",
                state === "upcoming" && "bg-border",
              )}
            />
            <span
              className={cn(
                "text-[11px] font-medium",
                state === "current" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
            {icon}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <h2 className="text-[13px] font-medium text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

/** Fixed bottom bar holding the step's single primary action. */
function ActionBar({ hint, step, children }: { hint?: ReactNode; step: string; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 backdrop-blur-md lg:left-64">
      {/* Keyed by step so the new action fades in rather than swapping under the thumb. */}
      <div
        key={step}
        className="mx-auto flex max-w-2xl animate-in flex-col gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] duration-200 fade-in md:px-6 lg:px-8"
      >
        {hint && <div className="text-center text-xs text-muted-foreground">{hint}</div>}
        {children}
      </div>
    </div>
  );
}

const primaryCta = "h-13 w-full rounded-xl text-base font-semibold [&_svg:not([class*='size-'])]:size-5";
const dialogPrimary = "h-12 w-full rounded-xl text-base font-semibold";
const dialogSecondary = "h-12 w-full rounded-xl text-base";

/* ------------------------------------------------------------------------- */
/* Header                                                                    */
/* ------------------------------------------------------------------------- */

function VisitHeader({ booking, headingRef }: { booking: Booking; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const phone = populated(booking.customer)?.phone;
  const booker = bookedBy(booking);
  const { lat, lng } = booking.address;
  // Once at the patient's home the address and directions are no longer needed.
  const compact = !["assigned", "en_route", "arrived"].includes(booking.status);
  const digits = phone ? phoneDigits(phone) : "";
  const tel = digits.length === 10 ? `tel:+91${digits}` : null;
  // The number on a booking is the account holder's: say who answers when that is not the patient.
  const callLabel = booker ? `Call ${firstName(booker.name)}` : "Call patient";
  const callAria = booker
    ? `Call ${booker.name}, who booked this visit, on ${formatPhone(phone)}`
    : `Call patient on ${formatPhone(phone)}`;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/nurse"
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ArrowLeft className="size-4" /> Today
        </Link>
        <StatusBadge status={booking.status} audience="staff" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-[1.75rem] leading-tight font-medium tracking-tight outline-none"
          >
            {booking.patient.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{booking.code}</span>
            <span aria-hidden>·</span>
            <span>{ageGender(booking.patient)}</span>
          </p>
          {booker && (
            <p className="mt-1 text-sm text-muted-foreground">
              Booked by <span className="font-medium text-foreground">{booker.name}</span> {booker.forWhom}
            </p>
          )}
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
            {booking.slot === EXPRESS_SLOT ? (
              <Zap className="size-4 fill-current text-foreground" aria-hidden />
            ) : (
              <Clock className="size-4 text-muted-foreground" aria-hidden />
            )}
            {scheduleLabel(booking.scheduledDate, booking.slot)}
          </p>
        </div>
        {compact && tel && (
          <a
            href={tel}
            aria-label={callAria}
            className={cn(buttonVariants({ variant: "outline" }), "mt-1 size-11 shrink-0 rounded-full")}
          >
            <Phone className="size-[18px]" />
          </a>
        )}
      </div>

      {!compact && (
        <>
          <div className="flex items-start gap-2.5 rounded-xl bg-muted/60 px-3.5 py-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm leading-snug">
              <span className="font-medium">{booking.address.label || "Home"}</span>
              <span className="text-muted-foreground"> · {addressLine(booking.address)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {tel ? (
              <a
                href={tel}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 min-w-0 rounded-xl px-3 text-sm font-semibold",
                )}
                aria-label={callAria}
              >
                <Phone className="size-4" /> <span className="truncate">{callLabel}</span>
              </a>
            ) : (
              <Button variant="outline" size="lg" disabled className="h-11 rounded-xl px-3 text-sm font-semibold">
                <Phone className="size-4" /> No phone number
              </Button>
            )}
            <a
              href={mapsDirectionsUrl(lat, lng)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-xl px-3 text-sm font-semibold")}
            >
              <Navigation className="size-4" /> Directions
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="sr-only">(opens Google Maps)</span>
            </a>
          </div>
        </>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------------- */
/* Steps                                                                     */
/* ------------------------------------------------------------------------- */

function DoctorCard({ booking }: { booking: Booking }) {
  const doctor = populated(booking.doctor);
  if (!doctor) return null;
  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={doctor.name} src={doctor.avatarUrl} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{doctor.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[doctor.specialization, doctor.yearsExperience ? `${doctor.yearsExperience} yrs` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {doctor.qualifications && <p className="truncate text-xs text-muted-foreground">{doctor.qualifications}</p>}
      </div>
    </div>
  );
}

/** What to pack and what the patient said: read before setting off, so it comes before the map. */
function VisitBrief({ booking }: { booking: Booking }) {
  return (
    <>
      <Panel title="Tests to perform" icon={<ListChecks />}>
        <TestChips codes={booking.serviceCodes} />
      </Panel>
      <Panel title="Patient notes" icon={<MessageSquareText />}>
        {booking.notes ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{booking.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes from the patient.</p>
        )}
      </Panel>
    </>
  );
}

function ReviewingDoctor({ booking }: { booking: Booking }) {
  if (!populated(booking.doctor)) return null;
  return (
    <Panel title="Reviewing doctor">
      <DoctorCard booking={booking} />
    </Panel>
  );
}

/** Demo aid: drives the nurse to the patient in 45 seconds. Never shown outside demo mode. */
function DemoDriveToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-card px-3.5 py-3">
      <Route className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          Simulate drive
          <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">Demo</span>
        </span>
        <span className="block text-xs text-muted-foreground">Drives to the patient in 45 seconds</span>
      </span>
      <Switch checked={on} onCheckedChange={(v) => onChange(Boolean(v))} aria-label="Simulate drive (demo)" />
    </label>
  );
}

function StatusLine({ tone, children }: { tone?: "live" | "warn"; children: ReactNode }) {
  return (
    <span className="flex items-start gap-2">
      {tone === "live" && <span className="live-dot mt-1.5 size-1.5 shrink-0 text-signal" aria-hidden />}
      {tone === "warn" && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-saffron" aria-hidden />}
      <span>{children}</span>
    </span>
  );
}

function TripPanel({
  booking,
  sharing,
  nurseName,
  family,
}: {
  booking: Booking;
  sharing: LocationSharing;
  nurseName?: string;
  /** Who is told about the trip: the patient's first name, or "the family" when someone else booked. */
  family: string;
}) {
  const connected = useSocketConnected();
  const enRoute = booking.status === "en_route";
  const home = {
    lat: booking.address.lat,
    lng: booking.address.lng,
    label: booking.patient.name,
  };
  const patientFirst = firstName(booking.patient.name);
  // Before the trip: distance from the last known point (or the hub). On the way: this trip's fixes only.
  const pos = enRoute ? sharing.live : sharing.position;
  const km = pos ? haversineKm(pos, home) : null;
  const reached = enRoute && (sharing.reached || (km !== null && km < 0.08));
  const withoutMap = `${family.charAt(0).toUpperCase()}${family.slice(1)} sees that you are on the way, without the map.`;

  let line: ReactNode;
  if (!enRoute) {
    line =
      km !== null ? (
        <span className="tabular-nums">
          {formatDistance(km)} away · about {etaMinutes(km)} min drive
        </span>
      ) : (
        "Location sharing starts when you start the trip"
      );
  } else if (reached) {
    line = (
      <span className="flex items-center gap-2.5 rounded-xl bg-muted px-3 py-2.5 font-medium text-foreground ring-1 ring-border ring-inset">
        <CircleCheckBig className="size-4 shrink-0 text-success" aria-hidden />
        You have reached {patientFirst}&apos;s home. Tap I&apos;ve arrived.
      </span>
    );
  } else if (sharing.sharing && !connected) {
    line = <StatusLine tone="warn">Can&apos;t share your location right now. Reconnecting...</StatusLine>;
  } else if (sharing.sharing) {
    line = (
      <span className="flex flex-col gap-1">
        <StatusLine tone="live">Sharing live location with {family}</StatusLine>
        {km !== null && (
          <span className="pl-3.5 font-medium text-foreground tabular-nums">
            {etaMinutes(km)} min away · {formatDistance(km)} to {patientFirst}&apos;s home
          </span>
        )}
      </span>
    );
  } else if (sharing.gps === "off" || sharing.consent === null) {
    line = (
      <span className="flex flex-col items-start gap-2.5">
        <span>Your location is not shared on this trip. {withoutMap}</span>
        <Button
          variant="outline"
          className="h-11 rounded-xl px-4 text-sm font-semibold"
          onClick={() => sharing.setConsent(true)}
        >
          <Navigation /> Share my location
        </Button>
      </span>
    );
  } else if (sharing.gps === "locating" || sharing.gps === "idle") {
    line = (
      <span className="flex items-center gap-2">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Finding your location...
      </span>
    );
  } else if (sharing.gps === "denied") {
    line = (
      <StatusLine tone="warn">
        Location is off for Nivar. {withoutMap} To share it, allow location for this site in your browser settings.
      </StatusLine>
    );
  } else if (demoMode) {
    line = (
      <StatusLine tone="warn">
        Your location is not available. Turn on Simulate drive, or allow location for this site in your browser
        settings.
      </StatusLine>
    );
  } else {
    line = (
      <StatusLine tone="warn">
        Can&apos;t find your location yet. {withoutMap} We keep trying while this page is open.
      </StatusLine>
    );
  }

  return (
    <Panel
      title={enRoute ? "On the way" : "Trip"}
      icon={<Navigation />}
      action={
        enRoute && sharing.simulate && !sharing.reached ? (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {Math.round(sharing.progress * 100)}%
          </span>
        ) : undefined
      }
    >
      {/* The map's own chip speaks about the nurse in the third person; this screen has its own line. */}
      <LiveMap
        home={home}
        nurse={pos}
        nurseName={nurseName}
        height={enRoute ? 300 : 220}
        showEta={false}
        touchScrollsPage
      />
      <div role="status" className="text-sm text-muted-foreground">
        {line}
      </div>
      {enRoute && sharing.simulate && !reached && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(sharing.progress * 100)}%` }}
          />
        </div>
      )}
      {demoMode && <DemoDriveToggle on={sharing.simulate} onChange={sharing.setSimulate} />}
    </Panel>
  );
}

const PREP = [
  "Introduce yourself and confirm the patient's name",
  "Sanitise hands and wear gloves",
  "Patient seated and rested for 5 minutes",
];
const DEVICE_PREP = "Smart ECG and stethoscope charged and nearby";

const isDevice = (code: ServiceCode) => code === "ECG" || code === "STETH";

function ArrivedPanel({ booking }: { booking: Booking }) {
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const tests = nurseTests(booking.serviceCodes);
  const prep = tests.some(isDevice) ? [...PREP, DEVICE_PREP] : PREP;
  return (
    <>
      <Panel title="Before you begin" icon={<ListChecks />}>
        <ul className="flex flex-col gap-1">
          {prep.map((item, i) => {
            const on = ticked.has(i);
            return (
              <li key={item}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTicked((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left text-sm transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className={cn(on && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                    {item}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title={`Tests to perform (${tests.length})`} icon={<Activity />}>
        <ul className="flex flex-col divide-y divide-border">
          {tests.map((code) => {
            const meta = TEST_META[code];
            const Icon = meta.icon;
            return (
              <li key={code} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium">{meta.label}</span>
                {isDevice(code) && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10.5px] font-medium text-background">
                    Smart device
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      {booking.notes && (
        <Panel title="Patient notes" icon={<MessageSquareText />}>
          <p className="text-sm leading-relaxed whitespace-pre-line">{booking.notes}</p>
        </Panel>
      )}
    </>
  );
}

function ReadinessPanel({ booking }: { booking: Booking }) {
  const tests = nurseTests(booking.serviceCodes);
  const done = tests.filter((c) => testDone(booking, c)).length;
  return (
    <Panel
      title="Readings"
      icon={<ListChecks />}
      action={
        <span className="text-xs font-semibold tabular-nums">
          <span className={done === tests.length ? "text-success" : "text-foreground"}>{done}</span>
          <span className="text-muted-foreground"> of {tests.length} done</span>
        </span>
      }
    >
      <ul className="flex flex-wrap gap-1.5">
        {tests.map((code) => {
          const ok = testDone(booking, code);
          return (
            <li
              key={code}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
                ok
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-background text-muted-foreground ring-border",
              )}
            >
              {ok ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : (
                <span className="size-1.5 rounded-full bg-border" />
              )}
              {TEST_META[code].short}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

const DEVICE_NAME: Record<DeviceKind, string> = { ecg: "Smart ECG", stethoscope: "Smart stethoscope" };

/**
 * Readings that were not booked, behind one row so the booked ones come first. Closed, its cards stay
 * mounted (hidden), so a device streaming from in here keeps streaming to the doctor.
 */
function AddReadings({ booking, devices, children }: { booking: Booking; devices: DeviceKind[]; children: ReactNode }) {
  const [open, setOpen] = useState(
    () =>
      hasOptionalVitals(booking) ||
      devices.some((d) => (d === "ecg" ? booking.ecg?.capturedAt : booking.stethoscope?.capturedAt)),
  );
  const names = [...optionalVitalNames(booking), ...devices.map((d) => DEVICE_NAME[d])];
  if (names.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="add-readings"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-input bg-card px-4 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
          <Plus className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Add another reading</span>
          <span className="block text-xs text-muted-foreground">{names.join(", ")}</span>
        </span>
        <ChevronDown
          className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div id="add-readings" hidden={!open} className="flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}

function Workspace({
  booking,
  setBooking,
  inCall,
  onLeaveCall,
  onFinish,
  onFailedChange,
}: {
  booking: Booking;
  setBooking: (b: Booking) => void;
  inCall: boolean;
  onLeaveCall: () => void;
  onFinish: () => void;
  onFailedChange: (title: string, failed: boolean) => void;
}) {
  const { user } = useAuth();
  const signalling = useSignalling();
  const doctor = populated(booking.doctor);
  const consult = booking.status === "consult";
  const hr = booking.vitals?.heartRate ?? null;
  const bookedDevice = (k: DeviceKind) => booking.serviceCodes.includes(k === "ecg" ? "ECG" : "STETH");
  const devices: DeviceKind[] = ["ecg", "stethoscope"];
  const booked = devices.filter(bookedDevice);
  const extra = devices.filter((k) => !bookedDevice(k));
  const hasBookedVitals = nurseTests(booking.serviceCodes).some((c) => !isDevice(c));

  const deviceCard = (kind: DeviceKind) => (
    <DeviceCard
      key={kind}
      kind={kind}
      booking={booking}
      booked={bookedDevice(kind)}
      doctorName={doctor?.name}
      heartRateHint={hr}
      onSaved={setBooking}
    />
  );

  return (
    <>
      {consult ? (
        <Panel title="Doctor consult" icon={<Video />} className="border-foreground">
          <DoctorCard booking={booking} />
          {/* The app cannot know whether the doctor is watching yet: say only what was done. */}
          <p className="text-sm text-muted-foreground">
            {doctor?.name ?? "The doctor"} has been told that {firstName(booking.patient.name)} is ready. Join the
            video call and keep the devices streaming.
          </p>
          {inCall && signalling && user && (
            <VideoCall
              signalling={signalling}
              bookingId={booking.id}
              self={{ name: user.name, role: "nurse" }}
              onLeave={onLeaveCall}
              compact
            />
          )}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">When the doctor has ended the consult:</p>
            <Button variant="outline" className="h-12 w-full rounded-xl text-base font-semibold" onClick={onFinish}>
              <CircleCheckBig className="size-5" /> Finish visit
            </Button>
          </div>
        </Panel>
      ) : (
        <ReadinessPanel booking={booking} />
      )}

      {hasBookedVitals && <SectionHeading>Vitals</SectionHeading>}
      <VitalsPanel booking={booking} onSaved={setBooking} group="booked" onFailedChange={onFailedChange} />

      {booked.length > 0 && (
        <>
          <SectionHeading aside={<span className="text-xs text-muted-foreground">Streams live to the doctor</span>}>
            Smart devices
          </SectionHeading>
          {booked.map(deviceCard)}
        </>
      )}

      <AddReadings booking={booking} devices={extra}>
        <VitalsPanel booking={booking} onSaved={setBooking} group="optional" onFailedChange={onFailedChange} />
        {extra.map(deviceCard)}
      </AddReadings>
    </>
  );
}

function SummaryRow({ label, value, flag }: { label: string; value: string; flag?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium tabular-nums">
        {value}
        {flag && flag !== "Normal" && (
          <span className="rounded-full bg-background px-1.5 py-px text-[10px] font-medium text-saffron ring-1 ring-saffron/35 ring-inset">
            {flag}
          </span>
        )}
      </span>
    </div>
  );
}

function DonePanel({ booking }: { booking: Booking }) {
  const v = booking.vitals ?? {};
  const doctor = populated(booking.doctor);
  const rows: { label: string; value: string; flag?: string | null }[] = [];
  if (v.bpSystolic != null && v.bpDiastolic != null)
    rows.push({
      label: "Blood pressure",
      value: `${v.bpSystolic}/${v.bpDiastolic} mmHg`,
      flag: vitalAssessment("bp", {
        systolic: v.bpSystolic,
        diastolic: v.bpDiastolic,
      }).label,
    });
  if (v.sugar != null)
    rows.push({
      label: "Blood sugar",
      value: `${v.sugar} mg/dL`,
      flag: vitalAssessment("sugar", v.sugar, { sugarType: v.sugarType }).label,
    });
  if (v.heartRate != null)
    rows.push({
      label: "Heart rate",
      value: `${v.heartRate} bpm`,
      flag: vitalAssessment("heartRate", v.heartRate).label,
    });
  if (v.spo2 != null)
    rows.push({
      label: "Oxygen (SpO2)",
      value: `${v.spo2}%`,
      flag: vitalAssessment("spo2", v.spo2).label,
    });
  if (v.temperatureF != null)
    rows.push({
      label: "Temperature",
      value: `${v.temperatureF} °F`,
      flag: vitalAssessment("temperature", v.temperatureF).label,
    });
  if (v.weightKg != null) rows.push({ label: "Weight", value: `${v.weightKg} kg` });
  if (booking.ecg)
    rows.push({
      label: "ECG",
      value: `${Math.round(booking.ecg.heartRate)} bpm, ${booking.ecg.rhythm}`,
    });
  if (booking.stethoscope) rows.push({ label: "Stethoscope", value: booking.stethoscope.findings });

  const completed = booking.status === "completed";
  const lastNurseStep = [...booking.timeline].reverse().find((t) => t.status === "consult" || t.status === "reporting");

  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-8 text-center">
        <span className="relative flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-signal/20 [animation-iteration-count:2]" />
          <span className="relative flex size-16 items-center justify-center rounded-full bg-foreground text-background">
            <CircleCheckBig className="size-8 text-signal" />
          </span>
        </span>
        <h2 className="font-display text-2xl">Visit complete</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          {completed
            ? `${doctor?.name ?? "The doctor"} has published ${firstName(booking.patient.name)}'s report.`
            : `${doctor?.name ?? "The doctor"} is preparing ${firstName(booking.patient.name)}'s report. Great work.`}
        </p>
        {lastNurseStep && <p className="text-xs text-muted-foreground">Finished {formatTime(lastNurseStep.at)}</p>}
      </section>
      {rows.length > 0 && (
        <Panel title="Readings recorded" icon={<ListChecks />}>
          <div className="flex flex-col divide-y divide-border">
            {rows.map((r) => (
              <SummaryRow key={r.label} {...r} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------- */
/* Screen                                                                    */
/* ------------------------------------------------------------------------- */

function missingTests(booking: Booking): ServiceCode[] {
  return nurseTests(booking.serviceCodes).filter((c) => !testDone(booking, c));
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

type Confirm = "share" | "arrive" | "consult" | "finish";

function VisitScreen({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const { user } = useAuth();
  const [pending, setPending] = useState<BookingStatus | null>(null);
  const [cooling, setCooling] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [inCall, setInCall] = useState(false);
  const [unsaved, setUnsaved] = useState<string[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const coolTimer = useRef<number | null>(null);
  const status = booking.status;
  const booker = bookedBy(booking);
  const patientFirst = firstName(booking.patient.name);
  const family = booker ? "the family" : patientFirst;

  const home = { lat: booking.address.lat, lng: booking.address.lng };
  const from = booking.nurseLocation?.lat != null ? booking.nurseLocation : (user?.baseLocation ?? null);
  const sharing = useLocationSharing({
    bookingId: booking.id,
    active: status === "en_route",
    from,
    to: home,
  });

  useEffect(
    () => () => {
      if (coolTimer.current) window.clearTimeout(coolTimer.current);
    },
    [],
  );

  const onFailedChange = useCallback((title: string, failed: boolean) => {
    setUnsaved((prev) => {
      if (failed) return prev.includes(title) ? prev : [...prev, title];
      return prev.includes(title) ? prev.filter((t) => t !== title) : prev;
    });
  }, []);

  const advance = useCallback(
    async (to: BookingStatus) => {
      setPending(to);
      try {
        const res = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/status`, { status: to });
        setBooking(res.booking);
        // Each step tells the family and cannot be undone: a second tap must not land on the next one.
        setCooling(true);
        if (coolTimer.current) window.clearTimeout(coolTimer.current);
        coolTimer.current = window.setTimeout(() => setCooling(false), STEP_GUARD_MS);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        headingRef.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't update the visit."));
      } finally {
        setPending(null);
      }
    },
    [booking.id, setBooking],
  );

  const startTrip = () => {
    // Real use asks once before the browser's own location prompt; demo mode and an already
    // allowed (or blocked) site go straight on.
    const canAsk = typeof navigator !== "undefined" && "geolocation" in navigator;
    if (!demoMode && canAsk && sharing.consent === null && sharing.permission !== "denied") setConfirm("share");
    else void advance("en_route");
  };

  const liveKm = sharing.live ? haversineKm(sharing.live, home) : null;
  const arrive = () => {
    if (liveKm !== null && liveKm <= ARRIVE_CHECK_KM) void advance("arrived");
    else setConfirm("arrive");
  };

  const missing = missingTests(booking);
  const busy = pending !== null || cooling;
  const spinner = pending !== null ? <LoaderCircle className="animate-spin" /> : null;
  const unsavedHint =
    unsaved.length > 0 ? (
      <span className="font-medium text-danger">{plural(unsaved.length, "reading")} not saved yet</span>
    ) : null;

  let bar: ReactNode = null;
  switch (status) {
    case "assigned":
      bar = (
        <ActionBar
          step={status}
          hint={!demoMode && sharing.permission === "denied" ? undefined : `Shares your live location with ${booker ? "the family" : "the patient"}`}
        >
          <Button className={primaryCta} disabled={busy} onClick={startTrip}>
            {spinner ?? <Navigation />} Start trip
          </Button>
        </ActionBar>
      );
      break;
    case "en_route":
      bar = (
        <ActionBar step={status}>
          <Button className={primaryCta} disabled={busy} onClick={arrive}>
            {spinner ?? <House />} I&apos;ve arrived
          </Button>
        </ActionBar>
      );
      break;
    case "arrived":
      bar = (
        <ActionBar step={status}>
          <Button className={primaryCta} disabled={busy} onClick={() => void advance("testing")}>
            {spinner ?? <ArrowRight />} Begin tests
          </Button>
        </ActionBar>
      );
      break;
    case "testing":
      bar = (
        <ActionBar
          step={status}
          hint={
            unsavedHint ??
            (missing.length === 0 ? (
              <span className="font-medium text-success">All readings saved</span>
            ) : (
              `${plural(missing.length, "reading")} left: ${missing.map((c) => TEST_META[c].short).join(", ")}`
            ))
          }
        >
          <Button
            className={primaryCta}
            disabled={busy}
            onClick={() => (missing.length || unsaved.length ? setConfirm("consult") : void advance("consult"))}
          >
            {spinner ?? <Video />} Start doctor consult
          </Button>
        </ActionBar>
      );
      break;
    case "consult":
      bar = inCall ? null : (
        <ActionBar step={status} hint={unsavedHint ?? undefined}>
          <Button className={primaryCta} disabled={busy} onClick={() => setInCall(true)}>
            <Video /> Join video call
          </Button>
        </ActionBar>
      );
      break;
    default:
      bar = (
        <ActionBar step={status}>
          <Link href="/nurse" className={cn(buttonVariants({ size: "lg" }), primaryCta)}>
            <ArrowLeft /> Back to Today
          </Link>
        </ActionBar>
      );
  }

  const workspace = status === "testing" || status === "consult";
  const done = status === "reporting" || status === "completed";

  let dialog: ReactNode = null;
  if (confirm === "share") {
    dialog = (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Share your location for this trip?</DialogTitle>
          <DialogDescription>
            {booker ? "The family sees" : `${patientFirst} sees`} where you are while you are on the way. Sharing
            stops when you arrive.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 flex-col gap-2 p-5 sm:flex-col">
          <Button
            className={dialogPrimary}
            onClick={() => {
              setConfirm(null);
              sharing.setConsent(true);
              void advance("en_route");
            }}
          >
            Share and start trip
          </Button>
          <Button
            variant="outline"
            className={dialogSecondary}
            onClick={() => {
              setConfirm(null);
              sharing.setConsent(false);
              void advance("en_route");
            }}
          >
            Start without sharing
          </Button>
        </DialogFooter>
      </>
    );
  } else if (confirm === "arrive") {
    dialog = (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Mark as arrived?</DialogTitle>
          <DialogDescription>
            {liveKm !== null
              ? `Your phone shows you about ${formatDistance(liveKm)} from ${patientFirst}'s home.`
              : "We can't see your location right now."}{" "}
            We tell {family} as soon as you mark yourself arrived.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 flex-col gap-2 p-5 sm:flex-col">
          <Button
            className={dialogPrimary}
            onClick={() => {
              setConfirm(null);
              void advance("arrived");
            }}
          >
            Yes, I&apos;m at the door
          </Button>
          <DialogClose render={<Button variant="outline" className={dialogSecondary} />}>Not yet</DialogClose>
        </DialogFooter>
      </>
    );
  } else if (confirm === "consult") {
    dialog = (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Start consult without all readings?</DialogTitle>
          <DialogDescription>
            {unsaved.length > 0 && <>Not saved: {unsaved.join(", ")}. </>}
            {missing.length > 0 && <>Still missing: {missing.map((c) => TEST_META[c].label).join(", ")}. </>}
            You can keep recording during the consult.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 flex-col gap-2 p-5 sm:flex-col">
          <Button
            className={dialogPrimary}
            onClick={() => {
              setConfirm(null);
              void advance("consult");
            }}
          >
            Start consult anyway
          </Button>
          <DialogClose render={<Button variant="outline" className={dialogSecondary} />}>Keep testing</DialogClose>
        </DialogFooter>
      </>
    );
  } else if (confirm === "finish") {
    dialog = (
      <>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Finish this visit?</DialogTitle>
          <DialogDescription>
            Do this once the doctor has ended the consult. You can&apos;t add readings after this, and the doctor will
            prepare the report.
          </DialogDescription>
        </DialogHeader>
        {unsaved.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-danger/5 px-3 py-2.5 text-sm ring-1 ring-danger/25 ring-inset">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <span>
              <span className="font-semibold text-danger">Not saved yet: {unsaved.join(", ")}.</span> Use Try again on
              the reading first, or it will be lost.
            </span>
          </p>
        )}
        <DialogFooter className="-mx-5 -mb-5 flex-col gap-2 p-5 sm:flex-col">
          <Button
            className={dialogPrimary}
            onClick={() => {
              setConfirm(null);
              setInCall(false);
              void advance("reporting");
            }}
          >
            Finish visit
          </Button>
          <DialogClose render={<Button variant="outline" className={dialogSecondary} />}>Not yet</DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <VisitHeader booking={booking} headingRef={headingRef} />
      <NurseProgress status={status} />
      <p role="status" className="sr-only">
        {STEP_ANNOUNCEMENT[status] ?? ""}
      </p>

      {status === "assigned" && <VisitBrief booking={booking} />}
      {(status === "assigned" || status === "en_route") && (
        <TripPanel booking={booking} sharing={sharing} nurseName={user?.name} family={family} />
      )}
      {status === "assigned" && <ReviewingDoctor booking={booking} />}
      {status === "arrived" && <ArrivedPanel booking={booking} />}
      {workspace && (
        <Workspace
          booking={booking}
          setBooking={setBooking}
          inCall={inCall}
          onLeaveCall={() => setInCall(false)}
          onFinish={() => setConfirm("finish")}
          onFailedChange={onFailedChange}
        />
      )}
      {done && <DonePanel booking={booking} />}
      {status === "cancelled" && (
        <Panel>
          <p className="text-sm text-muted-foreground">This visit was cancelled. No action is needed.</p>
        </Panel>
      )}

      {bar}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="gap-5 p-5">{dialog}</DialogContent>
      </Dialog>
    </div>
  );
}

export function VisitView({ bookingId }: { bookingId: string }) {
  const { booking, setBooking, loading, error, errorStatus, reload } = useBooking(bookingId);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    );
  }

  if (!booking) {
    const notFound = errorStatus === 404;
    const notMine = errorStatus === 403;
    const title = notFound
      ? "We couldn't find this visit"
      : notMine
        ? "This visit is assigned to another nurse"
        : "Couldn't load this visit";
    const body = notFound
      ? "It may have been cancelled or given to another nurse. Your current visits are on Today."
      : notMine
        ? "Your current visits are on Today."
        : error;
    const back = (
      <Link
        href="/nurse"
        className={cn(
          buttonVariants({ variant: notFound || notMine ? "default" : "outline", size: "lg" }),
          "h-11 rounded-xl px-5 font-semibold",
        )}
      >
        <ArrowLeft /> Back to Today
      </Link>
    );
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {!notFound && !notMine && (
            <Button size="lg" className="h-11 rounded-xl px-5 font-semibold" onClick={reload}>
              <RotateCw /> Try again
            </Button>
          )}
          {back}
        </div>
      </div>
    );
  }

  return <VisitScreen booking={booking} setBooking={setBooking} />;
}
