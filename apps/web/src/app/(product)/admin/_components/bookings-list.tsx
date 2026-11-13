"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, X, Zap } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPRESS_SLOT, STATUS_META, dayLabel, formatINR, formatPhone, slotLabel, todayISO } from "@/lib/format";
import { BOOKING_STATUSES, populated, type Booking, type BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BookingCode,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  ServiceChips,
  TableSkeleton,
  bookedByLabel,
  customerOf,
} from "./admin-ui";
import { LIVE_STATUSES } from "./ops-panels";
import { useAdminBookings } from "./use-admin-data";

const PAGE_SIZE = 25;

type StatusFilter = "all" | "live" | "open" | BookingStatus;

const VIEWS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All bookings" },
  { value: "open", label: "Open bookings" },
  { value: "live", label: "Live now" },
];

function matchesStatus(b: Booking, f: StatusFilter) {
  if (f === "all") return true;
  if (f === "live") return LIVE_STATUSES.includes(b.status);
  if (f === "open") return b.status !== "completed" && b.status !== "cancelled";
  return b.status === f;
}

function statusFilterLabel(f: StatusFilter) {
  return VIEWS.find((v) => v.value === f)?.label ?? STATUS_META[f as BookingStatus]?.staffLabel ?? "All bookings";
}

function parseStatus(v: string | null): StatusFilter {
  if (!v) return "all";
  if (v === "live" || v === "open" || v === "all") return v;
  return (BOOKING_STATUSES as readonly string[]).includes(v) ? (v as BookingStatus) : "all";
}

function sortBookings(list: Booking[]) {
  // Latest day first; within a day, in visit order.
  return list
    .slice()
    .sort(
      (a, b) =>
        b.scheduledDate.localeCompare(a.scheduledDate) ||
        (a.slot === EXPRESS_SLOT ? -1 : b.slot === EXPRESS_SLOT ? 1 : a.slot.localeCompare(b.slot)) ||
        a.code.localeCompare(b.code),
    );
}

function StaffMini({ name, role }: { name?: string; role: "N" | "D" }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] leading-5">
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded text-[9px] font-semibold",
          role === "N" ? "bg-foreground text-background" : "border border-border bg-card text-foreground",
        )}
        title={role === "N" ? "Nurse" : "Doctor"}
      >
        {role}
      </span>
      {name ? (
        <span className="truncate">{name}</span>
      ) : (
        <span className="text-muted-foreground/80">Unassigned</span>
      )}
    </span>
  );
}

/** Phones and tablets: one link card per booking, with the status a coordinator scans for up top. */
function BookingCard({ booking: b, flashing }: { booking: Booking; flashing: boolean }) {
  const nurse = populated(b.nurse);
  const doctor = populated(b.doctor);
  const team = [nurse?.name, doctor?.name].filter(Boolean).join(" · ");
  const paid = b.payment?.status;
  return (
    <li>
      <Link
        href={`/admin/bookings/${b.id}`}
        className={cn(
          "flex min-h-18 flex-col gap-1 px-4 py-3.5 transition-colors duration-700 outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-ring focus-visible:-outline-offset-2",
          flashing && "bg-muted duration-150",
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <BookingCode code={b.code} />
          <StatusBadge status={b.status} size="sm" />
        </span>
        <span className="text-[15px] font-semibold">
          {b.patient.name}
          <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
            {b.patient.age}
            {b.patient.gender?.[0]?.toUpperCase()}
          </span>
        </span>
        <span className="flex items-center gap-1 text-[13px] text-muted-foreground tabular">
          {b.slot === EXPRESS_SLOT && <Zap className="size-3 fill-current text-foreground" aria-hidden />}
          {dayLabel(b.scheduledDate)}, {b.slot === EXPRESS_SLOT ? "Earliest" : slotLabel(b.slot)} · {b.address.area}
        </span>
        <span className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className={cn("min-w-0 truncate", team ? "text-foreground" : "text-saffron")}>
            {team || "Needs a care team"}
          </span>
          <span className="shrink-0 tabular">
            <span className="font-semibold">{formatINR(b.amount)}</span>
            <span className={cn("ml-1.5 text-xs", paid === "paid" || paid === "refunded" ? "text-muted-foreground" : "text-saffron")}>
              {paid === "paid" ? "Paid" : paid === "refunded" ? "Refunded" : "Unpaid"}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function BookingsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = parseStatus(params.get("status") ?? params.get("view"));
  const date = params.get("date") ?? "";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { bookings, error, reload, flashing } = useAdminBookings();

  const setParams = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("view");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || (k === "status" && v === "all")) sp.delete(k);
      else sp.set(k, v);
    }
    if (!("page" in patch)) sp.delete("page");
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, live: 0, open: 0 };
    for (const b of bookings ?? []) {
      if (date && b.scheduledDate !== date) continue;
      c.all++;
      c[b.status] = (c[b.status] ?? 0) + 1;
      if (matchesStatus(b, "live")) c.live++;
      if (matchesStatus(b, "open")) c.open++;
    }
    return c;
  }, [bookings, date]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return sortBookings(
      (bookings ?? []).filter((b) => {
        if (!matchesStatus(b, status)) return false;
        if (date && b.scheduledDate !== date) return false;
        if (!q) return true;
        const c = customerOf(b);
        const hay = [b.code, b.patient.name, c?.name, b.address.area].join(" ").toLowerCase();
        if (hay.includes(q)) return true;
        return qDigits.length >= 3 && (c?.phone ?? "").includes(qDigits);
      }),
    );
  }, [bookings, status, date, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = status !== "all" || date || query;

  return (
    <>
      <PageHeader
        title="Bookings"
        description={
          bookings
            ? `${counts.all} bookings${date ? ` ${/^(Today|Tomorrow|Yesterday)$/.test(dayLabel(date)) ? dayLabel(date).toLowerCase() : `on ${dayLabel(date)}`}` : ""} · ${counts.confirmed ?? 0} need assignment · ${counts.live} live now`
            : "Every booking, updated live"
        }
      />

      <div className="mb-4 flex flex-col gap-2.5 md:flex-row md:items-center">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            if (current !== 1) setParams({ page: null });
          }}
          placeholder="Search code, name or phone"
          className="md:w-80"
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={status} onValueChange={(v) => setParams({ status: (v as string) ?? "all" })}>
            <SelectTrigger className="h-9 min-w-48 bg-card" aria-label="Filter by status">
              <SelectValue>
                {(v: StatusFilter) => (
                  <span className="flex items-center gap-2">
                    {v in STATUS_META && <span className={cn("size-2 rounded-full bg-current", STATUS_META[v as BookingStatus].dotClass)} />}
                    {statusFilterLabel(v)}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-56">
              <SelectGroup>
                {VIEWS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    <span className="flex w-full items-center gap-2">
                      <span className="size-2 shrink-0" />
                      <span className="flex-1">{v.label}</span>
                      <span className="text-xs text-muted-foreground tabular">{counts[v.value] ?? 0}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel className="pl-1.5">By status</SelectLabel>
                {BOOKING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex w-full items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full bg-current", STATUS_META[s].dotClass)} />
                      <span className="flex-1">{STATUS_META[s].staffLabel}</span>
                      <span className="text-xs text-muted-foreground tabular">{counts[s] ?? 0}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className={cn("h-9 min-w-40 justify-start bg-card font-normal", !date && "text-muted-foreground")} />
              }
            >
              <CalendarDays className="text-muted-foreground" />
              {date ? `${dayLabel(date)}${dayLabel(date).includes(",") ? "" : `, ${format(parseISO(date), "d MMM")}`}` : "Any date"}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date ? parseISO(date) : undefined}
                defaultMonth={date ? parseISO(date) : new Date()}
                onSelect={(d) => {
                  setParams({ date: d ? format(d, "yyyy-MM-dd") : null });
                  setCalendarOpen(false);
                }}
              />
              <div className="flex gap-2 border-t border-border p-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setParams({ date: todayISO() }); setCalendarOpen(false); }}>
                  Today
                </Button>
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setParams({ date: null }); setCalendarOpen(false); }}>
                  Any date
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button
              variant="ghost"
              className="h-9 text-muted-foreground"
              onClick={() => {
                setQuery("");
                router.replace(pathname, { scroll: false });
              }}
            >
              <X />
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-soft">
        {!bookings ? (
          <TableSkeleton rows={10} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title={hasFilters ? "No bookings match these filters" : "No bookings yet"}
            body={hasFilters ? "Try another status or date, or clear the search." : "New bookings appear here the moment they are paid."}
            className="py-16"
          />
        ) : (
          <>
            <ul className="divide-y divide-border/70 lg:hidden">
              {rows.map((b) => (
                <BookingCard key={b.id} booking={b} flashing={flashing.has(b.id)} />
              ))}
            </ul>
            <Table className="hidden min-w-[880px] lg:table">
              <TableHeader className="bg-muted/40 [&_tr]:border-border/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 pl-5 text-xs font-medium text-muted-foreground">Booking</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Patient</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Schedule</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Tests</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Care team</TableHead>
                  <TableHead className="pr-5 text-xs font-medium text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => {
                  const by = bookedByLabel(b);
                  const nurse = populated(b.nurse);
                  const doctor = populated(b.doctor);
                  const href = `/admin/bookings/${b.id}`;
                  return (
                    <TableRow
                      key={b.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a")) return;
                        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
                        else router.push(href);
                      }}
                      className={cn(
                        "cursor-pointer border-border/70 transition-colors duration-700",
                        flashing.has(b.id) && "bg-muted duration-150",
                      )}
                    >
                      <TableCell className="py-3 pl-5">
                        <Link href={href} className="rounded-sm outline-none hover:underline focus-visible:underline focus-ring">
                          <BookingCode code={b.code} />
                        </Link>
                        <div className="mt-0.5 text-xs text-muted-foreground">{b.address.area}</div>
                      </TableCell>
                      <TableCell className="max-w-56 py-3">
                        <div className="truncate text-[13px] font-medium">
                          {b.patient.name}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {b.patient.age}
                            {b.patient.gender?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {by ?? formatPhone(customerOf(b)?.phone)}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className={cn("text-[13px]", dayLabel(b.scheduledDate) === "Today" && "font-medium")}>
                          {dayLabel(b.scheduledDate)}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground tabular">
                          {b.slot === EXPRESS_SLOT && <Zap className="size-3 fill-current text-foreground" />}
                          {b.slot === EXPRESS_SLOT ? "Earliest" : slotLabel(b.slot)}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <ServiceChips codes={b.serviceCodes} max={2} className="flex-nowrap" />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="text-[13px] font-semibold tabular">{formatINR(b.amount)}</div>
                        <div
                          className={cn(
                            "text-[11px]",
                            b.payment?.status === "paid" ? "text-muted-foreground" : b.payment?.status === "refunded" ? "text-muted-foreground" : "text-saffron",
                          )}
                        >
                          {b.payment?.status === "paid" ? "Paid" : b.payment?.status === "refunded" ? "Refunded" : "Unpaid"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-52 py-3">
                        <StaffMini name={nurse?.name} role="N" />
                        <StaffMini name={doctor?.name} role="D" />
                      </TableCell>
                      <TableCell className="py-3 pr-5">
                        <StatusBadge status={b.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
        {bookings && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
            <span className="tabular">
              Showing {(current - 1) * PAGE_SIZE + 1}-{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous page"
                  disabled={current <= 1}
                  onClick={() => setParams({ page: String(current - 1) })}
                >
                  <ChevronLeft />
                </Button>
                <span className="px-1.5 font-medium text-foreground tabular">
                  {current} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next page"
                  disabled={current >= pages}
                  onClick={() => setParams({ page: String(current + 1) })}
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
