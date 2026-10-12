"use client";

import { useMemo, useState } from "react";
import { Loader2, MapPin, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { haversineKm, formatDistance } from "@/components/live";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-menu";
import { api, errorMessage } from "@/lib/api";
import { scheduleLabel } from "@/lib/format";
import { refId, type Booking, type StaffMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookingCode, ServiceChips } from "./admin-ui";
import { useAdminResource } from "./use-admin-data";

function LoadPill({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium tabular",
        n === 0 && "bg-emerald-50 text-emerald-800",
        n > 0 && n < 3 && "bg-amber-50 text-amber-800",
        n >= 3 && "bg-red-50 text-red-700",
      )}
    >
      {n === 0 ? "Free" : `${n} active`}
    </span>
  );
}

interface Option {
  member: StaffMember;
  detail: string;
  km?: number;
}

function StaffOption({ option, tag }: { option: Option; tag?: string }) {
  return (
    <span className="flex w-full min-w-0 items-center gap-2.5 py-0.5">
      <UserAvatar name={option.member.name} size="sm" className="[&_[data-slot=avatar-fallback]]:text-[10px]" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium">{option.member.name}</span>
          {tag && (
            <span className="rounded bg-secondary px-1 text-[10px] font-semibold tracking-wide text-secondary-foreground uppercase">
              {tag}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{option.detail}</span>
      </span>
      <LoadPill n={option.member.activeBookings} />
    </span>
  );
}

function StaffSelect({
  label,
  icon,
  options,
  value,
  onChange,
  suggestedId,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  options: Option[];
  value: string | null;
  onChange: (id: string) => void;
  suggestedId?: string;
  loading: boolean;
}) {
  const byId = new Map(options.map((o) => [o.member.id, o]));
  return (
    <div className="grid gap-1.5">
      <Label className="text-[13px] [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
        {icon}
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => v && onChange(v as string)} disabled={loading}>
        <SelectTrigger className="h-auto min-h-12 w-full bg-card py-1.5 pl-2.5">
          <SelectValue placeholder={loading ? "Loading..." : `Choose a ${label.toLowerCase()}`}>
            {(v: string | null) => {
              const o = v ? byId.get(v) : undefined;
              return o ? <StaffOption option={o} tag={o.member.id === suggestedId ? "Suggested" : undefined} /> : null;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="p-1">
          {options.map((o) => (
            <SelectItem key={o.member.id} value={o.member.id} className="py-1.5 pr-8">
              <StaffOption option={o} tag={o.member.id === suggestedId ? "Suggested" : undefined} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Pick a nurse and a doctor for a paid booking (POST /bookings/:id/assign).
 * Nurses are ordered by distance from their hub to the patient, with each
 * person's current load, so the obvious choice is first.
 */
export function AssignDialog({
  booking,
  open,
  onOpenChange,
  onAssigned,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (booking: Booking) => void;
}) {
  const { data, loading } = useAdminResource<{ staff: StaffMember[] }>(open ? "/admin/staff" : null, 800);
  const staff = data?.staff;

  const { nurses, doctors, suggestedNurse, suggestedDoctor } = useMemo(() => {
    const active = (staff ?? []).filter((s) => s.isActive !== false);
    const home = booking?.address;
    const nurses: Option[] = active
      .filter((s) => s.role === "nurse")
      .map((member) => {
        const base = member.baseLocation;
        const km = base && home ? haversineKm(base, home) : undefined;
        const hub = base?.label?.replace(/^Nivar Hub,\s*/i, "") ?? "No hub";
        return { member, km, detail: km !== undefined ? `${hub} hub · ${formatDistance(km)} away` : hub };
      })
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.member.activeBookings - b.member.activeBookings);
    const needsCardio = booking?.serviceCodes.includes("ECG");
    const doctors: Option[] = active
      .filter((s) => s.role === "doctor")
      .map((member) => ({
        member,
        detail: [member.specialization, member.yearsExperience ? `${member.yearsExperience} yrs` : null]
          .filter(Boolean)
          .join(" · "),
      }))
      .sort((a, b) => a.member.activeBookings - b.member.activeBookings);
    // Nearest nurse with spare capacity.
    const suggestedNurse = (nurses.find((n) => n.member.activeBookings < 3) ?? nurses[0])?.member.id;
    // Prefer a cardiologist for ECG visits unless they are much busier than the least loaded doctor.
    const leastLoad = doctors[0]?.member.activeBookings ?? 0;
    const cardio = doctors.find((d) => /cardio/i.test(d.member.specialization ?? ""));
    const suggestedDoctor = (needsCardio && cardio && cardio.member.activeBookings <= leastLoad + 2 ? cardio : doctors[0])
      ?.member.id;
    return { nurses, doctors, suggestedNurse, suggestedDoctor };
  }, [staff, booking]);

  const [picked, setPicked] = useState<{ key: string; nurse: string | null; doctor: string | null }>({
    key: "",
    nurse: null,
    doctor: null,
  });
  const key = `${booking?.id}:${open}`;
  const nurseId = picked.key === key && picked.nurse ? picked.nurse : (refId(booking?.nurse) ?? suggestedNurse ?? null);
  const doctorId =
    picked.key === key && picked.doctor ? picked.doctor : (refId(booking?.doctor) ?? suggestedDoctor ?? null);
  const [saving, setSaving] = useState(false);
  const isReassign = Boolean(booking?.nurse);

  const submit = async () => {
    if (!booking || !nurseId || !doctorId) return;
    setSaving(true);
    try {
      const res = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/assign`, { nurseId, doctorId });
      const n = nurses.find((o) => o.member.id === nurseId)?.member.name;
      const d = doctors.find((o) => o.member.id === doctorId)?.member.name;
      toast.success(`${booking.code} ${isReassign ? "reassigned" : "assigned"}`, {
        description: [n, d].filter(Boolean).join(" and "),
      });
      onAssigned?.(res.booking);
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't assign the care team", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-5 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg">{isReassign ? "Reassign care team" : "Assign care team"}</DialogTitle>
          <DialogDescription>Both get notified instantly, and the patient sees their profiles.</DialogDescription>
        </DialogHeader>

        {booking && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary ring-1 ring-border">
              <MapPin className="size-4" />
            </span>
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              <div className="flex items-center gap-2">
                <BookingCode code={booking.code} />
                <span className="truncate font-medium">{booking.patient.name}</span>
                <span className="text-muted-foreground">
                  {booking.patient.age}
                  {booking.patient.gender?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="mt-0.5 truncate text-muted-foreground">
                {booking.address.area} · {scheduleLabel(booking.scheduledDate, booking.slot)}
              </div>
              <ServiceChips codes={booking.serviceCodes} max={7} className="mt-1.5" />
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <StaffSelect
            label="Nurse"
            icon={<UserRound />}
            options={nurses}
            value={nurseId}
            onChange={(id) => setPicked({ key, nurse: id, doctor: picked.key === key ? picked.doctor : null })}
            suggestedId={suggestedNurse}
            loading={loading}
          />
          <StaffSelect
            label="Doctor"
            icon={<Stethoscope />}
            options={doctors}
            value={doctorId}
            onChange={(id) => setPicked({ key, doctor: id, nurse: picked.key === key ? picked.nurse : null })}
            suggestedId={suggestedDoctor}
            loading={loading}
          />
        </div>

        <DialogFooter className="-mx-5 -mb-5 px-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!nurseId || !doctorId || saving || loading} className="min-w-28">
            {saving && <Loader2 className="animate-spin" />}
            {isReassign ? "Reassign" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
