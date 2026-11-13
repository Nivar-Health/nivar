import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* Buttons: one shape (pill), one focus recipe, 44px default target          */
/* ------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "accent" | "whatsapp" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

/* Press (mobile addendum M2): scale .97 plus each variant's tint, 90ms in and 180ms out; tint only under
   reduced motion. Tailwind 4's scale and translate utilities set the `scale` and `translate` properties,
   so those are the ones transitioned. Forced colours drop every fill, so each button keeps a ButtonText
   frame there (border-box, so the fixed heights don't move). */
const BUTTON_BASE =
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,translate,scale] duration-180 ease-standard active:scale-[0.97] active:duration-90 motion-reduce:active:scale-100 focus-ring disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0 forced-colors:border forced-colors:border-[ButtonText]";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  /** 40px visual, 44px hit area (forced colours' frame included). Nav only. */
  sm: "h-10 px-4 text-sm before:absolute before:inset-x-0 before:-inset-y-0.5 forced-colors:before:-inset-y-[calc(0.125rem+1px)]",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_rgb(1_76_94/0.7)] hover:-translate-y-px hover:bg-primary-hover active:translate-y-0 active:bg-primary-active",
  /** Amber, dark text (6.02:1). The main call to action only, so it stands out. */
  accent:
    "bg-marigold text-ink shadow-[0_10px_24px_-12px_rgb(176_104_10/0.7)] hover:-translate-y-px hover:bg-marigold-hover active:translate-y-0 active:bg-marigold-hover",
  /** WhatsApp green with dark text (6.36:1); white on this green fails contrast. */
  whatsapp:
    "bg-whatsapp text-whatsapp-ink shadow-[0_10px_24px_-12px_rgb(7_94_60/0.6)] hover:-translate-y-px hover:bg-whatsapp-hover active:translate-y-0 active:bg-whatsapp-hover",
  secondary:
    "border border-border-strong bg-card text-foreground shadow-xs hover:-translate-y-px hover:border-input hover:bg-card active:translate-y-0 active:bg-aqua",
  ghost: "text-foreground hover:bg-muted active:bg-muted",
  /** Light pill for deep pine panels. */
  inverse: "bg-on-pine text-ink hover:bg-white active:bg-aqua",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string, size: ButtonSize = "md") {
  return cn(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className);
}

/**
 * The callback form. A same-page hash, so a plain <a> keeps the query (?utm_source=…), scrolls natively
 * and still jumps when the URL already ends in #callback. Everything that uses it renders on / only.
 */
export const CALLBACK_HREF = "#callback";

/* ------------------------------------------------------------------------- */
/* Scroll reveal (server-safe helper; the observer lives in reveal.tsx)      */
/* ------------------------------------------------------------------------- */

/** Spread on an element to fade it up once when it scrolls into view. `i` staggers by 70ms (max 6). */
export function revealProps(i = 0) {
  return { "data-nv-reveal": "", style: { "--i": Math.min(Math.max(i, 0), 6) } as CSSProperties };
}

/* ------------------------------------------------------------------------- */
/* Layout                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Page-width container: 1200px content, 20px gutters on phones, 24px from sm. In landscape the gutters
 * grow to clear the notch and the rounded corners (the page runs edge to edge, viewportFit "cover").
 */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1248px] pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type SectionTone = "default" | "white" | "wash" | "aqua";

const SECTION_TONE: Record<SectionTone, string> = {
  default: "bg-background",
  white: "bg-card",
  wash: "bg-wash",
  aqua: "bg-aqua",
};

/** Section rhythm: 56px on phones, 80px from sm, 112px from lg. */
export function Section({
  id,
  tone = "default",
  titleId,
  className,
  children,
}: {
  id?: string;
  tone?: SectionTone;
  /** id of the section's h2, wired to aria-labelledby. */
  titleId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("scroll-mt-24 py-14 sm:py-20 lg:py-28", SECTION_TONE[tone], className)}
    >
      {children}
    </section>
  );
}

/** Section heading: the title and an optional lede. */
export function SectionTitle({
  title,
  lede,
  id,
  className,
}: {
  title: ReactNode;
  lede?: ReactNode;
  /** Put the same id in <Section titleId>. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <h2 id={id} className="max-w-[20ch] text-h2 text-balance text-foreground">
        {title}
      </h2>
      {lede && <p className="mt-5 max-w-[54ch] text-lede text-pretty text-foreground-2">{lede}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Small pieces                                                              */
/* ------------------------------------------------------------------------- */

/** Live indicator. Static by default; `pulse` adds the slow ring (counts as a loop). */
export function LiveDot({ className, pulse = false }: { className?: string; pulse?: boolean }) {
  return <span aria-hidden className={cn("live-dot text-signal", !pulse && "[&::after]:hidden", className)} />;
}

type PillTone = "neutral" | "inverse";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "bg-wash text-ink-2",
  inverse: "bg-white/8 text-foreground-2",
};

/** Badge / chip. 24px (sm) or 32px (md), with 14px text. */
export function Pill({
  tone = "neutral",
  size = "sm",
  className,
  children,
  ...rest
}: {
  tone?: PillTone;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className" | "children">) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "sm" ? "h-6 px-2.5 text-note" : "h-8 px-3 text-note",
        PILL_TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/** Rupee formatting with the Indian grouping. */
export function inr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
