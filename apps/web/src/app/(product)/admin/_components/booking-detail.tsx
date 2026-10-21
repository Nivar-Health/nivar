"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarClock,
  ClipboardList,
  FileHeart,
  HeartPulse,
  History,
  Home,
  IndianRupee,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Pill,
  Star,
  Stethoscope,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { BookingStepper } from "@/components/booking-stepper";
import { EcgStrip, LiveMap } from "@/components/live";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-menu";
import {
  CANCELLABLE_STATUSES,
  EXPRESS_SLOT,
  STATUS_META,
  SUGAR_TYPE_LABEL,
  formatDateTime,
  formatINR,
  formatPhone,
  relative,
  scheduleLabel,
  vitalAssessment,
  vitalToneClass,
  type VitalAssessment,
} from "@/lib/format";
import { useBooking, useNurseLocation } from "@/lib/socket";
import { populated, type Booking, type BookingStatus, type Package, type Service, type UserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, FieldLabel, Panel, SERVICE_SHORT } from "./admin-ui";
import { AssignDialog } from "./assign-dialog";
import { CancelDialog } from "./cancel-dialog";
import { useAdminResource, useNow } from "./use-admin-data";

const RELATION: Record<string, string> = {
  self: "Self",
  parent: "Parent",
  spouse: "Spouse",
  child: "Child",
  other: "Family",
};
const GENDER: Record<string, string> = { male: "Male", female: "Female", other: "Other" };
const HISTORY_LABEL: Record<BookingStatus, string> = {
  pending_payment: "Booking placed",
  confirmed: "Payment received",
  assigned: "Care team assigned",
  en_route: "Nurse started the trip",
  arrived: "Nurse arrived",
  testing: "Tests started",
  consult: "Video consult started",
  reporting: "Report in progress",
  completed: "Report published",
  cancelled: "Booking cancelled",
};
const METHOD: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Netbanking", cash: "Cash" };

function Fact({ label, children, icon }: { label: string; children: ReactNode; icon: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-5 py-4">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <FieldLabel>{label}</FieldLabel>
        <div className="mt-1 text-sm leading-snug font-medium">{children}</div>
      </div>
    </div>
  );
}

function StaffCard({
  person,
  role,
  live,
  closed,
}: {
  person: UserSummary | null;
  role: "Nurse" | "Doctor";
  live?: boolean;
  closed?: boolean;
}) {
  if (!person) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3.5 py-3">
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          {role === "Nurse" ? <UserRound className="size-4" /> : <Stethoscope className="size-4" />}
        </span>
        <div>
          <div className="text-sm font-medium text-muted-foreground">No {role.toLowerCase()} yet</div>
          <div className="text-xs text-muted-foreground">
            {closed ? "None was assigned to this visit" : "Assign a care team to dispatch this visit"}
          </div>
        </div>
      </div>
    );
  }
  const detail =
    role === "Doctor"
      ? [person.specialization, person.registrationNo].filter(Boolean).join(" · ")
      : person.qualifications;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-3">
      <div className="relative">
        <UserAvatar name={person.name} src={person.avatarUrl} size="lg" />
        {live && (
          <span className="absolute -right-0.5 -bottom-0.5 grid size-3.5 place-items-center rounded-full bg-card">
            <span className="live-dot size-2 text-signal" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{person.name}</span>
          <span className="rounded bg-muted px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">{role}</span>
        </div>
        {detail && <div className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</div>}
        <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {person.yearsExperience ? <span>{person.yearsExperience} yrs experience</span> : null}
          {person.phone && (
            <a href={`tel:${person.phone}`} className="inline-flex w-fit items-center gap-1 hover:text-foreground">
              <Phone className="size-3" />
              {formatPhone(person.phone)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function VitalTile({
  label,
  value,
  unit,
  assessment,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  assessment?: VitalAssessment;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {assessment && (
          <span className={cn("rounded-full px-1.5 py-px text-[10.5px] font-medium ring-1 ring-inset", vitalToneClass(assessment))}>
            {assessment.label}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-semibold tracking-tight tabular">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ClinicalPanel({ booking }: { booking: Booking }) {
  const v = booking.vitals;
  const tiles: ReactNode[] = [];
  if (v?.bpSystolic && v?.bpDiastolic)
    tiles.push(
      <VitalTile
        key="bp"
        label="Blood pressure"
        value={`${v.bpSystolic}/${v.bpDiastolic}`}
        unit="mmHg"
        assessment={vitalAssessment("bp", { systolic: v.bpSystolic, diastolic: v.bpDiastolic })}
      />,
    );
  if (v?.sugar)
    tiles.push(
      <VitalTile
        key="sugar"
        label="Blood sugar"
        value={String(v.sugar)}
        unit="mg/dL"
        hint={v.sugarType ? SUGAR_TYPE_LABEL[v.sugarType] : undefined}
        assessment={vitalAssessment("sugar", v.sugar, { sugarType: v.sugarType })}
      />,
    );
  if (v?.heartRate)
    tiles.push(
      <VitalTile key="hr" label="Heart rate" value={String(v.heartRate)} unit="bpm" assessment={vitalAssessment("heartRate", v.heartRate)} />,
    );
  if (v?.spo2)
    tiles.push(<VitalTile key="spo2" label="SpO2" value={String(v.spo2)} unit="%" assessment={vitalAssessment("spo2", v.spo2)} />);
  if (v?.temperatureF)
    tiles.push(
      <VitalTile
        key="temp"
        label="Temperature"
        value={v.temperatureF.toFixed(1)}
        unit="°F"
        assessment={vitalAssessment("temperature", v.temperatureF)}
      />,
    );
  if (v?.weightKg) tiles.push(<VitalTile key="w" label="Weight" value={String(v.weightKg)} unit="kg" />);

  const ecg = booking.ecg;
  const steth = booking.stethoscope;
  const report = booking.report;
  const hasAny = tiles.length || ecg || steth || report?.diagnosis;

  return (
    <Panel
      title="Clinical summary"
      description={
        v?.recordedAt ? `Vitals recorded ${relative(v.recordedAt)} by the nurse` : "Readings appear here live as the nurse records them"
      }
      icon={<HeartPulse />}
    >
      {!hasAny ? (
        <EmptyState
          icon={<HeartPulse />}
          title="No readings yet"
          body="Vitals, ECG and the doctor's report show up here during the visit."
        />
      ) : (
        <div className="flex flex-col gap-5 p-5">
          {tiles.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{tiles}</div>}

          {ecg && (
            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold">
                  Smart ECG
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {ecg.rhythm}
                    {ecg.heartRate ? ` · ${Math.round(ecg.heartRate)} bpm` : ""}
                  </span>
                </div>
                {ecg.capturedAt && <span className="text-xs text-muted-foreground">Captured {formatDateTime(ecg.capturedAt)}</span>}
              </div>
              {ecg.samples?.length ? (
                <EcgStrip samples={ecg.samples} sampleRate={ecg.sampleRate} heartRate={ecg.heartRate} variant="brand" secondsPerRow={10} />
              ) : null}
              {ecg.interpretation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{ecg.interpretation}</p>}
            </div>
          )}

          {steth && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-foreground ring-1 ring-border">
                <Stethoscope className="size-4" />
              </span>
              <div className="min-w-0 text-sm">
                <div className="font-semibold">
                  Digital stethoscope
                  {steth.heartRate ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{Math.round(steth.heartRate)} bpm</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{steth.findings}</p>
              </div>
            </div>
          )}

          {report?.diagnosis && (
            <div className="rounded-xl border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileHeart className="size-4 text-muted-foreground" />
                  Doctor&apos;s report
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    report.publishedAt ? "bg-background text-foreground ring-border" : "bg-background text-saffron ring-saffron/35",
                  )}
                >
                  {report.publishedAt ? `Published ${formatDateTime(report.publishedAt)}` : "Draft"}
                </span>
              </div>
              <div className="grid gap-3 px-4 py-3 text-sm">
                <div>
                  <FieldLabel>Diagnosis</FieldLabel>
                  <p className="mt-0.5 font-medium">{report.diagnosis}</p>
                </div>
                {report.summary && <p className="text-[13px] leading-relaxed text-muted-foreground">{report.summary}</p>}
                {report.prescription?.length > 0 && (
                  <div>
                    <FieldLabel>Prescription</FieldLabel>
                    <ul className="mt-1 grid gap-1">
                      {report.prescription.map((p, i) => (
                        <li key={i} className="flex items-center gap-2 text-[13px]">
                          <Pill className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{p.medicine}</span>
                          <span className="truncate text-muted-foreground">
                            {[p.dosage, p.frequency, p.duration].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.followUp && (
                  <p className="text-[13px]">
                    <span className="text-muted-foreground">Follow up: </span>
                    {report.followUp}
                  </p>
                )}
              </div>
            </div>
          )}

          {booking.rating && (
            <div className="flex items-center gap-2 text-sm">
              <span className="flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn("size-4", i < booking.rating!.score ? "fill-foreground text-foreground" : "text-border")}
                  />
                ))}
              </span>
              {booking.rating.comment && <span className="text-muted-foreground">&ldquo;{booking.rating.comment}&rdquo;</span>}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function TimelineList({ booking }: { booking: Booking }) {
  const entries = [...(booking.timeline ?? [])].reverse();
  return (
    <Panel title="Activity log" description={`${entries.length} events`} icon={<History />}>
      <ol className="px-5 py-4">
        {entries.map((e, idx) => {
          const meta = STATUS_META[e.status];
          const Icon = meta.icon;
          const last = idx === entries.length - 1;
          return (
            <li key={`${e.status}-${e.at}`} className="relative flex gap-3">
              {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[13px] w-px bg-border" />}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset [&_svg]:size-3.5",
                  meta.badgeClass,
                )}
              >
                <Icon aria-hidden />
              </span>
              <div className={cn("min-w-0 flex-1 pt-1", !last && "pb-4")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[13px] font-medium">{HISTORY_LABEL[e.status]}</span>
                  <span className="text-xs text-muted-foreground tabular" title={formatDateTime(e.at)}>
                    {formatDateTime(e.at)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {e.note}
                  {e.note && e.by ? " · " : ""}
                  {e.by ? `by ${e.by}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-24 w-full rounded-[14px]" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-[14px] lg:col-span-2" />
        <Skeleton className="h-80 rounded-[14px]" />
      </div>
    </div>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const { booking, error, errorStatus, loading, setBooking, reload } = useBooking(id);
  const catalog = useAdminResource<{ packages: Package[]; services: Service[] }>("/admin/packages");
  const nurseLoc = useNurseLocation(booking?.status === "en_route" || booking?.status === "arrived" ? id : null, booking?.nurseLocation);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  useNow(30_000);

  const back = (
    <Link
      href="/admin/bookings"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      All bookings
    </Link>
  );

  if (loading) return <DetailSkeleton />;
  if (!booking) {
    return (
      <>
        {back}
        {errorStatus === 404 ? (
          <EmptyState icon={<ClipboardList />} title="Booking not found" body="It may have been removed, or the link is wrong." />
        ) : (
          <ErrorState message={error ?? "Couldn't load this booking."} onRetry={reload} />
        )}
      </>
    );
  }

  const b = booking;
  const nurse = populated(b.nurse);
  const doctor = populated(b.doctor);
  const customer = populated(b.customer);
  const canAssign = b.status === "confirmed" || b.status === "assigned";
  const canCancel = CANCELLABLE_STATUSES.includes(b.status);
  const showMap = b.status === "en_route" || b.status === "arrived";
  const pkg = catalog.data?.packages.find((p) => p.id === b.packageId);
  const serviceName = (code: string) =>
    catalog.data?.services.find((s) => s.code === code)?.name ?? SERVICE_SHORT[code as keyof typeof SERVICE_SHORT] ?? code;
  const nurseLive = ["en_route", "arrived", "testing", "consult"].includes(b.status);
  const doctorLive = b.status === "consult" || b.status === "reporting";
  const payStatus = b.payment?.status ?? "pending";

  return (
    <>
      {back}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[28px] leading-none font-semibold tracking-tight">{b.code}</h1>
            <StatusBadge status={b.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {b.patient.name} · {b.address.area} · booked {relative(b.createdAt)}
          </p>
        </div>
        {(canAssign || canCancel) && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {canCancel && (
              <Button variant="outline" className="h-9 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => setCancelOpen(true)}>
                <Ban />
                Cancel booking
              </Button>
            )}
            {canAssign && (
              <Button className="h-9 px-3.5" onClick={() => setAssignOpen(true)}>
                <UsersRound />
                {b.nurse ? "Reassign care team" : "Assign care team"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mb-5 overflow-hidden rounded-[14px] border border-border bg-card shadow-soft">
        <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-[1.35fr_1fr_1fr_1fr] lg:divide-x [&>*]:border-border/70 sm:[&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0">
          <Fact label="Visit" icon={b.slot === EXPRESS_SLOT ? <Zap /> : <CalendarClock />}>
            {scheduleLabel(b.scheduledDate, b.slot)}
          </Fact>
          <Fact label="Amount" icon={<IndianRupee />}>
            <span className="flex items-center gap-2">
              {formatINR(b.amount)}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] font-medium ring-1 ring-inset",
                  payStatus === "paid" && "bg-background text-foreground ring-border",
                  payStatus === "pending" && "bg-background text-saffron ring-saffron/35",
                  payStatus === "refunded" && "bg-background text-muted-foreground ring-border",
                )}
              >
                {payStatus === "paid" ? `Paid · ${METHOD[b.payment.method ?? "upi"]}` : payStatus === "refunded" ? "Refunded" : "Unpaid"}
              </span>
            </span>
          </Fact>
          <Fact label={pkg ? "Package" : "Tests"} icon={<ClipboardList />}>
            <span className="block truncate">{pkg ? pkg.name : `${b.serviceCodes.length} tests`}</span>
          </Fact>
          <Fact label="Booked by" icon={<UserRound />}>
            <span className="block truncate">{customer?.name ?? "Customer"}</span>
          </Fact>
        </div>
        <div className="border-t border-border/70 px-5 pt-5 pb-4">
          <BookingStepper booking={b} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {showMap && (
            <Panel
              title={b.status === "en_route" ? "Nurse on the way" : "Nurse at the patient's home"}
              description={
                b.status === "arrived"
                  ? `Arrived ${relative(b.timeline.findLast((e) => e.status === "arrived")?.at)}`
                  : nurseLoc?.at
                    ? `Location updated ${relative(nurseLoc.at)}`
                    : "Waiting for the first location ping"
              }
              icon={<Navigation />}
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background text-foreground ring-1 ring-border ring-inset px-2 py-0.5 text-[10.5px] font-medium">
                  <span className="live-dot size-1.5 text-signal" />
                  Live
                </span>
              }
            >
              <div className="p-3">
                <LiveMap
                  home={{ lat: b.address.lat, lng: b.address.lng, label: b.patient.name }}
                  nurse={b.status === "arrived" ? { lat: b.address.lat, lng: b.address.lng } : nurseLoc}
                  nurseName={nurse?.name}
                  height={340}
                  className="rounded-xl"
                />
              </div>
            </Panel>
          )}
          {(b.status !== "cancelled" || b.vitals || b.ecg) && <ClinicalPanel booking={b} />}
          <TimelineList booking={b} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Patient" icon={<Home />}>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <UserAvatar name={b.patient.name} size="lg" />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{b.patient.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.patient.age} yrs · {GENDER[b.patient.gender] ?? b.patient.gender} · {RELATION[b.patient.relation] ?? "Self"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-[13px]">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 leading-relaxed">
                  <div className="font-medium">{b.address.label}</div>
                  <div className="text-muted-foreground">
                    {b.address.line1}, {b.address.area}, {b.address.city} {b.address.pincode}
                  </div>
                </div>
              </div>
              {customer && (
                <div className="grid gap-1.5 rounded-xl bg-muted/50 px-3.5 py-3 text-[13px]">
                  <FieldLabel>Account</FieldLabel>
                  <div className="font-medium">{customer.name}</div>
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <Phone className="size-3.5" />
                      {formatPhone(customer.phone)}
                    </a>
                  )}
                  {customer.email && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="size-3.5" />
                      {customer.email}
                    </span>
                  )}
                </div>
              )}
              {b.notes && (
                <div className="text-[13px]">
                  <FieldLabel>Symptoms and notes</FieldLabel>
                  <p className="mt-1 leading-relaxed text-foreground/85">{b.notes}</p>
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="Care team"
            icon={<UsersRound />}
            action={
              canAssign ? (
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  {b.nurse ? "Reassign" : "Assign"}
                </Button>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-2.5 p-4">
              <StaffCard person={nurse} role="Nurse" live={nurseLive} closed={b.status === "cancelled"} />
              <StaffCard person={doctor} role="Doctor" live={doctorLive} closed={b.status === "cancelled"} />
            </div>
          </Panel>

          <Panel title="Order" icon={<BadgeCheck />}>
            <div className="flex flex-col gap-3 p-5 text-[13px]">
              {pkg && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{pkg.name}</span>
                  <span className="text-muted-foreground line-through tabular">{formatINR(pkg.mrp)}</span>
                </div>
              )}
              <ul className="grid gap-1.5">
                {b.serviceCodes.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-1 rounded-full bg-muted-foreground/60" />
                    {serviceName(c)}
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-border/70 pt-3">
                <span className="font-medium">Total</span>
                <span className="text-base font-semibold tabular">{formatINR(b.amount)}</span>
              </div>
              {b.payment?.txnId && (
                <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                  <span>Txn {b.payment.txnId}</span>
                  {b.payment.paidAt && <span>{formatDateTime(b.payment.paidAt)}</span>}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <AssignDialog booking={b} open={assignOpen} onOpenChange={setAssignOpen} onAssigned={setBooking} />
      <CancelDialog booking={b} open={cancelOpen} onOpenChange={setCancelOpen} onCancelled={setBooking} />
    </>
  );
}
