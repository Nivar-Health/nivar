import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CtaVariant = "primary" | "secondary" | "ghost" | "light" | "saffron";
type CtaSize = "md" | "lg";

const CTA_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-offset-2 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0";

const CTA_VARIANT: Record<CtaVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_10px_24px_-12px_rgb(14_94_82/0.7)] hover:bg-teal-deep focus-visible:ring-primary/40 focus-visible:ring-offset-background",
  secondary:
    "border border-ink/12 bg-white/70 text-ink hover:border-ink/25 hover:bg-white focus-visible:ring-primary/30 focus-visible:ring-offset-background",
  ghost: "text-ink hover:bg-ink/5 focus-visible:ring-primary/30 focus-visible:ring-offset-background",
  light:
    "bg-ivory text-teal-deep hover:bg-white focus-visible:ring-ivory/50 focus-visible:ring-offset-teal-deep",
  saffron:
    "bg-saffron text-saffron-foreground hover:bg-[#F5B358] focus-visible:ring-saffron/50 focus-visible:ring-offset-teal-deep",
};

const CTA_SIZE: Record<CtaSize, string> = {
  md: "h-10 px-4.5 text-sm",
  lg: "h-12 px-6 text-[0.95rem]",
};

export function ctaClass(variant: CtaVariant = "primary", size: CtaSize = "md", className?: string) {
  return cn(CTA_BASE, CTA_VARIANT[variant], CTA_SIZE[size], className);
}

export function CtaLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: CtaVariant; size?: CtaSize }) {
  return <Link className={ctaClass(variant, size, className)} {...props} />;
}

/** Page-width container with the landing gutters. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)}>{children}</div>;
}

/** Section heading: serif display title with an optional lede. */
export function SectionHeading({
  id,
  title,
  lede,
  align = "left",
  tone = "dark",
  className,
}: {
  id?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <h2
        id={id}
        className={cn(
          "font-display text-[2rem] leading-[1.08] font-medium tracking-[-0.025em] text-balance sm:text-[2.6rem] lg:text-[3rem]",
          tone === "light" ? "text-ivory" : "text-ink",
        )}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            "mt-4 text-[1.0625rem] leading-relaxed text-pretty sm:text-lg",
            tone === "light" ? "text-ivory/75" : "text-muted-foreground",
          )}
        >
          {lede}
        </p>
      )}
    </div>
  );
}
