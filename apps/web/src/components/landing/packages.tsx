import Link from "next/link";
import {
  Activity,
  Check,
  Droplet,
  Gauge,
  HeartPulse,
  Plus,
  Stethoscope,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import type { Package, Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Container, SectionHeading, ctaClass } from "./primitives";

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  activity: Activity,
  droplet: Droplet,
  "heart-pulse": HeartPulse,
  wind: Wind,
  stethoscope: Stethoscope,
  video: Video,
};

export function Packages({
  packages,
  services,
}: {
  packages: Package[];
  services: Service[];
}) {
  const byCode = new Map(services.map((s) => [s.code, s]));

  return (
    <section
      id="services"
      aria-labelledby="services-title"
      className="scroll-mt-20 border-y border-ink/8 bg-white py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="services-title"
            title="Clear prices, nurse visit included."
            lede="No visit fee and no surprises at the door. Pay online when you book, with UPI, card or netbanking."
          />
        </div>

        {packages.length > 0 && (
          <ul className="mt-12 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:mt-14 xl:grid-cols-4">
            {packages.map((p) => (
              <li key={p.id} className="row-span-4 grid grid-rows-subgrid gap-0">
                <PackageCard pkg={p} byCode={byCode} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-16 lg:mt-20">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="font-display text-[1.6rem] font-medium tracking-[-0.02em] text-ink">
              Or pick individual tests
            </h3>
            <p className="text-sm text-muted-foreground">
              Combine any of these in one visit.
            </p>
          </div>
          <ul className="mt-6 grid border-t border-ink/8 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = ICONS[s.icon] ?? Activity;
              return (
                <li key={s.code} className="border-b border-ink/8">
                  <Link
                    href={`/app/book?test=${encodeURIComponent(s.code)}`}
                    className="group flex items-center gap-4 rounded-lg py-4 outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
                    aria-label={`Book ${s.name}, ${formatINR(s.price)}`}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-primary">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem] font-semibold text-ink">
                        {s.name}
                      </span>
                      <span className="block truncate text-[0.82rem] text-muted-foreground">
                        {s.requiresDevice
                          ? "Streams live to your doctor"
                          : `${s.durationMin} min at home`}
                      </span>
                    </span>
                    <span className="font-display text-lg font-medium text-ink tabular-nums">
                      {formatINR(s.price)}
                    </span>
                    <span
                      aria-hidden
                      className="flex size-8 items-center justify-center rounded-full border border-ink/10 text-ink/60 transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
                    >
                      <Plus className="size-4" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function PackageCard({
  pkg,
  byCode,
}: {
  pkg: Package;
  byCode: Map<string, Service>;
}) {
  const savings = Math.max(0, pkg.mrp - pkg.price);
  const pct = pkg.mrp > 0 ? Math.round((savings / pkg.mrp) * 100) : 0;
  const featured = pkg.popular;

  return (
    <article
      className={cn(
        "relative row-span-4 grid grid-rows-subgrid gap-0 rounded-[20px] border p-6 sm:p-7",
        featured
          ? "border-teal-deep bg-teal-deep text-primary-foreground shadow-[0_30px_60px_-30px_rgb(10_74_64/0.7)]"
          : "border-ink/10 bg-ivory/60",
      )}
      aria-labelledby={`pkg-${pkg.slug}`}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-saffron px-3 py-1 text-xs font-semibold text-saffron-foreground shadow-sm sm:left-7">
          Most popular
        </span>
      )}
      <div>
        <h3
          id={`pkg-${pkg.slug}`}
          className={cn(
            "text-lg leading-snug font-semibold",
            featured ? "text-white" : "text-ink",
          )}
        >
          {pkg.name}
        </h3>
        <p
          className={cn(
            "mt-1.5 text-sm leading-snug",
            featured ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {pkg.tagline}
        </p>
      </div>

      <div className="pt-6">
        <div className="flex items-baseline gap-2.5">
          <span
            className={cn(
              "font-display text-[2.6rem] leading-none font-medium tracking-[-0.03em] tabular-nums",
              featured ? "text-white" : "text-ink",
            )}
          >
            {formatINR(pkg.price)}
          </span>
          {savings > 0 && (
            <span
              className={cn(
                "text-[0.95rem] tabular-nums line-through",
                featured ? "text-white/50" : "text-muted-foreground/80",
              )}
            >
              <span className="sr-only">Usual price </span>
              {formatINR(pkg.mrp)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-2 h-5 text-sm font-medium",
            featured ? "text-saffron" : "text-[#25724B]",
          )}
        >
          {savings > 0 ? `You save ${formatINR(savings)} (${pct}%)` : null}
        </p>
      </div>

      <ul
        className={cn(
          "mt-6 space-y-2.5 self-start border-t pt-6 text-[0.9rem]",
          featured ? "border-white/12" : "border-ink/8",
        )}
      >
        {pkg.serviceCodes.map((code) => (
          <li key={code} className="flex items-start gap-2.5">
            <Check
              className={cn(
                "mt-0.5 size-4 shrink-0",
                featured ? "text-saffron" : "text-primary",
              )}
              strokeWidth={2.5}
              aria-hidden
            />
            <span className={featured ? "text-white/90" : "text-ink/85"}>
              {byCode.get(code)?.name ?? code}
            </span>
          </li>
        ))}
      </ul>

      <div className="self-end pt-8">
        <Link
          href={`/app/book?package=${encodeURIComponent(pkg.id)}`}
          className={ctaClass(featured ? "saffron" : "primary", "lg", "w-full")}
          aria-label={`Book ${pkg.name} for ${formatINR(pkg.price)}`}
        >
          Book this check-up
        </Link>
      </div>
    </article>
  );
}
