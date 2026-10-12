"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList, History, MapPin, NotebookPen, Phone, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-menu";
import { api } from "@/lib/api";
import { formatDateLong, formatPhone, relative, scheduleLabel } from "@/lib/format";
import { populated, refId, type Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RELATION_LABEL, SERVICE_LABEL, genderLabel } from "./clinical";
import { statusAt } from "./hooks";
import { VitalsList, vitalRows } from "./vitals";

export function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-soft", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground [&_svg]:size-4">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PatientCard({ booking }: { booking: Booking }) {
  const { patient, address } = booking;
  const customer = populated(booking.customer);
  const bookedBySomeoneElse = patient.relation !== "self" && customer && customer.name !== patient.name;
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex items-center gap-3.5 p-4">
        <UserAvatar name={patient.name} size="lg" className="size-12 text-base" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-tight">{patient.name}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {patient.age} yrs · {genderLabel(patient.gender)} · {RELATION_LABEL[patient.relation]}
          </p>
        </div>
      </div>
      <dl className="flex flex-col gap-2.5 border-t px-4 py-3.5 text-[13px]">
        {bookedBySomeoneElse && (
          <div className="flex items-start gap-2.5">
            <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <dd>
              Booked by <span className="font-medium">{customer.name}</span>
            </dd>
          </div>
        )}
        {customer?.phone && (
          <div className="flex items-start gap-2.5">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <dd>
              <a
                href={`tel:+91${customer.phone}`}
                className="font-medium tabular-nums hover:text-primary hover:underline"
              >
                {formatPhone(customer.phone)}
              </a>
            </dd>
          </div>
        )}
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <dd className="min-w-0">
            <span className="font-medium">{address.area}</span>
            <span className="block text-muted-foreground">
              {address.line1}, {address.city} {address.pincode}
            </span>
          </dd>
        </div>
      </dl>
      <div className="border-t px-4 py-3.5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {scheduleLabel(booking.scheduledDate, booking.slot)}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {booking.serviceCodes.map((code) => (
            <li
              key={code}
              className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {SERVICE_LABEL[code]}
            </li>
          ))}
        </ul>
      </div>
      {booking.notes?.trim() && (
        <div className="border-t bg-muted/60 px-4 py-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <NotebookPen className="size-3.5" /> Symptoms and notes
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">{booking.notes}</p>
        </div>
      )}
    </section>
  );
}

function VitalsPanel({ booking, liveHeartRate }: { booking: Booking; liveHeartRate: number | null }) {
  const recordedAt = booking.vitals?.recordedAt;
  const rows = vitalRows(booking.vitals, liveHeartRate);
  const nothing = rows.every((r) => r.value === null);
  return (
    <Panel
      title="Vitals"
      icon={<ClipboardList />}
      action={
        <span className="text-[11px] text-muted-foreground">
          {recordedAt ? `Updated ${relative(recordedAt)}` : nothing ? "Awaiting nurse" : ""}
        </span>
      }
    >
      <VitalsList rows={rows} />
      {!booking.vitals?.heartRate && liveHeartRate ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Heart rate shown live from the Smart ECG.</p>
      ) : null}
    </Panel>
  );
}

function CareTeam({ booking }: { booking: Booking }) {
  const nurse = populated(booking.nurse);
  const statusText: Record<string, string> = {
    assigned: "Assigned, not started",
    en_route: "On the way",
    arrived: "At the patient's home",
    testing: "Running tests",
    consult: "In the consult",
    reporting: "Visit complete",
    completed: "Visit complete",
  };
  return (
    <Panel title="Care team" icon={<Users />}>
      {nurse ? (
        <div className="flex items-center gap-3">
          <UserAvatar name={nurse.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{nurse.name}</p>
            <p className="truncate text-xs text-muted-foreground">{nurse.qualifications ?? "Nivar nurse"}</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
            {statusText[booking.status] ?? "Nurse"}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">A nurse has not been assigned yet.</p>
      )}
      {nurse?.phone && (
        <a
          href={`tel:+91${nurse.phone}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Phone className="size-3.5" /> Call {nurse.name.split(" ")[0]} at {formatPhone(nurse.phone)}
        </a>
      )}
    </Panel>
  );
}

function HistoryPanel({ booking }: { booking: Booking }) {
  const customerId = refId(booking.customer);
  const [history, setHistory] = useState<Booking[] | null>(null);

  useEffect(() => {
    if (!customerId) return;
    const controller = new AbortController();
    api
      .get<{ bookings: Booking[] }>("/bookings?status=completed", { signal: controller.signal })
      .then(({ bookings }) => {
        setHistory(
          bookings
            .filter(
              (b) =>
                b.id !== booking.id &&
                refId(b.customer) === customerId &&
                b.patient.name.toLowerCase() === booking.patient.name.toLowerCase(),
            )
            .sort((a, b) => (statusAt(b, "completed") ?? 0) - (statusAt(a, "completed") ?? 0))
            .slice(0, 4),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistory([]);
      });
    return () => controller.abort();
  }, [customerId, booking.id, booking.patient.name]);

  return (
    <Panel title="Previous visits" icon={<History />}>
      {history === null ? (
        <p className="text-sm text-muted-foreground">Loading history</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">First visit with you on Nivar.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {history.map((h) => {
            const v = h.vitals;
            return (
              <li key={h.id}>
                <Link
                  href={`/doctor/consults/${h.id}`}
                  className="group/h flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{h.report?.diagnosis ?? "Health check"}</p>
                    <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                      {formatDateLong(h.scheduledDate)}
                      {v?.bpSystolic ? ` · BP ${v.bpSystolic}/${v.bpDiastolic}` : ""}
                      {v?.heartRate ? ` · HR ${v.heartRate}` : ""}
                      {typeof v?.sugar === "number" ? ` · Sugar ${v.sugar}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/h:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function PatientColumn({ booking, liveHeartRate }: { booking: Booking; liveHeartRate: number | null }) {
  return (
    <>
      <PatientCard booking={booking} />
      <VitalsPanel booking={booking} liveHeartRate={liveHeartRate} />
      <CareTeam booking={booking} />
      <HistoryPanel booking={booking} />
    </>
  );
}
