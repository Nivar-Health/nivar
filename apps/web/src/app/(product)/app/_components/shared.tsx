"use client";

import { Fragment, useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Droplet,
  Gauge,
  HeartPulse,
  MessageCircle,
  Phone,
  PhoneIncoming,
  RefreshCw,
  Stethoscope,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { checksLabel, deviceOnIndiaTime, initials, testName } from "@/lib/format";
import { SITE } from "@/lib/site-facts";
import type { Booking, Catalog, Service, ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Catalog (cached for the tab; it rarely changes during a session)
// ---------------------------------------------------------------------------

let catalogCache: Catalog | null = null;
let catalogPromise: Promise<Catalog> | null = null;

function loadCatalog(force = false): Promise<Catalog> {
  if (force) catalogPromise = null;
  if (!catalogPromise) {
    catalogPromise = api
      .get<Catalog>("/catalog", { anonymous: true })
      .then((c) => {
        catalogCache = c;
        return c;
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export function useCatalog() {
  const [state, setState] = useState<{ catalog: Catalog | null; error: string | null }>(() => ({
    catalog: catalogCache,
    error: null,
  }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadCatalog(nonce > 0)
      .then((catalog) => {
        if (!cancelled) setState({ catalog, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ catalog: s.catalog, error: errorMessage(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    setNonce((n) => n + 1);
  }, []);

  return { ...state, loading: !state.catalog && !state.error, reload };
}

/** Lookup of services by code. */
export function serviceMap(catalog: Catalog | null): Partial<Record<ServiceCode, Service>> {
  const map: Partial<Record<ServiceCode, Service>> = {};
  for (const s of catalog?.services ?? []) map[s.code] = s;
  return map;
}

/**
 * What a booking covers, in the plain names of lib/format.ts: "Blood pressure, blood sugar +
 * doctor's video call" while the checks fit on a line or two, otherwise the count ("6 checks +
 * doctor's video call"). The video call is never counted as a check.
 */
export function testsLabel(codes: readonly ServiceCode[], max = 3): string {
  const checks = codes.filter((c) => c !== "CONSULT");
  if (checks.length === 0 || checks.length > max) return checksLabel(codes);
  const list = checks.map((c, i) => (i === 0 ? testName(c) : lowerFirst(testName(c)))).join(", ");
  return codes.includes("CONSULT") ? `${list} + doctor's video call` : list;
}

/** "Heart tracing (ECG)" -> "heart tracing (ECG)": only the first letter, so abbreviations keep their capitals. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Keeps a hyphenated word such as "check-up" on one line, so a narrow phone never shows "check-"
 * and "up" on two lines. For headings and titles. It returns several nodes: inside a flex row,
 * wrap it in one element so the words stay one item.
 */
export function Unbroken({ children }: { children: string }) {
  const parts = children.split(/(\S+-\S+)/);
  if (parts.length === 1) return children;
  return parts.map((part, i) =>
    i % 2 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * The booking page with a past booking's check-up chosen again: `?package=` (the package id) and
 * `?services=` (every test of the visit, comma-separated). The wizard reads both and drops the tests
 * the package already covers, so the format lives here and in book-wizard.tsx only.
 */
export function bookAgainHref(booking: Pick<Booking, "packageId" | "serviceCodes">): string {
  const params = new URLSearchParams();
  if (booking.packageId) params.set("package", booking.packageId);
  if (booking.serviceCodes.length) params.set("services", booking.serviceCodes.join(","));
  return params.size ? `/app/book?${params}` : "/app/book";
}

/** What a booking is called: its package's name, the plain name of a single test, or the number of tests. */
export function bookingTitle(booking: Pick<Booking, "packageId" | "serviceCodes">, catalog: Catalog | null): string {
  const pkg = booking.packageId ? catalog?.packages.find((p) => p.id === booking.packageId) : null;
  if (pkg) return pkg.name;
  const n = booking.serviceCodes.length;
  if (n === 0) return "Home check-up";
  if (n === 1) return testName(booking.serviceCodes[0]);
  return `${n} tests at home`;
}

// ---------------------------------------------------------------------------
// My bookings
// ---------------------------------------------------------------------------

export function useMyBookings() {
  const [state, setState] = useState<{ bookings: Booking[] | null; error: string | null }>({
    bookings: null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ bookings: Booking[] }>("/bookings", { signal: controller.signal })
      .then(({ bookings }) => setState({ bookings, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ bookings: s.bookings, error: errorMessage(err, "Couldn't load your bookings.") }));
      });
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    setNonce((n) => n + 1);
  }, []);

  /** Apply a live `booking:updated` payload to the list. */
  const upsert = useCallback((next: Booking) => {
    setState((s) => {
      if (!s.bookings) return s;
      const idx = s.bookings.findIndex((b) => b.id === next.id);
      if (idx === -1) return { ...s, bookings: [...s.bookings, next] };
      const copy = s.bookings.slice();
      const prev = copy[idx];
      copy[idx] = {
        ...next,
        customer: typeof next.customer === "string" ? prev.customer : next.customer,
        nurse: typeof next.nurse === "string" && prev.nurse && typeof prev.nurse === "object" && prev.nurse.id === next.nurse ? prev.nurse : next.nurse,
        doctor: typeof next.doctor === "string" && prev.doctor && typeof prev.doctor === "object" && prev.doctor.id === next.doctor ? prev.doctor : next.doctor,
      };
      return { ...s, bookings: copy };
    });
  }, []);

  return { ...state, loading: !state.bookings && !state.error, reload, upsert };
}

/** Sort key so the soonest visit comes first. */
export function scheduleKey(b: Pick<Booking, "scheduledDate" | "slot">): string {
  return `${b.scheduledDate} ${b.slot === "express" ? "00:00" : b.slot}`;
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

const SERVICE_ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  activity: Activity,
  droplet: Droplet,
  "heart-pulse": HeartPulse,
  wind: Wind,
  stethoscope: Stethoscope,
  video: Video,
};

const CODE_ICONS: Record<ServiceCode, LucideIcon> = {
  BP: Gauge,
  ECG: Activity,
  SUGAR: Droplet,
  HR: HeartPulse,
  SPO2: Wind,
  STETH: Stethoscope,
  CONSULT: Video,
};

export function serviceIcon(service: Pick<Service, "icon" | "code"> | ServiceCode): LucideIcon {
  if (typeof service === "string") return CODE_ICONS[service] ?? Activity;
  return SERVICE_ICONS[service.icon] ?? CODE_ICONS[service.code] ?? Activity;
}

/** Initials avatar for care team members. */
export function PersonAvatar({
  name,
  tone = "ink",
  size = "md",
  className,
}: {
  name: string | null | undefined;
  /** ink: white initials on the brand colour (nurses). outline: white with a 1px border (doctors). muted: grey. */
  tone?: "ink" | "outline" | "muted";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tracking-tight ring-2 ring-card",
        size === "xs" && "size-7 text-[10.5px]",
        size === "sm" && "size-9 text-xs",
        size === "md" && "size-12 text-sm",
        size === "lg" && "size-14 text-base",
        tone === "ink" && "bg-primary text-primary-foreground",
        tone === "outline" && "border border-border bg-card text-foreground",
        tone === "muted" && "bg-muted text-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Friendly inline error with a retry button. `compact` is one row for a part of a screen that
 * failed while the rest loaded.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  compact = false,
  className,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const retry = onRetry && (
    <Button variant="outline" onClick={onRetry} className="h-11 shrink-0 rounded-full px-4 text-sm font-semibold">
      <RefreshCw aria-hidden /> Try again
    </Button>
  );
  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5",
          className,
        )}
      >
        <p className="flex min-w-0 flex-1 basis-40 items-start gap-2.5 text-small text-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>{title}</span>
        </p>
        {retry}
      </div>
    );
  }
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full border border-border bg-card text-destructive">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="max-w-sm text-small text-muted-foreground">{message}</p>}
      </div>
      {retry && <div className="mt-1">{retry}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  id,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  /** Put on the heading, for a section's `aria-labelledby`. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 id={id} className="text-base font-semibold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** A quiet link beside a section title ("See all"), with a tap area a thumb can hit. */
export const sectionLinkClass =
  "relative shrink-0 rounded-sm text-sm font-semibold text-primary underline-offset-4 before:absolute before:-inset-x-3 before:-inset-y-3.5 hover:underline focus-ring";

/** Rounded white surface used across the patient app. */
export function Surface({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-soft", className)} {...props}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Times, help and the emergency line
// ---------------------------------------------------------------------------

const subscribeToNothing = () => () => {};

/**
 * Visit dates and times are India's (lib/format.ts). This says so, and only on a device set to
 * another time zone: someone booking for a parent from abroad.
 */
export function IndiaTimeNote({ className }: { className?: string }) {
  const elsewhere = useSyncExternalStore(
    subscribeToNothing,
    () => !deviceOnIndiaTime(),
    () => false,
  );
  if (!elsewhere) return null;
  return <p className={cn("text-sm text-muted-foreground", className)}>Times are India time (IST).</p>;
}

/** 112 and 108 as phone links. Each tap area grows away from the other number, so the two never touch. */
const EMERGENCY_NUMBER =
  "relative rounded-sm font-semibold text-foreground underline underline-offset-2 focus-ring before:absolute before:-inset-y-3.5";
const EMERGENCY_REACH: Record<string, string> = {
  "112": "before:-left-5 before:-right-2",
  "108": "before:-left-2 before:-right-5",
};

/** The emergency guidance from SITE, word for word, with its numbers as `tel:` links. */
export function EmergencyLine({ short = false, className }: { short?: boolean; className?: string }) {
  const text = short ? SITE.emergency.short : SITE.emergency.full;
  return (
    <p className={cn("text-small text-foreground-2", className)}>
      {text.split(/(112|108)/).map((part, i) =>
        part in EMERGENCY_REACH ? (
          <a key={i} href={`tel:${part}`} className={cn(EMERGENCY_NUMBER, EMERGENCY_REACH[part])}>
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

const HELP_ROW =
  "flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset";

function HelpRow({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note?: ReactNode }) {
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold text-foreground">{title}</span>
        {note && <span className="block text-sm text-muted-foreground">{note}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
}

/**
 * The ways to reach Nivar that exist today, all from SITE: a call and WhatsApp appear by themselves
 * once site-facts.ts has a number; until then the callback form on the public site is the way in.
 * `about` goes into the WhatsApp message ("my booking NV-1048").
 */
export function HelpCard({ about, className }: { about?: string; className?: string }) {
  const whatsapp = SITE.whatsapp
    ? `https://wa.me/${SITE.whatsapp.number}?text=${encodeURIComponent(
        about ? `Hi Nivar, I need help with ${about}.` : "Hi Nivar, I need help with my booking.",
      )}`
    : null;
  return (
    <Surface className={cn("divide-y divide-border overflow-hidden", className)}>
      {SITE.phone && (
        <a href={`tel:${SITE.phone.tel}`} className={HELP_ROW}>
          <HelpRow icon={Phone} title={`Call us on ${SITE.phone.display}`} note={SITE.hours.short} />
        </a>
      )}
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={HELP_ROW}>
          <HelpRow icon={MessageCircle} title="Message us on WhatsApp" note="Opens WhatsApp" />
        </a>
      )}
      <Link href="/#callback" className={HELP_ROW}>
        <HelpRow
          icon={PhoneIncoming}
          title="Request a callback"
          note={`${SITE.firstCall.whoCapital} calls back within ${SITE.callbackWithin}, ${SITE.hours.short}.`}
        />
      </Link>
      <Link href="/#faq" className={HELP_ROW}>
        <HelpRow icon={CircleHelp} title="Questions" note="Answers to common questions, on our website." />
      </Link>
      <EmergencyLine className="bg-muted/40 px-4 py-3.5" />
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Bangalore areas (same list as AREAS in src/server/bookings.ts) for the address form
// ---------------------------------------------------------------------------

export const BANGALORE_AREAS: { name: string; lat: number; lng: number; pincode: string }[] = [
  { name: "Indiranagar", lat: 12.9719, lng: 77.6412, pincode: "560038" },
  { name: "Koramangala", lat: 12.9352, lng: 77.6245, pincode: "560034" },
  { name: "HSR Layout", lat: 12.9116, lng: 77.6474, pincode: "560102" },
  { name: "Whitefield", lat: 12.9698, lng: 77.75, pincode: "560066" },
  { name: "Jayanagar", lat: 12.9308, lng: 77.5838, pincode: "560041" },
  { name: "JP Nagar", lat: 12.9063, lng: 77.5857, pincode: "560078" },
  { name: "Malleshwaram", lat: 13.0035, lng: 77.571, pincode: "560003" },
  { name: "BTM Layout", lat: 12.9166, lng: 77.6101, pincode: "560076" },
  { name: "Bellandur", lat: 12.9257, lng: 77.6764, pincode: "560103" },
  { name: "Hebbal", lat: 13.0358, lng: 77.597, pincode: "560024" },
];

/** Whole years since a date of birth, or null. */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

export const RELATION_LABEL: Record<string, string> = {
  self: "Self",
  parent: "Parent",
  spouse: "Spouse",
  child: "Child",
  other: "Family member",
};

export const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export const METHOD_LABEL: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  cash: "Cash",
};
