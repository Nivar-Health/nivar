"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
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
import { EXPRESS_SLOT, firstName, formatPhone, formatTime, scheduleLabel, vitalAssessment } from "@/lib/format";
import { useBooking, useSignalling } from "@/lib/socket";
import { populated, type Booking, type BookingStatus, type ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeviceCard } from "./device-card";
import { TestChips } from "./visit-bits";
import { TEST_META, addressLine, ageGender, mapsDirectionsUrl, nurseTests, testDone } from "./visit-utils";
import { useLocationSharing } from "./use-location-sharing";
import { VitalsPanel } from "./vitals-panel";

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
function ActionBar({ hint, children }: { hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 backdrop-blur-md lg:left-64">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 lg:px-8">
        {hint && <div className="text-center text-xs text-muted-foreground">{hint}</div>}
        {children}
      </div>
    </div>
  );
}

const primaryCta = "h-13 w-full rounded-xl text-base font-semibold [&_svg:not([class*='size-'])]:size-5";

/* ------------------------------------------------------------------------- */
/* Header                                                                    */
/* ------------------------------------------------------------------------- */

function VisitHeader({ booking }: { booking: Booking }) {
  const phone = populated(booking.customer)?.phone;
  const { lat, lng } = booking.address;
  // Once at the patient's home the address and directions are no longer needed.
  const compact = !["assigned", "en_route", "arrived"].includes(booking.status);
  const tel = phone ? `tel:+91${phone.replace(/\D/g, "").slice(-10)}` : null;
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/nurse"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Today
        </Link>
        <StatusBadge status={booking.status} audience="staff" />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-tight">
            {booking.patient.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{booking.code}</span>
            <span aria-hidden>·</span>
            <span>{ageGender(booking.patient)}</span>
          </p>
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
            aria-label={`Call patient on ${formatPhone(phone)}`}
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
                  "h-11 rounded-xl text-sm font-semibold",
                )}
                aria-label={`Call patient on ${formatPhone(phone)}`}
              >
                <Phone className="size-4" /> Call patient
              </a>
            ) : (
              <Button variant="outline" size="lg" disabled className="h-11 rounded-xl text-sm font-semibold">
                <Phone className="size-4" /> No phone
              </Button>
            )}
            <a
              href={mapsDirectionsUrl(lat, lng)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-xl text-sm font-semibold",
              )}
            >
              <Navigation className="size-4" /> Google Maps
              <ExternalLink className="size-3.5 text-muted-foreground" />
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

function DoctorCard({ booking, live }: { booking: Booking; live?: boolean }) {
  const doctor = populated(booking.doctor);
  if (!doctor) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="relative">
        <UserAvatar name={doctor.name} src={doctor.avatarUrl} size="lg" />
        {live && (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-card">
            <span className="live-dot size-2 text-signal" />
          </span>
        )}
      </span>
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
          <p className="text-sm text-muted-foreground">No symptoms or instructions shared.</p>
        )}
      </Panel>
      {populated(booking.doctor) && (
        <Panel title="Reviewing doctor">
          <DoctorCard booking={booking} />
        </Panel>
      )}
    </>
  );
}

function SimulateToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-card px-3.5 py-3">
      <Route className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">Simulate drive</span>
        <span className="block text-xs text-muted-foreground">Demo mode: drive to the patient in 45 seconds</span>
      </span>
      <Switch checked={on} onCheckedChange={(v) => onChange(Boolean(v))} aria-label="Simulate drive" />
    </label>
  );
}

function TripPanel({
  booking,
  sharing,
  nurseName,
}: {
  booking: Booking;
  sharing: ReturnType<typeof useLocationSharing>;
  nurseName?: string;
}) {
  const enRoute = booking.status === "en_route";
  const home = {
    lat: booking.address.lat,
    lng: booking.address.lng,
    label: booking.patient.name,
  };
  const pos = sharing.position;
  const km = pos ? haversineKm(pos, home) : null;
  const patientFirst = firstName(booking.patient.name);
  const reached = enRoute && (sharing.reached || (km !== null && km < 0.08));

  let line: ReactNode;
  if (!enRoute) {
    line =
      km !== null ? (
        <>
          {formatDistance(km)} away · about {etaMinutes(km)} min drive
        </>
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
  } else if (sharing.sharing) {
    line = (
      <span className="flex items-center gap-2">
        <span className="live-dot size-1.5 text-signal" aria-hidden />
        Sharing live location with {patientFirst}
      </span>
    );
  } else if (sharing.gps === "locating" || sharing.gps === "idle") {
    line = (
      <span className="flex items-center gap-2">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Locating you...
      </span>
    );
  } else {
    line = "GPS unavailable. Turn on Simulate drive.";
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
      <LiveMap home={home} nurse={pos} nurseName={nurseName} height={enRoute ? 300 : 220} />
      <div className="text-sm text-muted-foreground">{line}</div>
      {enRoute && sharing.simulate && !reached && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(sharing.progress * 100)}%` }}
          />
        </div>
      )}
      <SimulateToggle on={sharing.simulate} onChange={sharing.setSimulate} />
    </Panel>
  );
}

const PREP = [
  "Introduce yourself and confirm the patient's name",
  "Sanitise hands and wear gloves",
  "Patient seated and rested for 5 minutes",
  "Smart ECG and stethoscope charged and nearby",
];

function ArrivedPanel({ booking }: { booking: Booking }) {
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());
  const tests = nurseTests(booking.serviceCodes);
  return (
    <>
      <Panel title="Before you begin" icon={<ListChecks />}>
        <ul className="flex flex-col gap-1">
          {PREP.map((item, i) => {
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
            const device = code === "ECG" || code === "STETH";
            return (
              <li key={code} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-foreground">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium">{meta.label}</span>
                {device && (
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

function Workspace({
  booking,
  setBooking,
  inCall,
  onLeaveCall,
  onFinish,
}: {
  booking: Booking;
  setBooking: (b: Booking) => void;
  inCall: boolean;
  onLeaveCall: () => void;
  onFinish: () => void;
}) {
  const { user } = useAuth();
  const signalling = useSignalling();
  const doctor = populated(booking.doctor);
  const consult = booking.status === "consult";
  const hasEcg = booking.serviceCodes.includes("ECG");
  const hasSteth = booking.serviceCodes.includes("STETH");
  const hr = booking.vitals?.heartRate ?? null;

  return (
    <>
      {consult && (
        <Panel className="border-foreground">
          <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <span className="live-dot size-1.5 text-signal" aria-hidden />
            Live doctor consult
          </p>
          <DoctorCard booking={booking} live />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {doctor ? `${doctor.name} is reviewing live.` : "The doctor is reviewing live."}
            </span>{" "}
            Keep devices streaming and update vitals if asked.
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
          <button
            type="button"
            onClick={onFinish}
            className="self-start text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Doctor finished? Mark visit complete
          </button>
        </Panel>
      )}
      {!consult && <ReadinessPanel booking={booking} />}

      <SectionHeading>Vitals</SectionHeading>
      <VitalsPanel booking={booking} onSaved={setBooking} />

      <SectionHeading aside={<span className="text-xs text-muted-foreground">Streams live to the doctor</span>}>
        Smart devices
      </SectionHeading>
      {(["ecg", "stethoscope"] as const)
        .slice()
        .sort((a, b) => {
          const booked = (k: string) => (k === "ecg" ? hasEcg : hasSteth);
          return Number(booked(b)) - Number(booked(a));
        })
        .map((kind) => (
          <DeviceCard
            key={kind}
            kind={kind}
            booking={booking}
            booked={kind === "ecg" ? hasEcg : hasSteth}
            doctorName={doctor?.name}
            heartRateHint={hr}
            onSaved={setBooking}
          />
        ))}
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
      label: "SpO2",
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

function VisitScreen({ booking, setBooking }: { booking: Booking; setBooking: (b: Booking) => void }) {
  const { user } = useAuth();
  const [pending, setPending] = useState<BookingStatus | null>(null);
  const [confirm, setConfirm] = useState<"consult" | "finish" | null>(null);
  const [inCall, setInCall] = useState(false);
  const status = booking.status;

  const home = { lat: booking.address.lat, lng: booking.address.lng };
  const from = booking.nurseLocation?.lat != null ? booking.nurseLocation : (user?.baseLocation ?? null);
  const sharing = useLocationSharing({
    bookingId: booking.id,
    active: status === "en_route",
    from,
    to: home,
  });

  const advance = useCallback(
    async (to: BookingStatus) => {
      setPending(to);
      try {
        const res = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/status`, { status: to });
        setBooking(res.booking);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't update the visit."));
      } finally {
        setPending(null);
      }
    },
    [booking.id, setBooking],
  );

  const missing = missingTests(booking);
  const busy = pending !== null;
  const spinner = <LoaderCircle className="animate-spin" />;

  let bar: ReactNode = null;
  switch (status) {
    case "assigned":
      bar = (
        <ActionBar hint="Shares your live location with the patient">
          <Button className={primaryCta} disabled={busy} onClick={() => void advance("en_route")}>
            {busy ? spinner : <Navigation />} Start trip
          </Button>
        </ActionBar>
      );
      break;
    case "en_route":
      bar = (
        <ActionBar>
          <Button className={primaryCta} disabled={busy} onClick={() => void advance("arrived")}>
            {busy ? spinner : <House />} I&apos;ve arrived
          </Button>
        </ActionBar>
      );
      break;
    case "arrived":
      bar = (
        <ActionBar>
          <Button className={primaryCta} disabled={busy} onClick={() => void advance("testing")}>
            {busy ? spinner : <ArrowRight />} Begin tests
          </Button>
        </ActionBar>
      );
      break;
    case "testing":
      bar = (
        <ActionBar
          hint={
            missing.length === 0 ? (
              <span className="font-medium text-success">All readings saved</span>
            ) : (
              `${missing.length} reading${missing.length > 1 ? "s" : ""} left: ${missing.map((c) => TEST_META[c].short).join(", ")}`
            )
          }
        >
          <Button
            className={primaryCta}
            disabled={busy}
            onClick={() => (missing.length ? setConfirm("consult") : void advance("consult"))}
          >
            {busy ? spinner : <Video />} Start doctor consult
          </Button>
        </ActionBar>
      );
      break;
    case "consult":
      bar = inCall ? null : (
        <ActionBar>
          <Button className={primaryCta} onClick={() => setInCall(true)}>
            <Video /> Join video call
          </Button>
        </ActionBar>
      );
      break;
    default:
      bar = (
        <ActionBar>
          <Link href="/nurse" className={cn(buttonVariants({ size: "lg" }), primaryCta)}>
            <ArrowLeft /> Back to Today
          </Link>
        </ActionBar>
      );
  }

  const workspace = status === "testing" || status === "consult";
  const done = status === "reporting" || status === "completed";

  return (
    <div className="flex flex-col gap-4 pb-28">
      <VisitHeader booking={booking} />
      <NurseProgress status={status} />

      {(status === "assigned" || status === "en_route") && (
        <TripPanel booking={booking} sharing={sharing} nurseName={user?.name} />
      )}
      {status === "assigned" && <VisitBrief booking={booking} />}
      {status === "arrived" && <ArrivedPanel booking={booking} />}
      {workspace && (
        <Workspace
          booking={booking}
          setBooking={setBooking}
          inCall={inCall}
          onLeaveCall={() => setInCall(false)}
          onFinish={() => setConfirm("finish")}
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
        <DialogContent className="gap-5 p-5">
          {confirm === "consult" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Start consult without all readings?</DialogTitle>
                <DialogDescription>
                  Still missing: {missing.map((c) => TEST_META[c].label).join(", ")}. You can keep recording during the
                  consult.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="-mx-5 -mb-5 flex-col gap-2 p-5 sm:flex-col">
                <Button
                  className="h-12 w-full rounded-xl text-base font-semibold"
                  onClick={() => {
                    setConfirm(null);
                    void advance("consult");
                  }}
                >
                  Start consult anyway
                </Button>
                <DialogClose render={<Button variant="outline" className="h-12 w-full rounded-xl text-base" />}>
                  Keep testing
                </DialogClose>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">Mark this visit complete?</DialogTitle>
                <DialogDescription>
                  Use this once the doctor has finished the consult. The doctor will then prepare the report.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="-mx-5 -mb-5 flex-col gap-2 p-5 sm:flex-col">
                <Button
                  className="h-12 w-full rounded-xl text-base font-semibold"
                  onClick={() => {
                    setConfirm(null);
                    setInCall(false);
                    void advance("reporting");
                  }}
                >
                  Mark complete
                </Button>
                <DialogClose render={<Button variant="outline" className="h-12 w-full rounded-xl text-base" />}>
                  Not yet
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
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
    const notMine = errorStatus === 403 || errorStatus === 404;
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <p className="font-semibold">{notMine ? "This visit is not assigned to you" : "Couldn't load this visit"}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Link href="/nurse" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Back to Today
          </Link>
          {!notMine && (
            <Button size="lg" onClick={reload}>
              <RotateCw /> Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <VisitScreen booking={booking} setBooking={setBooking} />;
}
