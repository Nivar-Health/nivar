import {
  Activity,
  ArrowDown,
  Bandage,
  ChevronRight,
  Droplets,
  FileText,
  HeartPulse,
  House,
  IndianRupee,
  ReceiptText,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Syringe,
  TestTubeDiagonal,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { SITE } from "@/lib/site-facts";
import type { Catalog, ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArtPicture } from "./art-picture";
import { CARE_TINT, CareGlyph, isCareGlyph } from "./care-glyphs";
import { CALLBACK_HREF, Container, Section, SectionTitle, buttonClass, inr, revealProps } from "./primitives";
import { CareCta, WhatsAppIcon, WhatsAppLink, whatsappHref } from "./whatsapp";
import "./services.css";

export type CareCategory = {
  id: "injections" | "iv-drips" | "wound-care" | "blood-tests" | "check-ups" | "ecg" | "doctor-consult" | "x-ray";
  /** Nursing tiles and cards first; the rest are the "Also at home" rows. */
  tier: "nursing" | "also";
  name: string;
  /** Fills "I'd like to book ___ at home." in the WhatsApp message and the callback note. */
  ask: string;
  /** The card's line, from 640px. */
  line: string;
  /** Nursing only: the phone tile's shorter line, below 640px. */
  tileLine?: string;
  note?: string;
  icon: LucideIcon;
  /**
   * A real photo (spec §1.12): `src` is the 4:3 file (96px thumb at 640–767, the card from 768), `square`
   * the 1:1 phone tile. Positions default to "50% 50%". Without one the care illustration shows instead.
   */
  photo?: { src: string; square: string; alt: string; thumbPosition?: string; position?: string };
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
 * The four procedure photos render in every build. A registered Nivar nurse checks them before the PR
 * to main; a frame that fails loses its `photo` entry here, and its tile and card show the illustration.
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
      tileLine: "IM, IV, B12, tetanus and vaccines.",
      note: "No prescription? Our doctor can talk you through the options on the call.",
      icon: Syringe,
      photo: {
        src: "/img/nurse-injection-swab.jpg",
        square: "/img/nurse-injection-swab-1x1.jpg",
        alt: "A Nivar nurse presses a cotton swab to a man's upper arm after an injection at his dining table",
      },
      from: null,
    },
    {
      id: "iv-drips",
      tier: "nursing",
      name: "IV drips",
      ask: "an IV drip",
      line: "Drips at home, set up by your nurse as your doctor prescribed.",
      tileLine: "Drips at home, as prescribed.",
      icon: Droplets,
      photo: {
        src: "/img/nurse-iv-drip.jpg",
        square: "/img/nurse-iv-drip-1x1.jpg",
        alt: "A Nivar nurse adjusts an IV drip for an older woman resting in her armchair at home",
      },
      from: null,
    },
    {
      id: "wound-care",
      tier: "nursing",
      name: "Wound care",
      ask: "wound care",
      line: "Dressings and care after an injury or surgery.",
      tileLine: "Dressings after an injury or surgery.",
      note: "Dressings changed at home, without the trip to a clinic.",
      icon: Bandage,
      photo: {
        src: "/img/nurse-wound-care.jpg",
        square: "/img/nurse-wound-care-1x1.jpg",
        alt: "A Nivar nurse dresses an older man's forearm at his dining table",
      },
      from: null,
    },
    {
      id: "blood-tests",
      tier: "nursing",
      name: "Blood tests at home",
      ask: "a blood test",
      line: "Your nurse collects the sample at home for our partner lab.",
      tileLine: "Sample collected for our partner lab.",
      note: "Tell us the tests on your prescription.",
      icon: TestTubeDiagonal,
      photo: {
        src: "/img/nurse-blood-sample.jpg",
        square: "/img/nurse-blood-sample-1x1.jpg",
        alt: "A Nivar nurse seals a blood sample tube in a specimen bag at a dining table, after collecting it at home",
        thumbPosition: "45% 45%",
      },
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

const RX_MESSAGE = "Hi Nivar, I have a prescription. Can you help?";
const RX_NEED = { "data-need": "I have a prescription. Please call me about it.", "data-need-label": "A prescription" };

/** Phone tiles are half the column less half the 12px gap; the 4:3 file serves the 96px thumb and the cards. */
const TILE_SIZES = "calc(50vw - 26px)";
const CARD_SIZES = "(min-width: 1024px) 282px, (min-width: 768px) 46vw, 96px";

/**
 * "from ₹449", or "Price on request" while a service has no catalogue price. `compact` is the "Also at
 * home" row's: 17px below md, then the card's 22px in the ruled panel.
 */
function PriceTag({ from, compact = false }: { from: number | null; compact?: boolean }) {
  if (from === null) {
    return (
      <p className="nv-care-price flex flex-col">
        <span className="text-small leading-snug font-semibold text-ink">Price on request</span>
        <span className={cn("text-caption text-ink-3", compact && "max-md:hidden")}>Told before we confirm</span>
      </p>
    );
  }
  return (
    <p className={cn("nv-care-price flex items-baseline", compact ? "gap-1 md:gap-1.5" : "gap-1.5")}>
      <span className={cn("font-medium text-ink-3", compact ? "text-caption md:text-small" : "text-small")}>from</span>
      <span
        className={cn(
          "font-semibold text-ink tabular-nums",
          compact
            ? "text-[1.0625rem] leading-[1.3] md:text-[1.375rem] md:leading-none md:tracking-[-0.02em]"
            : "text-[1.375rem] leading-none tracking-[-0.02em]",
        )}
      >
        {inr(from)}
      </span>
    </p>
  );
}

/**
 * "Have a prescription?" from 640px: a photo on WhatsApp, or a callback that tells the form what it's
 * about. Without WhatsApp it is a plain link to #callback, so it works without JavaScript. Phones get
 * PrescriptionRow instead.
 */
export function PrescriptionStrip({ className }: { className?: string }) {
  const wa = whatsappHref(RX_MESSAGE);
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
        <a href={CALLBACK_HREF} className={buttonClass("inverse", "nv-care-rx-cta")} {...RX_NEED}>
          Request a callback
        </a>
      )}
    </div>
  );
}

/** The same ask on phones: one ruled 56px row, the whole row the link. */
function PrescriptionRow({ className }: { className?: string }) {
  const wa = whatsappHref(RX_MESSAGE);
  const body = (meta: string) => (
    <>
      <FileText aria-hidden className="nv-care-rxrow-icon" strokeWidth={2} />
      <span className="nv-care-rxrow-text">
        <span className="nv-care-rxrow-title">Have a prescription?</span>
        <span className="nv-care-rxrow-meta">{meta}</span>
      </span>
      <ChevronRight aria-hidden className="nv-care-rxrow-chev" strokeWidth={2.25} />
    </>
  );
  return (
    <div className={cn("nv-care-rxwrap", className)}>
      {wa ? (
        <WhatsAppLink href={wa} className="nv-care-rxrow">
          {body("Send a photo of it on WhatsApp")}
        </WhatsAppLink>
      ) : (
        <a href={CALLBACK_HREF} className="nv-care-rxrow" {...RX_NEED}>
          {body("Ask us to call you about it")}
        </a>
      )}
    </div>
  );
}

/**
 * Phones only (the cards carry their own notes from 640px): the prescription rule, the path without a
 * prescription, and the price. "Price on request:" stays only while every nursing service lacks a price.
 */
function ShieldNote({ onRequest, className }: { onRequest: boolean; className?: string }) {
  return (
    <p className={cn("nv-care-shield", className)}>
      <ShieldCheck aria-hidden className="nv-care-shield-icon" strokeWidth={2} />
      {"Injections and drips are given only as your doctor prescribed. No prescription? Our doctor can talk you through the options on the call. "}
      {onRequest
        ? "Price on request: we tell you the full price before we confirm."
        : "We tell you the full price before we confirm."}
    </p>
  );
}

/** What one price covers: a static 2×2 list on phones, the ruled row from sm (services.css). */
function PromiseList({ className }: { className?: string }) {
  return (
    <ul
      role="list"
      aria-label="What one price covers"
      {...revealProps(0)}
      className={cn(
        "nv-care-promise sm:grid-cols-2 sm:gap-0 sm:border-y sm:border-border lg:grid-cols-[repeat(4,auto)]",
        className,
      )}
    >
      {PROMISES.map(({ icon: Icon, text }) => (
        <li key={text}>
          <span className="nv-care-chip">
            <span aria-hidden className="nv-care-chip-icon">
              <Icon strokeWidth={2} />
            </span>
            {text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The picture on a nursing tile or card: a photo when there is one, else its care illustration on a tinted mat. */
function CareMedia({ c }: { c: CareCategory }) {
  if (c.photo) {
    const { src, square, alt, thumbPosition = "50% 50%", position = "50% 50%" } = c.photo;
    return (
      <div className="nv-care-media" style={{ "--nv-care-thumb": thumbPosition, "--nv-care-pos": position } as CSSProperties}>
        <ArtPicture
          alt={alt}
          sources={[{ media: "(width < 40rem)", src: square, sizes: TILE_SIZES }]}
          fallback={{ src, sizes: CARD_SIZES }}
          imgClassName="nv-care-photo object-cover"
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
 * One nursing service, rendered once for every width (services.css):
 * - phones: a photo tile whose action line is a stretched link, so the whole tile is its target;
 * - 640–767: a media row, the 96px picture beside the name;
 * - from 768: a card with a 4:3 picture.
 * From 640 the price, the note and the button replace the tile's line and action; only one of the two
 * calls to action is ever displayed, so only one is in the accessibility tree.
 */
function NursingCard({ c }: { c: CareCategory }) {
  const titleId = `service-${c.id}-title`;
  return (
    <article id={`service-${c.id}`} aria-labelledby={titleId} className="nv-care-card">
      <CareMedia c={c} />
      <div className="nv-care-text">
        <div className="nv-care-head">
          <h3 id={titleId} className="nv-care-name">
            {c.name}
          </h3>
          {c.tileLine && <p className="nv-care-tileline sm:hidden">{c.tileLine}</p>}
          <p className={cn("mt-1 text-small text-pretty text-ink-2", c.tileLine && "max-sm:hidden")}>{c.line}</p>
        </div>
        {c.note && <p className="nv-care-note text-caption text-pretty text-ink-3 max-sm:hidden">{c.note}</p>}
      </div>
      <div className="nv-care-foot max-sm:hidden">
        <PriceTag from={c.from} />
        <CareCta name={c.name} ask={c.ask} from={c.from} priceLabel={c.priceLabel} className="nv-care-cta" />
      </div>
      <div className="nv-care-act sm:hidden">
        {/* Only once a nursing price reaches `from` (spec Q10): the price over "Request this visit". */}
        {c.from !== null && (
          <p className="nv-care-act-price">
            <span className="text-caption font-medium text-ink-3">from</span> {inr(c.from)}
          </p>
        )}
        <CareCta
          name={c.name}
          ask={c.ask}
          from={c.from}
          priceLabel={c.priceLabel}
          appearance="link"
          compactLabel
          className="nv-care-go"
        />
      </div>
    </article>
  );
}

/**
 * One "Also at home" item, once for every width. Below md the whole row is one link (its words are read,
 * not shown) with a right chevron; from md it is a row of the ruled panel with its own link or button.
 */
function AlsoRow({ c }: { c: CareCategory }) {
  return (
    <li id={`service-${c.id}`} className="nv-care-row">
      <div className="nv-care-row-main">
        <span aria-hidden className="nv-care-row-icon">
          <c.icon strokeWidth={1.9} />
        </span>
        <div className="nv-care-row-text">
          <h4 className="nv-care-row-name">{c.name}</h4>
          <p className="nv-care-row-line text-pretty">{c.line}</p>
        </div>
        <PriceTag from={c.from} compact />
      </div>
      {c.link ? (
        <>
          <a href={c.link.href} className="nv-care-row-go md:hidden">
            <span className="sr-only">{c.name}: compare check-ups</span>
            <ChevronRight aria-hidden strokeWidth={2.25} />
          </a>
          <a href={c.link.href} className="nv-care-link nv-care-cta max-md:hidden">
            {c.link.label}
            <ArrowDown aria-hidden strokeWidth={2.25} />
          </a>
        </>
      ) : (
        <>
          <CareCta
            name={c.name}
            ask={c.ask}
            from={c.from}
            priceLabel={c.priceLabel}
            appearance="link"
            className="nv-care-row-go md:hidden"
          />
          <CareCta name={c.name} ask={c.ask} from={c.from} priceLabel={c.priceLabel} className="nv-care-cta max-md:hidden" />
        </>
      )}
    </li>
  );
}

/**
 * "What your nurse can do at home.", in phone order: four photo tiles, the shield note, what one price
 * covers, the prescription row and the "Also at home" rows. Nothing swipes. From 640px the prescription
 * strip sits by the heading, the promise row moves up under it (flex order; the list has no controls,
 * so the focus order is unchanged) and the cards carry their own prices and notes.
 */
export function Services({ catalog }: { catalog: Pick<Catalog, "packages" | "services"> }) {
  const categories = careCategories(catalog);
  const nursing = categories.filter((c) => c.tier === "nursing");
  const also = categories.filter((c) => c.tier === "also");
  return (
    <Section id="services" titleId="services-title" tone="white">
      <Container className="flex flex-col">
        <div className="grid gap-6 sm:order-[-1] lg:grid-cols-12 lg:items-end lg:gap-12">
          <SectionTitle
            id="services-title"
            className="lg:col-span-7"
            title="What your nurse can do at home."
            lede="Every visit is by a registered nurse, with a Nivar doctor reachable throughout."
          />
          <PrescriptionStrip className="max-sm:hidden lg:col-span-5" />
        </div>

        <p id="services-nursing" className="nv-care-tier mt-7 sm:mt-12 lg:mt-16">
          Nursing at home
        </p>
        <ul role="list" aria-labelledby="services-nursing" {...revealProps(0)} className="nv-care-grid">
          {nursing.map((c) => (
            <li key={c.id} className="nv-care-item">
              <NursingCard c={c} />
            </li>
          ))}
        </ul>
        <ShieldNote onRequest={nursing.every((c) => c.from === null)} className="mt-5 sm:hidden" />
        <PromiseList className="mt-6 sm:order-[-1] sm:mt-10 lg:mt-12" />
        <PrescriptionRow className="mt-6 sm:hidden" />

        {also.length > 0 && (
          <>
            <h3 id="services-also" className="nv-care-tier mt-8 sm:mt-12 lg:mt-16">
              Also at home
            </h3>
            <ul role="list" aria-labelledby="services-also" {...revealProps(0)} className="nv-care-also mt-3 sm:mt-4">
              {also.map((c) => (
                <AlsoRow key={c.id} c={c} />
              ))}
            </ul>
          </>
        )}
      </Container>
    </Section>
  );
}
