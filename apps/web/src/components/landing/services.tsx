import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bandage,
  Droplets,
  FileText,
  HeartPulse,
  ScanLine,
  Syringe,
  TestTubeDiagonal,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Package, Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ARROW_NUDGE, CALLBACK_HREF, ButtonLink, Container, Section, SectionTitle, inr, revealProps } from "./primitives";
import { EnquireButton, WhatsAppIcon, WhatsAppLink, whatsappHref } from "./whatsapp";

export type CareCategory = {
  id: string;
  name: string;
  /** Fills "I'd like to book ___ at home." in the WhatsApp message. */
  ask: string;
  includes: string;
  icon: LucideIcon;
  /** Starting price in rupees. null shows "Price on request" until a price is agreed. */
  from: number | null;
  /** Where the detail lives, if anywhere beyond the card. */
  more?: { href: string; label: string };
  /** false keeps a category out of every list until it can be offered. */
  available?: boolean;
};

/**
 * Every service category, in the order the site lists them. Check-up, ECG and consult prices come
 * from the live catalogue (so an admin price edit shows up here); set the others' `from` once agreed.
 */
export function careCategories({ packages, services }: { packages: Package[]; services: Service[] }): CareCategory[] {
  const packagePrices = packages.map((p) => p.price);
  const servicePrice = (code: string) => services.find((s) => s.code === code)?.price ?? null;
  const all: CareCategory[] = [
    {
      id: "injections",
      name: "Injections and vaccines",
      ask: "an injection or vaccine",
      includes: "IM / IV injections, B12, tetanus, vaccines",
      icon: Syringe,
      from: null,
    },
    { id: "iv-drips", name: "IV drips", ask: "an IV drip", includes: "Drips as prescribed", icon: Droplets, from: null },
    {
      id: "wound-care",
      name: "Wound care",
      ask: "wound care",
      includes: "Dressing, post-injury and post-surgery care",
      icon: Bandage,
      from: null,
    },
    {
      id: "check-ups",
      name: "Health check-ups",
      ask: "a health check-up",
      includes: packages.length
        ? packages.map((p) => p.name).join(", ")
        : "Vitals, heart, diabetes and complete check-ups",
      icon: HeartPulse,
      from: packagePrices.length ? Math.min(...packagePrices) : null,
      more: { href: "/services#check-ups", label: "See check-ups" },
    },
    {
      id: "ecg",
      name: "ECG at home",
      ask: "an ECG",
      includes: "Smart ECG, reviewed by a doctor",
      icon: Activity,
      from: servicePrice("ECG"),
    },
    {
      id: "lab-tests",
      name: "Lab tests",
      ask: "a blood test",
      includes: "Blood sample collection with a partner lab",
      icon: TestTubeDiagonal,
      from: null,
      more: { href: "/services#lab-tests", label: "See lab tests" },
    },
    {
      id: "doctor-consult",
      name: "Doctor consult",
      ask: "a doctor consult",
      includes: "Video consult, with the nurse at your side",
      icon: Video,
      from: servicePrice("CONSULT"),
    },
    {
      id: "x-ray",
      name: "X-ray at home",
      ask: "an X-ray",
      includes: "Portable X-ray at home",
      icon: ScanLine,
      from: null,
      // Hidden until licensing and a radiographer are in place.
      available: false,
    },
  ];
  return all.filter((c) => c.available !== false);
}

/** "from ₹449", or "Price on request" while a category has no agreed starting price. */
function PriceLine({ from }: { from: number | null }) {
  if (from === null) return <span className="text-small font-semibold text-ink-2">Price on request</span>;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-small font-medium text-ink-3">from</span>
      <span className="text-[1.375rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {inr(from)}
      </span>
    </span>
  );
}

/**
 * One card per category, each with its starting price and a WhatsApp / Enquire button. With seven
 * categories the prescription shortcut fills the eighth cell; otherwise it runs full width below.
 */
export function ServiceGrid({
  categories,
  cardHeading: CardHeading = "h3",
  className,
}: {
  categories: CareCategory[];
  /** h2 when the grid sits right under the page's h1 (Services page). */
  cardHeading?: "h2" | "h3";
  className?: string;
}) {
  const tile = categories.length % 4 === 3;
  return (
    <>
      <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {categories.map((c, i) => (
          <li key={c.id} id={`service-${c.id}`} className="scroll-mt-28" {...revealProps(Math.min(i, 4))}>
            <article className="flex h-full flex-col rounded-[1.5rem] bg-white p-5 ring-1 ring-border shadow-[0_18px_36px_-30px_rgb(1_43_54/0.5)] sm:p-6">
              {/* Phones: icon and name share a row, so seven stacked cards stay short. */}
              <div className="flex items-center gap-4 sm:block">
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-aqua text-primary">
                  <c.icon className="size-6" strokeWidth={1.9} />
                </span>
                <CardHeading className="text-h4 text-ink sm:mt-5">{c.name}</CardHeading>
              </div>
              <p className="mt-1.5 text-small text-pretty text-ink-2">{c.includes}</p>
              {c.more && (
                <Link
                  href={c.more.href}
                  className={cn(
                    "mt-3 inline-flex w-fit items-center gap-1 rounded-sm text-small font-semibold text-primary underline decoration-border-strong underline-offset-4 hover:decoration-current focus-ring",
                    ARROW_NUDGE,
                  )}
                >
                  {c.more.label}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
              <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5 sm:pt-6">
                <PriceLine from={c.from} />
                <EnquireButton service={c.ask} label={c.name} />
              </div>
            </article>
          </li>
        ))}
        {tile && (
          <li {...revealProps(4)}>
            <PrescriptionCard tile />
          </li>
        )}
      </ul>
      {!tile && <PrescriptionCard className="mt-4" />}
    </>
  );
}

/** "Got a prescription? Send it to us": a WhatsApp shortcut, or the callback form without a number. */
export function PrescriptionCard({ tile = false, className }: { tile?: boolean; className?: string }) {
  const href = whatsappHref("Hi Nivar, I have a prescription. Can you help?");
  const body = (
    <>
      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-mint-glow ring-1 ring-white/15">
        <FileText className="size-6" strokeWidth={1.9} />
      </span>
      <span className="flex-1">
        <span className="block text-h4 text-white">Got a prescription?</span>
        <span className="mt-1 block text-small text-pretty text-on-pine-2">
          {href
            ? "Send a photo of it on WhatsApp. We tell you what it needs, the price and the next free slot."
            : "Ask us to call you. We tell you what it needs, the price and the next free slot."}
        </span>
      </span>
      <span
        data-cta=""
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors duration-200",
          href ? "bg-whatsapp text-whatsapp-ink group-hover:bg-whatsapp-hover" : "bg-on-pine text-ink group-hover:bg-white",
        )}
      >
        {href && <WhatsAppIcon className="size-4.5" />}
        {href ? "Send it to us" : "Request a callback"}
      </span>
    </>
  );
  const look = cn(
    "group theme-pine flex h-full flex-col gap-5 rounded-[1.5rem] bg-[linear-gradient(150deg,var(--jade)_0%,var(--pond-2)_100%)] p-5 focus-ring sm:p-6",
    tile ? "[&>[data-cta]]:mt-auto [&>[data-cta]]:w-fit" : "sm:flex-row sm:items-center",
    className,
  );
  return href ? (
    <WhatsAppLink href={href} className={look}>
      {body}
    </WhatsAppLink>
  ) : (
    <Link href={CALLBACK_HREF} className={look}>
      {body}
    </Link>
  );
}

/** Home page: the service grid, the prescription shortcut, and a link to the full list. */
export function Services({ categories }: { categories: CareCategory[] }) {
  return (
    <Section id="services" titleId="services-title">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle
            id="services-title"
            title="Care we bring to your home."
            lede="Tell us what you need on WhatsApp or a call. We tell you the price before anyone sets off."
          />
          <ButtonLink href="/services" variant="secondary" className={cn("w-fit", ARROW_NUDGE)}>
            All services and prices
            <ArrowRight aria-hidden />
          </ButtonLink>
        </div>
        <ServiceGrid categories={categories} className="mt-12 lg:mt-16" />
      </Container>
    </Section>
  );
}

/** Services page: every category with its price, opening the page (its title is the page's h1). */
export function ServicesOverview({ categories }: { categories: CareCategory[] }) {
  return (
    <Section id="all-services" titleId="all-services-title" className="pt-32 lg:pt-40">
      <Container>
        <SectionTitle
          as="h1"
          id="all-services-title"
          title="Services and prices"
          lede="Every visit is by a registered nurse, with a Nivar doctor reachable throughout. Prices include the home visit: no travel charge and no surge pricing."
        />
        <ServiceGrid categories={categories} cardHeading="h2" className="mt-12 lg:mt-16" />
        <p className="mt-8 max-w-[70ch] text-small text-pretty text-ink-3">
          &ldquo;Price on request&rdquo; depends on the medicine or the tests on your prescription. We tell you the
          full price on WhatsApp or on the call, before we confirm the visit.
        </p>
      </Container>
    </Section>
  );
}
