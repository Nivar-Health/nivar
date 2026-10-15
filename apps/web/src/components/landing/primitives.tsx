import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { bookingEnabled } from "@/lib/features";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* Buttons                                                                   */
/* ------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";

const BUTTON_BASE =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-[#262626]",
  secondary: "border border-border bg-background text-foreground hover:border-[#c8c8c2] hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  inverse: "bg-white text-foreground hover:bg-[#ededea] focus-visible:ring-white focus-visible:ring-offset-[#0a0a0a]",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], className);
}

/** Booking CTAs open the booking flow, or the callback form while booking is switched off. */
export function bookHref(query?: string) {
  if (!bookingEnabled) return "#callback";
  return query ? `/app/book?${query}` : "/app/book";
}

export const BOOK_LABEL = bookingEnabled ? "Book a check-up" : "Request a callback";

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/* ------------------------------------------------------------------------- */
/* Layout                                                                    */
/* ------------------------------------------------------------------------- */

/** Page-width container: 1200px plus 24px gutters. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1248px] px-6", className)}>{children}</div>;
}

/** Vertical rhythm for a page section: 80px on mobile, 140px on desktop. */
export function Section({
  id,
  className,
  children,
  dark = false,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-16 py-20 lg:py-[140px]",
        dark && "bg-[#0a0a0a] text-white",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Section title: display type, optional second line in grey, optional lede. */
export function SectionTitle({
  title,
  grey,
  lede,
  align = "left",
  dark = false,
  className,
}: {
  title: ReactNode;
  grey?: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5", align === "center" && "items-center text-center", className)}>
      <h2
        className={cn(
          "font-display max-w-[22ch] text-[2.25rem] leading-[1.05] font-medium tracking-[-0.03em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {title}
        {grey && (
          <>
            {" "}
            <span className={dark ? "text-[#8a8a85]" : "text-muted-foreground"}>{grey}</span>
          </>
        )}
      </h2>
      {lede && (
        <p className={cn("max-w-[52ch] text-[1.0625rem] leading-[1.6]", dark ? "text-[#a3a39e]" : "text-muted-foreground")}>
          {lede}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Small pieces                                                              */
/* ------------------------------------------------------------------------- */

/** Frosted card that floats over photography. */
export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-white/60 bg-white/85 px-3.5 py-3 text-xs leading-[1.35] text-foreground shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("live-dot text-signal", className)} />;
}

/** 36px icon tile with a 1px border, for feature lists. */
export function IconTile({ className, children, dark = false }: { className?: string; children: ReactNode; dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px] border [&_svg]:size-4",
        dark ? "border-white/15 text-white" : "border-border text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold tracking-wide text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Rupee formatting with the Indian grouping. */
export function inr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
