import Image from "next/image";
import {
  Activity,
  ArrowDown,
  Bandage,
  Droplets,
  FileText,
  HeartPulse,
  House,
  IndianRupee,
  ReceiptText,
  RotateCcw,
  ScanLine,
  Syringe,
  TestTubeDiagonal,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { SITE } from "@/lib/site-facts";
import type { Catalog, ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARE_TINT, CareGlyph, isCareGlyph } from "./care-glyphs";
import { CALLBACK_HREF, Container, Section, SectionTitle, buttonClass, inr } from "./primitives";
import { SnapRow } from "./snap-row";
import { CareCta, WhatsAppIcon, WhatsAppLink, whatsappHref } from "./whatsapp";
import "./services.css";

export type CareCategory = {
  id: "injections" | "iv-drips" | "wound-care" | "blood-tests" | "check-ups" | "ecg" | "doctor-consult" | "x-ray";
  /** Nursing cards first; the rest are the compact "Also at home" rows. */
  tier: "nursing" | "also";
  name: string;
  /** Fills "I'd like to book ___ at home." in the WhatsApp message and the callback note. */
  ask: string;
  line: string;
  note?: string;
  icon: LucideIcon;
  /** A real photo for the card (spec §6). Without one the card shows its care illustration. */
  photo?: { src: string; alt: string; thumbPosition: string; position?: string };
  /** Starting price in rupees, from the catalogue only. null shows "Price on request". */
  from: number | null;
  priceLabel?: string;
  link?: { href: "#check-ups"; label: string };
  /** false keeps a category out of every list until it can be offered. */
  available?: boolean;
};

/**
 * Every service, in the order the page lists them. Check-up, ECG and consult prices come from the
 * live catalogue (so an admin price edit shows up here); the nursing services stay "Price on request"
 * because the price depends on the prescription.
 */
export function careCategories({ packages, services }: Pick<Catalog, "packages" | "services">): CareCategory[] {
  const packagePrices = packages.map((p) => p.price);
  const servicePrice = (code: ServiceCode) => services.find((s) => s.code === code)?.price ?? null;
  const all: CareCategory[] = [
    {
      id: "injections",
      tier: "nursing",
      name: "Injections and vaccines",
      ask: "an injection or vaccine",
      line: "IM and IV injections, B12, tetanus and vaccines, as your doctor prescribed.",
      note: "Only as prescribed. No prescription? Our doctor can talk you through the options on the call.",
      icon: Syringe,
      from: null,
    },
    {
      id: "iv-drips",
      tier: "nursing",
      name: "IV drips",
      ask: "an IV drip",
      line: "Drips at home, set up by your nurse as your doctor prescribed.",
      note: "Given only as a doctor has prescribed.",
      icon: Droplets,
      from: null,
    },
    {
      id: "wound-care",
      tier: "nursing",
      name: "Wound care",
      ask: "wound care",
      line: "Dressings and care after an injury or surgery.",
      note: "Dressings changed at home, without the trip to a clinic.",
      icon: Bandage,
      from: null,
    },
    {
      id: "blood-tests",
      tier: "nursing",
      name: "Blood tests at home",
      ask: "a blood test",
      line: "Your nurse collects the sample at home for our partner lab.",
      note: "Tell us the tests on your prescription, and we tell you the price before the visit.",
      icon: TestTubeDiagonal,
      from: null,
    },
    {
      id: "check-ups",
      tier: "also",
      name: "Health check-ups",
      ask: "a health check-up",
      line: "From a quick vitals check to a complete check-up, reviewed by a Nivar doctor.",
      icon: HeartPulse,
      from: packagePrices.length ? Math.min(...packagePrices) : null,
      link: { href: "#check-ups", label: "Compare check-ups" },
    },
    {
      id: "ecg",
      tier: "also",
      name: "ECG at home",
      ask: "an ECG",
      line: "Smart ECG, reviewed by a Nivar doctor.",
      icon: Activity,
      from: servicePrice("ECG"),
    },
    {
      id: "doctor-consult",
      tier: "also",
      name: "Doctor consult",
      ask: "a doctor consult",
      line: "A Nivar doctor on video, with your nurse at your side.",
      icon: Video,
      from: servicePrice("CONSULT"),
    },
    {
      id: "x-ray",
      tier: "also",
      name: "X-ray at home",
      ask: "an X-ray",
      line: "Portable X-ray at home.",
      icon: ScanLine,
      from: null,
      // Hidden until licensing and a radiographer are in place.
      available: false,
    },
  ];
  return all.filter((c) => c.available !== false);
}

/** What one price covers. The last item is the cancellation promise from site-facts. */
const PROMISES: { icon: LucideIcon; text: string }[] = [
  { icon: House, text: "No travel charge" },
  { icon: IndianRupee, text: "No surge pricing" },
  { icon: ReceiptText, text: "No hidden consultation fee" },
  { icon: RotateCcw, text: SITE.cancellation },
];

/** "from ₹449", or "Price on request" while a service has no catalogue price. */
function PriceTag({ from }: { from: number | null }) {
  if (from === null) {
    return (
      <p className="nv-care-price flex flex-col">
        <span className="text-small leading-snug font-semibold text-ink">Price on request</span>
        <span className="text-caption text-ink-3">Told before we confirm</span>
      </p>
    );
  }
  return (
    <p className="nv-care-price flex items-baseline gap-1.5">
      <span className="text-small font-medium text-ink-3">from</span>
      <span className="text-[1.375rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {inr(from)}
      </span>
    </p>
  );
}

/**
 * "Have a prescription?": a photo on WhatsApp, or a callback that tells the form what it's about.
 * Without WhatsApp it is a plain link to #callback, so it works without JavaScript.
 */
export function PrescriptionStrip({ className }: { className?: string }) {
  const wa = whatsappHref("Hi Nivar, I have a prescription. Can you help?");
  return (
    <div className={cn("nv-care-rx theme-pine", className)}>
      <span aria-hidden className="nv-care-rx-icon">
        <FileText strokeWidth={1.75} />
      </span>
      <h3 className="nv-care-rx-title text-h4 text-on-pine">Have a prescription?</h3>
      <p className="nv-care-rx-body text-small text-pretty text-on-pine-2">
        {wa
          ? "Send a photo of it on WhatsApp. We tell you what it needs, the price and the next free slot."
          : "Ask us to call you. We tell you what it needs, the price and the next free slot."}
      </p>
      {wa ? (
        <WhatsAppLink href={wa} className={buttonClass("whatsapp", "nv-care-rx-cta")}>
          <WhatsAppIcon className="size-4.5!" />
          Send it on WhatsApp
        </WhatsAppLink>
      ) : (
        <a
          href={CALLBACK_HREF}
          className={buttonClass("inverse", "nv-care-rx-cta")}
          data-need="I have a prescription. Please call me about it."
          data-need-label="A prescription"
        >
          Request a callback
        </a>
      )}
    </div>
  );
}

/** The picture on a nursing card: a photo when there is one, else its care illustration on a tinted mat. */
function CareMedia({ c }: { c: CareCategory }) {
  if (c.photo) {
    return (
      <div className="nv-care-media" style={{ "--nv-care-tint": "var(--aqua)" } as CSSProperties}>
        <Image
          src={c.photo.src}
          alt={c.photo.alt}
          fill
          sizes="(min-width:1024px) 282px, (min-width:768px) 46vw, 96px"
          className="nv-care-photo object-cover"
          style={{ "--nv-care-thumb": c.photo.thumbPosition, "--nv-care-pos": c.photo.position ?? "50% 50%" } as CSSProperties}
        />
      </div>
    );
  }
  const glyph = isCareGlyph(c.id) ? c.id : null;
  return (
    <div className="nv-care-media" style={{ "--nv-care-tint": glyph ? CARE_TINT[glyph] : "var(--aqua)" } as CSSProperties}>
      {glyph ? <CareGlyph kind={glyph} /> : <c.icon aria-hidden className="size-14 text-primary" strokeWidth={1.75} />}
    </div>
  );
}

/**
 * A nursing card: a vertical media row on phones (96px picture beside the name), a card with a 4:3
 * picture from md. Not a link: its call to action is the button.
 */
function NursingCard({ c }: { c: CareCategory }) {
  const titleId = `service-${c.id}-title`;
  return (
    <article id={`service-${c.id}`} aria-labelledby={titleId} className="nv-care-card">
      <CareMedia c={c} />
      <div className="nv-care-text">
        <div className="nv-care-head">
          <h3 id={titleId} className="text-h4 text-ink">
            {c.name}
          </h3>
          <p className="mt-1 text-small text-pretty text-ink-2">{c.line}</p>
        </div>
        {c.note && <p className="nv-care-note text-caption text-pretty text-ink-3">{c.note}</p>}
      </div>
      <div className="nv-care-foot">
        <PriceTag from={c.from} />
        <CareCta name={c.name} ask={c.ask} from={c.from} priceLabel={c.priceLabel} className="nv-care-cta" />
      </div>
    </article>
  );
}

/**
 * One "Also at home" item: icon, name and line, price, then the check-ups link or a call to action.
 * A small card in the phone swipe row, a row of the ruled panel from md (services.css).
 */
function AlsoRow({ c }: { c: CareCategory }) {
  return (
    <div id={`service-${c.id}`} className="nv-care-row">
      <span aria-hidden className="nv-care-row-icon">
        <c.icon strokeWidth={1.9} />
      </span>
      <div className="nv-care-row-text">
        <h4 className="text-[1.0625rem] leading-snug font-semibold text-ink">{c.name}</h4>
        <p className="mt-0.5 text-small text-pretty text-ink-2">{c.line}</p>
      </div>
      <div className="nv-care-foot nv-care-row-foot">
        <PriceTag from={c.from} />
        {c.link ? (
          <a href={c.link.href} className="nv-care-link nv-care-cta">
            {c.link.label}
            <ArrowDown aria-hidden strokeWidth={2.25} />
          </a>
        ) : (
          <CareCta name={c.name} ask={c.ask} from={c.from} priceLabel={c.priceLabel} className="nv-care-cta" />
        )}
      </div>
    </div>
  );
}

/** The nursing cards and the "Also at home" rows. */
function CareLists({ categories }: { categories: CareCategory[] }): ReactNode {
  const nursing = categories.filter((c) => c.tier === "nursing");
  const also = categories.filter((c) => c.tier === "also");
  return (
    <>
      <p id="services-nursing" className="nv-care-tier mt-8 sm:mt-12 lg:mt-16">
        Nursing at home
      </p>
      <ul aria-labelledby="services-nursing" className="nv-care-grid">
        {nursing.map((c) => (
          // One reveal per card, so each illustration plays as its card scrolls in.
          <li key={c.id} className="nv-care-item" data-nv-reveal="">
            <NursingCard c={c} />
          </li>
        ))}
      </ul>
      {also.length > 0 && (
        <>
          <h3 id="services-also" className="nv-care-tier mt-8 sm:mt-12 lg:mt-16">
            Also at home
          </h3>
          {/* The nursing cards stay in view without swiping (addendum M3); these extras swipe on phones. */}
          <SnapRow label="Also at home" gridFrom="md" itemClassName="basis-[85%]" className="nv-care-also mt-3 sm:mt-4">
            {also.map((c) => (
              <AlsoRow key={c.id} c={c} />
            ))}
          </SnapRow>
        </>
      )}
    </>
  );
}

/**
 * "What your nurse can do at home.": nursing first (four cards), then check-ups, ECG and the doctor
 * consult as compact rows. The prescription strip sits beside the heading and the price promise under
 * it: a swipeable chip row on phones, a ruled row from sm.
 */
export function Services({ catalog }: { catalog: Pick<Catalog, "packages" | "services"> }) {
  const categories = careCategories(catalog);
  return (
    <Section id="services" titleId="services-title" tone="white">
      <Container>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
          <SectionTitle
            id="services-title"
            className="lg:col-span-7"
            title="What your nurse can do at home."
            lede="Every visit is by a registered nurse, with a Nivar doctor reachable throughout. We tell you the full price before anyone sets off."
          />
          <PrescriptionStrip className="lg:col-span-5" />
        </div>

        <SnapRow
          label="What one price covers"
          snapStop="normal"
          gridFrom="sm"
          gridClassName="sm:grid-cols-2 sm:gap-0 sm:border-y sm:border-border lg:grid-cols-[repeat(4,auto)]"
          className="nv-care-promise mt-6 sm:mt-10 lg:mt-12"
        >
          {PROMISES.map(({ icon: Icon, text }) => (
            <span key={text} className="nv-care-chip">
              <span aria-hidden className="nv-care-chip-icon">
                <Icon strokeWidth={2} />
              </span>
              {text}
            </span>
          ))}
        </SnapRow>

        <CareLists categories={categories} />
      </Container>
    </Section>
  );
}
