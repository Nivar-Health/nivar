"use client";

import { useMemo, useState } from "react";
import { Contact, Inbox, MapPin, Phone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/user-menu";
import { formatDate, formatDateTime, formatINR, formatPhone, relative } from "@/lib/format";
import { refId, type CustomerRow, type Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, SearchInput, TableSkeleton } from "./admin-ui";
import { useAdminBookings, useAdminResource, useNow } from "./use-admin-data";

type Customer = CustomerRow & { lastBookingAt?: string | null };

const headCls = "text-xs font-medium text-muted-foreground";

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-soft">{children}</div>;
}

function Footer({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <div className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground tabular">
      {shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`}
    </div>
  );
}

export function CustomersPage() {
  const { data, error, reload } = useAdminResource<{ customers: Customer[] }>("/admin/customers", 2000);
  const { bookings } = useAdminBookings();
  const [query, setQuery] = useState("");
  useNow(60_000);

  const spend = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookings ?? []) {
      if (b.payment?.status !== "paid" || b.status === "cancelled") continue;
      const id = refId(b.customer);
      if (id) m.set(id, (m.get(id) ?? 0) + b.amount);
    }
    return m;
  }, [bookings]);

  const all = data?.customers ?? [];
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const rows = all
    .filter((c) => {
      if (!q) return true;
      const hay = [c.name, c.email, ...(c.addresses ?? []).map((a) => a.area)].join(" ").toLowerCase();
      return hay.includes(q) || (qDigits.length >= 3 && (c.phone ?? "").includes(qDigits));
    })
    .sort((a, b) => (b.lastBookingAt ?? "").localeCompare(a.lastBookingAt ?? ""));
  const totalSpend = [...spend.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Customers"
        description={
          data
            ? `${all.length} customers · ${all.filter((c) => c.bookingCount > 1).length} repeat${bookings ? ` · ${formatINR(totalSpend)} lifetime revenue` : ""}`
            : "Everyone who has signed up to book a visit"
        }
      />
      <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone or area" className="mb-4 md:w-80" />
      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}
      <TableShell>
        {!data ? (
          <TableSkeleton rows={7} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Contact />} title={q ? "No customers match" : "No customers yet"} className="py-14" />
        ) : (
          <>
            <Table className="min-w-[820px]">
              <TableHeader className="bg-muted/40 [&_tr]:border-border/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(headCls, "pl-5")}>Customer</TableHead>
                  <TableHead className={headCls}>Phone</TableHead>
                  <TableHead className={headCls}>Area</TableHead>
                  <TableHead className={cn(headCls, "text-right")}>Bookings</TableHead>
                  <TableHead className={cn(headCls, "text-right")}>Lifetime value</TableHead>
                  <TableHead className={headCls}>Last booking</TableHead>
                  <TableHead className={cn(headCls, "pr-5")}>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const home = c.addresses?.[0];
                  const extra = (c.addresses?.length ?? 0) - 1;
                  return (
                    <TableRow key={c.id} className="border-border/70 hover:bg-muted/30">
                      <TableCell className="py-3 pl-5">
                        <span className="flex items-center gap-2.5">
                          <UserAvatar name={c.name} size="sm" className="[&_[data-slot=avatar-fallback]]:text-[10px]" />
                          <span className="leading-tight">
                            <span className="block text-[13px] font-medium">{c.name || "Unnamed"}</span>
                            {c.gender && <span className="block text-xs text-muted-foreground capitalize">{c.gender}</span>}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-[13px] tabular">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="hover:underline">
                            {formatPhone(c.phone)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-[13px]">
                        {home ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-muted-foreground" />
                            {home.area}
                            {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No address</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular",
                            c.bookingCount > 1 ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {c.bookingCount}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right text-[13px] font-semibold tabular">
                        {bookings ? formatINR(spend.get(c.id) ?? 0) : ""}
                      </TableCell>
                      <TableCell className="py-3 text-[13px]" title={c.lastBookingAt ? formatDateTime(c.lastBookingAt) : undefined}>
                        {c.lastBookingAt ? relative(c.lastBookingAt) : <span className="text-muted-foreground">Never</span>}
                      </TableCell>
                      <TableCell className="py-3 pr-5 text-[13px] text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Footer shown={rows.length} total={all.length} noun="customers" />
          </>
        )}
      </TableShell>
    </>
  );
}

export function LeadsPage() {
  const { data, error, reload } = useAdminResource<{ leads: Lead[] }>("/admin/leads");
  const [query, setQuery] = useState("");
  useNow(60_000);
  const all = data?.leads ?? [];
  const q = query.trim().toLowerCase();
  const rows = all.filter((l) => !q || [l.name, l.phone, l.city, l.message].join(" ").toLowerCase().includes(q));
  const outside = all.filter((l) => !/bangalore|bengaluru/i.test(l.city)).length;

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          data
            ? `${all.length} callback requests from the website${outside ? ` · ${outside} from outside Bangalore` : ""}`
            : "Callback requests from the website"
        }
      />
      <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone, city or message" className="mb-4 md:w-80" />
      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}
      <TableShell>
        {!data ? (
          <TableSkeleton rows={6} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Inbox />} title={q ? "No leads match" : "No leads yet"} body={q ? undefined : "Requests from the landing page form land here."} className="py-14" />
        ) : (
          <>
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/40 [&_tr]:border-border/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(headCls, "pl-5")}>Name</TableHead>
                  <TableHead className={headCls}>Phone</TableHead>
                  <TableHead className={headCls}>City</TableHead>
                  <TableHead className={headCls}>Message</TableHead>
                  <TableHead className={cn(headCls, "pr-5 text-right")}>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => {
                  const local = /bangalore|bengaluru/i.test(l.city);
                  return (
                    <TableRow key={l.id} className="border-border/70 align-top hover:bg-muted/30">
                      <TableCell className="py-3 pl-5 text-[13px] font-medium">{l.name}</TableCell>
                      <TableCell className="py-3 text-[13px] tabular">
                        <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 hover:underline">
                          <Phone className="size-3.5 text-muted-foreground" />
                          {formatPhone(l.phone)}
                        </a>
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={cn(
                            "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                            local ? "bg-secondary text-secondary-foreground" : "bg-amber-50 text-amber-800",
                          )}
                        >
                          {l.city}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md py-3 text-[13px] whitespace-normal text-foreground/85">
                        {l.message || <span className="text-muted-foreground">No message</span>}
                      </TableCell>
                      <TableCell className="py-3 pr-5 text-right text-[13px] text-muted-foreground" title={formatDateTime(l.createdAt)}>
                        {relative(l.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Footer shown={rows.length} total={all.length} noun="leads" />
          </>
        )}
      </TableShell>
    </>
  );
}
