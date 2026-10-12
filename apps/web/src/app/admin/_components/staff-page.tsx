"use client";

import { useMemo, useState } from "react";
import { Award, Briefcase, Mail, MapPin, Phone, Plus, Stethoscope, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-menu";
import { api, errorMessage } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import type { StaffMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, SearchInput } from "./admin-ui";
import { AddStaffDialog } from "./add-staff-dialog";
import { useStaff } from "./use-admin-data";

type Role = "nurse" | "doctor";

function LoadMeter({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          n === 0 ? "bg-success" : n < 3 ? "bg-saffron" : "bg-danger",
        )}
      />
      <span className="text-[13px] font-medium tabular">{n === 0 ? "Free" : `${n} active`}</span>
    </span>
  );
}

function StaffCard({
  member,
  onToggle,
  busy,
}: {
  member: StaffMember;
  onToggle: (m: StaffMember, active: boolean) => void;
  busy: boolean;
}) {
  const active = member.isActive !== false;
  const isNurse = member.role === "nurse";
  const hub = member.baseLocation?.label?.replace(/^Nivar Hub,\s*/i, "");
  return (
    <article
      className={cn(
        "flex flex-col rounded-[14px] border border-border bg-card shadow-soft transition-opacity",
        !active && "bg-card/60",
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <UserAvatar name={member.name} src={member.avatarUrl} size="lg" className={cn(!active && "opacity-50 grayscale")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn("truncate text-[15px] font-semibold", !active && "text-muted-foreground")}>{member.name}</h3>
            {!active && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">Inactive</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {member.qualifications ?? (isNurse ? "Nurse" : "Doctor")}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span className="sr-only">{active ? "Deactivate" : "Activate"} {member.name}</span>
          <Switch checked={active} disabled={busy} onCheckedChange={(v) => onToggle(member, v)} />
        </label>
      </div>
      <dl className="grid grid-cols-[0.9fr_1.25fr_1fr] gap-px border-y border-border/70 bg-border/70">
        <div className="bg-card px-3.5 py-2.5">
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Briefcase className="size-3" />
            Experience
          </dt>
          <dd className="mt-0.5 text-[13px] font-medium">{member.yearsExperience ? `${member.yearsExperience} yrs` : "New"}</dd>
        </div>
        <div className="min-w-0 bg-card px-3.5 py-2.5">
          <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {isNurse ? <MapPin className="size-3" /> : <Award className="size-3" />}
            {isNurse ? "Hub" : "Specialty"}
          </dt>
          <dd className="mt-0.5 truncate text-[13px] font-medium" title={isNurse ? hub : member.specialization}>
            {(isNurse ? hub : member.specialization) ?? "Not set"}
          </dd>
        </div>
        <div className="bg-card px-3.5 py-2.5">
          <dt className="text-[11px] text-muted-foreground">Load</dt>
          <dd className="mt-0.5">
            {active || member.activeBookings ? (
              <LoadMeter n={member.activeBookings} />
            ) : (
              <span className="text-[13px] font-medium text-muted-foreground">Off duty</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted-foreground">
        {member.email && (
          <a href={`mailto:${member.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{member.email}</span>
          </a>
        )}
        {member.phone && (
          <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Phone className="size-3.5" />
            {formatPhone(member.phone)}
          </a>
        )}
        {!isNurse && member.registrationNo && <span className="ml-auto font-mono text-[11px]">{member.registrationNo}</span>}
      </div>
    </article>
  );
}

export function StaffPage() {
  const { staff, error, reload } = useStaff(null);
  const [tab, setTab] = useState<Role>("nurse");
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<string, StaffMember>>({});
  const [added, setAdded] = useState<StaffMember[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState({ open: false, n: 0 });

  const all = useMemo(() => {
    const list = staff ? [...staff] : [];
    for (const a of added) if (!list.some((s) => s.id === a.id)) list.push(a);
    return list.map((s) => (overrides[s.id] && overrides[s.id].updatedAt! >= (s.updatedAt ?? "") ? { ...s, ...overrides[s.id], activeBookings: s.activeBookings } : s));
  }, [staff, added, overrides]);

  const counts = {
    nurse: all.filter((s) => s.role === "nurse").length,
    doctor: all.filter((s) => s.role === "doctor").length,
  };
  const activeCount = (r: Role) => all.filter((s) => s.role === r && s.isActive !== false).length;

  const visible = all
    .filter((s) => s.role === tab)
    .filter((s) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [s.name, s.email, s.phone, s.specialization, s.qualifications, s.baseLocation?.label]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false) || a.name.localeCompare(b.name));

  const toggle = async (m: StaffMember, active: boolean) => {
    setBusy(m.id);
    const optimistic = { ...m, isActive: active, updatedAt: new Date().toISOString() };
    setOverrides((o) => ({ ...o, [m.id]: optimistic }));
    try {
      const res = await api.patch<{ staff: StaffMember }>(`/admin/staff/${m.id}`, { isActive: active });
      setOverrides((o) => ({ ...o, [m.id]: res.staff }));
      toast.success(`${m.name} ${active ? "activated" : "deactivated"}`, {
        description: active
          ? "They can be assigned to new visits again."
          : m.activeBookings
            ? `They still have ${m.activeBookings} active visit${m.activeBookings === 1 ? "" : "s"}. Reassign if needed.`
            : "They won't be offered for new visits.",
      });
      reload();
    } catch (err) {
      setOverrides((o) => {
        const copy = { ...o };
        delete copy[m.id];
        return copy;
      });
      toast.error("Couldn't update this staff member", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Staff"
        description={
          staff
            ? `${activeCount("nurse")} nurses and ${activeCount("doctor")} doctors on duty. Every one a full-time Nivar employee.`
            : "Nurses and doctors"
        }
        actions={
          <Button className="h-9 px-3.5" onClick={() => setDialog((d) => ({ open: true, n: d.n + 1 }))}>
            <Plus />
            Add staff
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Role)}>
          <TabsList className="h-9 bg-muted/80 p-1 group-data-horizontal/tabs:h-9">
            <TabsTrigger value="nurse" className="px-3">
              <UserRound />
              Nurses
              <span className="ml-0.5 rounded-full bg-foreground/8 px-1.5 text-[11px] tabular">{counts.nurse}</span>
            </TabsTrigger>
            <TabsTrigger value="doctor" className="px-3">
              <Stethoscope />
              Doctors
              <span className="ml-0.5 rounded-full bg-foreground/8 px-1.5 text-[11px] tabular">{counts.doctor}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder={`Search ${tab === "nurse" ? "nurses" : "doctors"}`} className="sm:w-72" />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {!staff ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-[14px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card">
          <EmptyState
            icon={<UsersRound />}
            title={query ? "No one matches that search" : `No ${tab === "nurse" ? "nurses" : "doctors"} yet`}
            body={query ? "Try a name, hub or specialty." : "Add your first one to start assigning visits."}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <StaffCard key={m.id} member={m} onToggle={toggle} busy={busy === m.id} />
          ))}
        </div>
      )}

      <AddStaffDialog
        key={dialog.n}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        defaultRole={tab}
        onCreated={(m) => {
          setAdded((a) => [...a, m]);
          setTab(m.role === "doctor" ? "doctor" : "nurse");
          reload();
        }}
      />
    </>
  );
}
