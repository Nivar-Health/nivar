"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  CircleAlert,
  Droplet,
  Gauge,
  HeartPulse,
  RefreshCw,
  Stethoscope,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { initials } from "@/lib/format";
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

/** "BP, ECG, Sugar" from service codes, using short names when the catalog is loaded. */
export function testsLabel(codes: ServiceCode[], catalog: Catalog | null, max = 4): string {
  const map = serviceMap(catalog);
  const names = codes.map((c) => map[c]?.shortName ?? c);
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

/** Package name for a booking, if it was booked as a package. */
export function bookingTitle(booking: Pick<Booking, "packageId" | "serviceCodes">, catalog: Catalog | null): string {
  const pkg = booking.packageId ? catalog?.packages.find((p) => p.id === booking.packageId) : null;
  if (pkg) return pkg.name;
  const n = booking.serviceCodes.length;
  if (n === 1) {
    const s = serviceMap(catalog)[booking.serviceCodes[0]];
    return s?.name ?? "Home check-up";
  }
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
  /** ink: black on white text (nurses). outline: white with a 1px border (doctors). muted: grey. */
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
        tone === "ink" && "bg-foreground text-background",
        tone === "outline" && "border border-border bg-card text-foreground",
        tone === "muted" && "bg-muted text-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Friendly inline error with a retry button. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full border border-border bg-card text-danger">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="lg" onClick={onRetry} className="mt-1 rounded-full px-4">
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Rounded white surface used across the patient app. */
export function Surface({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-soft", className)} {...props}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bangalore areas (mirrors apps/api/src/lib/areas.js) for the address form
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
  netbanking: "Netbanking",
  cash: "Cash",
};
