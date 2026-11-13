"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MessageCircle, Phone, PhoneIncoming, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dayLabel, formatDateTime, formatPhone, relative } from "@/lib/format";
import { phoneDigits } from "@/lib/phone";
import { SITE } from "@/lib/site-facts";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, SearchInput, TableSkeleton } from "./admin-ui";
import { useAdminResource, useNow } from "./use-admin-data";

/** New requests arrive without a live event, so the inbox asks again this often while it is on screen. */
const REFRESH_MS = 60_000;

const headCls = "text-xs font-medium text-muted-foreground";

interface Request {
  forWhom: string | null;
  topic: string | null;
  language: string | null;
  note: string;
}

/**
 * The public callback form sends "For: …", "Asking about: …" and "Preferred language for the call: …"
 * as leading lines, then the visitor's own note. Only leading lines are read as labels, so a note can
 * say anything; an older free-text request is all note.
 */
const LABELS: { prefix: RegExp; key: Exclude<keyof Request, "note"> }[] = [
  { prefix: /^for:\s*/i, key: "forWhom" },
  { prefix: /^asking about:\s*/i, key: "topic" },
  { prefix: /^(preferred )?language( for the call)?:\s*/i, key: "language" },
];

function parseRequest(message: string | undefined): Request {
  const out: Request = { forWhom: null, topic: null, language: null, note: "" };
  const lines = (message ?? "").split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    const label = LABELS.find((l) => l.prefix.test(line) && out[l.key] === null);
    if (!label) break;
    out[label.key] = line.replace(label.prefix, "").trim() || null;
  }
  out.note = lines.slice(i).join("\n").trim();
  return out;
}

/** "For a parent"; the form's "Myself" is the caller, so it reads "For themselves". */
function forLabel(forWhom: string): string {
  return /^myself$/i.test(forWhom) ? "For themselves" : `For ${forWhom.charAt(0).toLowerCase()}${forWhom.slice(1)}`;
}

const inArea = (city: string) => /^\s*(bengaluru|bangalore)/i.test(city);

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium",
        tone === "plain" ? "bg-muted text-foreground" : "bg-background text-foreground ring-1 ring-saffron/50 ring-inset",
      )}
    >
      {children}
    </span>
  );
}

function RequestChips({ lead, request }: { lead: Lead; request: Request }) {
  const chips = [
    request.forWhom && <Chip key="for">{forLabel(request.forWhom)}</Chip>,
    request.language && <Chip key="lang">Call in {request.language}</Chip>,
    lead.city && !inArea(lead.city) && (
      <Chip key="city" tone="warn">
        <MapPin className="size-3.5 text-saffron" aria-hidden /> Outside our area: {lead.city}
      </Chip>
    ),
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

function RequestNote({ request, className }: { request: Request; className?: string }) {
  if (request.note) return <p className={cn("leading-relaxed whitespace-pre-line text-foreground/90", className)}>{request.note}</p>;
  if (!request.topic && !request.forWhom) return <p className={cn("text-muted-foreground", className)}>No note</p>;
  return null;
}

/** Call and WhatsApp, at a size a thumb can hit. Hidden when the number is not a usable mobile. */
function ContactActions({ lead, className }: { lead: Lead; className?: string }) {
  const digits = phoneDigits(lead.phone);
  if (digits.length !== 10) return null;
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <a
        href={`tel:+91${digits}`}
        aria-label={`Call ${lead.name} on ${formatPhone(digits)}`}
        className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-4 font-semibold")}
      >
        <Phone /> Call
      </a>
      <a
        href={`https://wa.me/91${digits}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp ${lead.name} on ${formatPhone(digits)} (opens WhatsApp)`}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-xl px-4 font-semibold")}
      >
        <MessageCircle /> WhatsApp
      </a>
    </div>
  );
}

function RequestCard({ lead }: { lead: Lead }) {
  const request = parseRequest(lead.message);
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-base font-semibold break-words">{lead.name}</p>
        <time
          dateTime={lead.createdAt}
          title={formatDateTime(lead.createdAt)}
          className="shrink-0 text-sm text-muted-foreground"
        >
          {relative(lead.createdAt)}
        </time>
      </div>
      {request.topic && (
        <p className="text-[15px] leading-snug">
          <span className="text-muted-foreground">Asking about </span>
          <span className="font-semibold">{request.topic}</span>
        </p>
      )}
      <RequestChips lead={lead} request={request} />
      <RequestNote request={request} className="text-[15px]" />
      <p className="text-sm text-muted-foreground tabular-nums">{formatPhone(lead.phone)}</p>
      <ContactActions lead={lead} />
    </li>
  );
}

export function CallbacksPage() {
  const { data, error, reload, fetchedAt } = useAdminResource<{ leads: Lead[] }>("/admin/leads");
  const [query, setQuery] = useState("");
  useNow(REFRESH_MS);

  // Ask again every minute while the page is visible, and as soon as it is shown again.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const id = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  // Say when a request arrives that was not there before (never for the first load).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.leads.map((l) => l.id));
    if (seen.current) {
      const fresh = data.leads.filter((l) => !seen.current?.has(l.id));
      if (fresh.length === 1) toast(`New callback request from ${fresh[0].name}`);
      else if (fresh.length > 1) toast(`${fresh.length} new callback requests`);
    }
    seen.current = ids;
  }, [data]);

  const all = data?.leads ?? [];
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const rows = all.filter((l) => {
    if (!q) return true;
    if ([l.name, l.city, l.message].join(" ").toLowerCase().includes(q)) return true;
    return qDigits.length >= 3 && l.phone.replace(/\D/g, "").includes(qDigits);
  });
  const todayCount = all.filter((l) => dayLabel(l.createdAt) === "Today").length;

  return (
    <>
      <PageHeader
        title="Callback requests"
        description={
          <>
            {data && (
              <span className="block">
                {all.length} {all.length === 1 ? "request" : "requests"} · {todayCount} today
              </span>
            )}
            <span className="block">
              We call back within {SITE.callbackWithin}, {SITE.hours.inSentence}.
            </span>
          </>
        }
        actions={
          <>
            {fetchedAt && (
              <span className="text-xs text-muted-foreground" role="status">
                Updated {relative(fetchedAt)}
              </span>
            )}
            <Button variant="outline" onClick={reload} className="rounded-xl">
              <RotateCw /> Refresh
            </Button>
          </>
        }
      />
      <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone or message" className="mb-4 md:w-80" />
      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-soft">
        {!data ? (
          <TableSkeleton rows={6} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<PhoneIncoming />}
            title={q ? "No requests match" : "No callback requests yet"}
            body={q ? undefined : "Requests from the website's callback form appear here."}
            className="py-14"
          />
        ) : (
          <>
            {/* Phones: one card per request, the call one tap away. */}
            <ul className="divide-y divide-border/70 md:hidden">
              {rows.map((l) => (
                <RequestCard key={l.id} lead={l} />
              ))}
            </ul>
            <Table className="hidden md:table">
              <TableHeader className="bg-muted/40 [&_tr]:border-border/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(headCls, "pl-5")}>Name</TableHead>
                  <TableHead className={headCls}>Request</TableHead>
                  <TableHead className={headCls}>Received</TableHead>
                  <TableHead className={cn(headCls, "pr-5")}>
                    <span className="sr-only">Contact</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => {
                  const request = parseRequest(l.message);
                  return (
                    <TableRow key={l.id} className="border-border/70 align-top hover:bg-muted/30">
                      <TableCell className="py-3.5 pl-5">
                        <span className="block text-sm font-semibold">{l.name}</span>
                        <span className="block text-[13px] text-muted-foreground tabular-nums">{formatPhone(l.phone)}</span>
                      </TableCell>
                      <TableCell className="py-3.5 whitespace-normal">
                        <div className="flex max-w-xl flex-col gap-2 text-sm">
                          {request.topic && (
                            <p>
                              <span className="text-muted-foreground">Asking about </span>
                              <span className="font-semibold">{request.topic}</span>
                            </p>
                          )}
                          <RequestChips lead={l} request={request} />
                          <RequestNote request={request} />
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-[13px] text-muted-foreground">
                        <time dateTime={l.createdAt} title={formatDateTime(l.createdAt)}>
                          {relative(l.createdAt)}
                        </time>
                      </TableCell>
                      <TableCell className="py-3 pr-5">
                        <ContactActions lead={l} className="w-60" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground tabular">
              {rows.length === all.length ? `${all.length} requests` : `${rows.length} of ${all.length} requests`}
            </div>
          </>
        )}
      </div>
    </>
  );
}
