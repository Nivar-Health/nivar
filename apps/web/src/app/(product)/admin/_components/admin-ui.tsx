"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import type { Booking, ServiceCode } from "@/lib/types";
import { populated } from "@/lib/types";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-tight font-medium tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bordered white surface with an optional header row. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  icon,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-[14px] border border-border bg-card shadow-soft", className)}>
      {(title || action) && (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground [&_svg]:size-4">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="truncate text-[15px] leading-5 font-semibold">{title}</h2>}
              {description && <p className="truncate text-xs leading-4 text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  className,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {icon && (
        <span className="mb-3 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 px-5 py-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-16" : c === 1 ? "w-40" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 bg-card pr-8 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Small grey label used above values in detail cards. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium text-muted-foreground">{children}</div>;
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const SERVICE_SHORT: Record<ServiceCode, string> = {
  BP: "BP",
  ECG: "ECG",
  SUGAR: "Sugar",
  HR: "HR",
  SPO2: "SpO2",
  STETH: "Steth",
  CONSULT: "Consult",
};

export function ServiceChips({ codes, max = 4, className }: { codes: ServiceCode[]; max?: number; className?: string }) {
  const shown = codes.slice(0, max);
  const rest = codes.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {shown.map((c) => (
        <span
          key={c}
          className="inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-[11px] font-medium text-foreground/80"
        >
          {SERVICE_SHORT[c] ?? c}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex h-5 items-center rounded-md px-1 text-[11px] font-medium text-muted-foreground">
          +{rest}
        </span>
      )}
    </span>
  );
}

export function BookingCode({ code, className }: { code: string; className?: string }) {
  return <span className={cn("font-mono text-[12.5px] font-semibold tracking-tight text-foreground", className)}>{code}</span>;
}

export function customerOf(b: Booking) {
  return populated(b.customer);
}

/** Compact person: avatar initials + name + subtitle. */
export function PersonCell({
  name,
  sub,
  size = "sm",
  muted,
}: {
  name?: string | null;
  sub?: ReactNode;
  size?: "sm" | "default";
  muted?: ReactNode;
}) {
  if (!name) return <span className="text-xs text-muted-foreground">{muted ?? "Not assigned"}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar name={name} size={size} className={size === "sm" ? "[&_[data-slot=avatar-fallback]]:text-[10px]" : ""} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-medium">{name}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}

/** "Rohan Gupta" for self bookings, or "Rohan Gupta for Sunita (parent)". */
export function bookedByLabel(b: Booking): string | null {
  const c = customerOf(b);
  if (!c) return null;
  if (c.name === b.patient.name) return null;
  return `Booked by ${c.name}`;
}
