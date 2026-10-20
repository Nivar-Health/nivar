import Link from "next/link";
import type { ComponentProps, CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* Buttons: one shape (pill), one focus recipe, 44px default target          */
/* ------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "accent" | "whatsapp" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-160 ease-standard active:scale-[0.98] focus-ring disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  /** 40px visual, 44px hit area. Nav only. */
  sm: "h-10 px-4 text-sm before:absolute before:inset-x-0 before:-inset-y-0.5",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_rgb(1_76_94/0.7)] hover:-translate-y-px hover:bg-primary-hover active:translate-y-0 active:bg-primary-active",
  /** Amber, dark text (6.02:1). The main call to action only, so it stands out. */
  accent:
    "bg-marigold text-ink shadow-[0_10px_24px_-12px_rgb(176_104_10/0.7)] hover:-translate-y-px hover:bg-marigold-hover active:translate-y-0",
  /** WhatsApp green with dark text (6.36:1); white on this green fails contrast. */
  whatsapp:
    "bg-whatsapp text-whatsapp-ink shadow-[0_10px_24px_-12px_rgb(7_94_60/0.6)] hover:-translate-y-px hover:bg-whatsapp-hover active:translate-y-0",
  secondary:
    "border border-border-strong bg-card text-foreground shadow-xs hover:-translate-y-px hover:border-input hover:bg-card active:translate-y-0",
  ghost: "text-foreground hover:bg-muted",
  /** Light pill for deep pine panels. */
  inverse: "bg-on-pine text-ink hover:bg-white",
};

/** Trailing arrow that nudges 2px on hover. Add to a button or link that ends with an icon. */
export const ARROW_NUDGE =
  "[&>svg:last-child]:transition-transform [&>svg:last-child]:duration-240 hover:[&>svg:last-child]:translate-x-0.5";

export function buttonClass(variant: ButtonVariant = "primary", className?: string, size: ButtonSize = "md") {
  return cn(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className);
}

/** The callback form lives on the home page; this reaches it from every page. */
export const CALLBACK_HREF = "/#callback";

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, className, size)} {...props} />;
}

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

/** Page-width container: 1200px content, 20px gutters on phones, 24px from sm. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1248px] px-5 sm:px-6", className)}>{children}</div>;
}

export type SectionTone = "default" | "white" | "wash" | "sand" | "deep" | "aqua" | "warm" | "sky";

const SECTION_TONE: Record<SectionTone, string> = {
  default: "bg-background",
  white: "bg-card",
  wash: "bg-wash",
  sand: "bg-sand",
  deep: "theme-pine band-pond",
  aqua: "bg-aqua",
  warm: "bg-marigold-tint",
  sky: "bg-sky-tint",
};

/** Section rhythm: 80px mobile, 112px desktop. `deep` scopes the pine tokens on a pond gradient. */
export function Section({
  id,
  tone = "default",
  divider = "none",
  titleId,
  className,
  children,
  dark,
}: {
  id?: string;
  tone?: SectionTone;
  /** Hairline(s) at the band edge. Use whenever two bands of similar lightness touch. */
  divider?: "none" | "top" | "bottom" | "both";
  /** id of the section's h2, wired to aria-labelledby. */
  titleId?: string;
  className?: string;
  children: ReactNode;
  /** @deprecated use tone="deep" */
  dark?: boolean;
}) {
  const t = dark ? "deep" : tone;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-24 py-20 lg:py-28",
        SECTION_TONE[t],
        divider === "top" && "border-t border-border",
        divider === "bottom" && "border-b border-border",
        divider === "both" && "border-y border-border",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Small sentence-case label above a heading. */
export function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-[0.9375rem] font-semibold text-heading-accent", className)}>{children}</p>;
}

/** Section heading: optional eyebrow, title (an optional `accent` continues it in the same voice), optional lede. */
export function SectionTitle({
  eyebrow,
  title,
  accent,
  grey,
  lede,
  align = "left",
  id,
  as: Heading = "h2",
  reveal = false,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Continues the title on the same line; kept for older call sites. */
  accent?: ReactNode;
  /** @deprecated alias of accent */
  grey?: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  /** Put the same id in <Section titleId>. */
  id?: string;
  /** h1 for the first section of a sub-page; it keeps the h2 size. */
  as?: "h1" | "h2";
  reveal?: boolean;
  className?: string;
  /** @deprecated no-op: .theme-pine recolours automatically */
  dark?: boolean;
}) {
  const acc = accent ?? grey;
  return (
    <div
      {...(reveal ? revealProps(0) : {})}
      className={cn("flex flex-col", align === "center" && "items-center text-center", className)}
    >
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <Heading id={id} className="max-w-[20ch] text-h2 text-balance text-foreground">
        {title}
        {acc && <> {acc}</>}
      </Heading>
      {lede && <p className="mt-5 max-w-[54ch] text-lede text-pretty text-foreground-2">{lede}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* ------------------------------------------------------------------------- */

export type SurfaceTone = "card" | "wash" | "mint" | "sand" | "blush" | "sky";

const SURFACE_TONE: Record<SurfaceTone, string> = {
  card: "bg-card shadow-soft",
  wash: "bg-wash",
  mint: "bg-mint",
  sand: "bg-sand",
  blush: "bg-blush",
  sky: "bg-sky",
};

const SURFACE_PAD = { none: "", sm: "p-4", md: "p-6 lg:p-7", lg: "p-6 sm:p-8" } as const;
const SURFACE_RADIUS = { xl: "rounded-xl", "2xl": "rounded-2xl", "3xl": "rounded-3xl" } as const;

/** The one card recipe: 1px hairline, tinted shadow, concentric radius. */
export function Surface({
  as = "div",
  tone = "card",
  radius = "2xl",
  padding = "md",
  interactive = false,
  className,
  children,
  ...rest
}: {
  as?: "div" | "article" | "li" | "section" | "figure";
  tone?: SurfaceTone;
  radius?: keyof typeof SURFACE_RADIUS;
  padding?: keyof typeof SURFACE_PAD;
  /** Hover: border strengthens, card rises 2px, a lift shadow fades in (the shadow itself is never animated). */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "relative border border-border",
        SURFACE_TONE[tone],
        SURFACE_RADIUS[radius],
        SURFACE_PAD[padding],
        interactive &&
          "transition-[transform,border-color] duration-240 ease-standard after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 after:shadow-lift after:transition-opacity after:duration-240 hover:-translate-y-0.5 hover:border-border-strong hover:after:opacity-100",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Frosted card that floats over photography. Always light, even inside a pine section. */
export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "theme-light rounded-2xl border border-white/60 bg-white/88 px-3.5 py-3 text-[0.8125rem] leading-[1.4] text-foreground shadow-glass backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Live indicator. Static by default; `pulse` adds the slow ring (counts as a loop). */
export function LiveDot({ className, pulse = false }: { className?: string; pulse?: boolean }) {
  return <span aria-hidden className={cn("live-dot text-signal", !pulse && "[&::after]:hidden", className)} />;
}

export type IconTileTone = "mint" | "outline" | "inverse";

const ICON_TILE_SIZE = {
  sm: "size-8 rounded-lg [&_svg]:size-4",
  md: "size-10 rounded-xl [&_svg]:size-[18px]",
  lg: "size-12 rounded-xl [&_svg]:size-5",
} as const;

const ICON_TILE_TONE: Record<IconTileTone, string> = {
  mint: "bg-mint text-primary",
  outline: "border border-border bg-card text-foreground",
  inverse: "border border-border bg-white/6 text-foreground",
};

export function IconTile({
  size = "md",
  tone = "mint",
  className,
  children,
  dark,
}: {
  size?: keyof typeof ICON_TILE_SIZE;
  tone?: IconTileTone;
  className?: string;
  children: ReactNode;
  /** @deprecated use tone="inverse" */
  dark?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        ICON_TILE_SIZE[size],
        ICON_TILE_TONE[dark ? "inverse" : tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type PillTone = "neutral" | "mint" | "sand" | "warning" | "danger" | "success" | "outline" | "inverse";

const PILL_TONE: Record<PillTone, string> = {
  neutral: "bg-wash text-ink-2",
  mint: "bg-mint text-primary",
  sand: "bg-sand text-warning-ink",
  warning: "bg-warning-bg text-warning-ink",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  outline: "border border-border bg-card text-foreground",
  inverse: "bg-white/8 text-foreground-2",
};

/** Badge / chip. 24px (sm) or 32px (md). Text is never below 12px. */
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
        size === "sm" ? "h-6 px-2.5 text-xs" : "h-8 px-3 text-[0.8125rem]",
        PILL_TONE[tone],
        className,
      )}
      {...rest}
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
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold tracking-wide text-primary-foreground",
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
