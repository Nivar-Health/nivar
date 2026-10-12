"use client";

import Link from "next/link";
import { ClipboardPen, HeartPulse, Radio, Waves, type LucideIcon } from "lucide-react";
import { STATUS_META, formatDateTime, formatINR, relative } from "@/lib/format";
import { populated, type Booking, type BookingStatus, type TimelineEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, Panel } from "./admin-ui";
import { useNow } from "./use-admin-data";

export interface FeedItem {
  key: string;
  bookingId: string;
  code: string;
  actor: string;
  text: string;
  at: string;
  status: BookingStatus;
  icon?: LucideIcon;
  live?: boolean;
}

const METHOD: Record<string, string> = { upi: "UPI", card: "card", netbanking: "netbanking", cash: "cash" };

function first(name?: string | null) {
  return (name ?? "").trim();
}

/** Staff-facing sentence for a status change, e.g. "started the trip to Koramangala". */
function describe(b: Booking, entry: TimelineEntry): { actor: string; text: string } {
  const nurse = populated(b.nurse)?.name;
  const doctor = populated(b.doctor)?.name;
  const by = first(entry.by);
  const area = b.address?.area;
  switch (entry.status) {
    case "pending_payment":
      return {
        actor: by || b.patient.name,
        text: b.patient.name === by || !by ? "placed a booking" : `booked a visit for ${b.patient.name}`,
      };
    case "confirmed":
      return {
        actor: by || b.patient.name,
        text: `paid ${formatINR(b.amount)}${b.payment?.method ? ` via ${METHOD[b.payment.method]}` : ""}, needs a care team`,
      };
    case "assigned":
      return {
        actor: by || "Admin",
        text: nurse && doctor ? `assigned ${nurse} and ${doctor}` : "assigned the care team",
      };
    case "en_route":
      return { actor: by || nurse || "Nurse", text: `started the trip${area ? ` to ${area}` : ""}` };
    case "arrived":
      return { actor: by || nurse || "Nurse", text: `arrived at ${b.patient.name}'s home` };
    case "testing":
      return { actor: by || nurse || "Nurse", text: "started the tests" };
    case "consult":
      return { actor: by || nurse || "Nurse", text: `started the video consult${doctor ? ` with ${doctor}` : ""}` };
    case "reporting":
      return { actor: by || doctor || "Doctor", text: "ended the consult, writing the report" };
    case "completed":
      return { actor: by || doctor || "Doctor", text: "published the report" };
    case "cancelled":
      return { actor: by || "Customer", text: `cancelled the booking${entry.note && !/cancel/i.test(entry.note) ? `: ${entry.note}` : ""}` };
  }
}

function fromTimeline(b: Booking, entry: TimelineEntry): FeedItem {
  const { actor, text } = describe(b, entry);
  return {
    key: `${b.id}:${entry.status}:${entry.at}`,
    bookingId: b.id,
    code: b.code,
    actor,
    text,
    at: entry.at,
    status: entry.status,
  };
}

/** The most recent status changes across all bookings, newest first. */
export function seedFeed(bookings: Booking[], limit = 14): FeedItem[] {
  const items: FeedItem[] = [];
  for (const b of bookings) for (const e of b.timeline ?? []) items.push(fromTimeline(b, e));
  return items.sort((a, z) => z.at.localeCompare(a.at)).slice(0, limit);
}

/** Feed items for one live update: new timeline entries, or captured clinical data. */
export function feedFromUpdate(next: Booking, prev: Booking | undefined): FeedItem[] {
  const seen = new Set((prev?.timeline ?? []).map((e) => `${e.status}:${e.at}`));
  const fresh = (next.timeline ?? []).filter((e) => !seen.has(`${e.status}:${e.at}`));
  const items = (prev ? fresh : fresh.slice(-1)).map((e) => ({ ...fromTimeline(next, e), live: true }));
  if (prev && next.status === prev.status) {
    const nurse = populated(next.nurse)?.name ?? "Nurse";
    const capture = (at: string | undefined, prevAt: string | undefined, text: string, icon: LucideIcon) => {
      if (at && at !== prevAt)
        items.push({
          key: `${next.id}:${text}:${at}`,
          bookingId: next.id,
          code: next.code,
          actor: nurse,
          text,
          at,
          status: next.status,
          icon,
          live: true,
        });
    };
    capture(next.vitals?.recordedAt, prev.vitals?.recordedAt, "recorded vitals", HeartPulse);
    capture(next.ecg?.capturedAt, prev.ecg?.capturedAt, "captured a 10 s ECG", Radio);
    capture(next.stethoscope?.capturedAt, prev.stethoscope?.capturedAt, "captured heart sounds", Waves);
    const doctor = populated(next.doctor)?.name ?? "Doctor";
    if (next.report?.diagnosis && !prev.report?.diagnosis)
      items.push({
        key: `${next.id}:draft:${next.updatedAt}`,
        bookingId: next.id,
        code: next.code,
        actor: doctor,
        text: "started drafting the report",
        at: next.updatedAt,
        status: next.status,
        icon: ClipboardPen,
        live: true,
      });
  }
  return items;
}

export function mergeFeed(current: FeedItem[], incoming: FeedItem[], limit = 40): FeedItem[] {
  const keys = new Set(current.map((i) => i.key));
  const add = incoming.filter((i) => !keys.has(i.key));
  if (!add.length) return current;
  return [...add, ...current].sort((a, z) => z.at.localeCompare(a.at)).slice(0, limit);
}

export function ActivityFeed({ items, loading, className }: { items: FeedItem[]; loading: boolean; className?: string }) {
  useNow(20_000);
  return (
    <Panel
      title="Live activity"
      description="Every booking update, as it happens"
      icon={<span className="live-dot size-2 text-signal" />}
      className={className}
      bodyClassName="relative overflow-hidden"
    >
      {!loading && items.length === 0 ? (
        <EmptyState title="No activity yet" body="Booking updates will stream in here." />
      ) : (
        <ol className="absolute inset-0 overflow-y-auto px-5 py-3 [scrollbar-width:thin]">
          {items.map((item, idx) => {
            const meta = STATUS_META[item.status];
            const Icon = item.icon ?? meta.icon;
            const last = idx === items.length - 1;
            return (
              <li key={item.key} className={cn("relative flex gap-3", item.live && "animate-fade-up")}>
                {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[13px] w-px bg-border" />}
                <span
                  className={cn(
                    "relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset [&_svg]:size-3.5",
                    meta.badgeClass,
                  )}
                >
                  <Icon aria-hidden />
                </span>
                <Link
                  href={`/admin/bookings/${item.bookingId}`}
                  className="group -mx-1.5 mb-1 min-w-0 flex-1 rounded-md px-1.5 pt-1 pb-2.5 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <p className="text-[13px] leading-snug text-foreground/90">
                    <span className="mr-1.5 font-mono text-[11.5px] font-semibold text-foreground">{item.code}</span>
                    <span className="font-semibold text-foreground">{item.actor}</span> {item.text}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground" title={formatDateTime(item.at)}>
                    {relative(item.at)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
