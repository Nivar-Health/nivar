import { PhoneCall, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { cn } from "@/lib/utils";
import { Disclosure } from "./disclosure";
import {
  ALL_SOURCES,
  CONTENT_REVIEW,
  EMERGENCY_NOTE,
  FASTING_WARNING,
  HEALTH_TIPS,
  SOURCES_NOTE,
  VISIT_CHECKLIST,
  tipOfTheDayIndex,
} from "./health-content";
import { ExternalLink } from "./external-link";
import { FactsRow, HealthDisclaimer } from "./health-facts";
import { Container, Section, SectionTitle } from "./primitives";
import { TakeAMinuteTile } from "./take-a-minute-tile";
import { TipDeck } from "./tip-deck";
import { VisitChecklist } from "./visit-checklist";
import "./health-tips.css";

/**
 * 48px danger-outline call buttons: never marigold, never a jade fill. Tint and scale on press. On
 * phones the two share one row; under 360px their glyphs go, so they still do.
 */
const TEL_BUTTON =
  "inline-flex h-12 grow items-center justify-center gap-1.5 rounded-full border-[1.5px] border-danger bg-white px-3 text-[0.9375rem] font-semibold whitespace-nowrap text-danger focus-ring transition-[background-color,scale] duration-180 ease-standard select-none hover:bg-danger/5 active:scale-[0.97] active:bg-danger/10 active:duration-90 motion-reduce:active:scale-100 sm:grow-0 sm:px-5 [&_svg]:size-4 [&_svg]:shrink-0 max-[22.5rem]:[&_svg]:hidden";

/**
 * The one emergency note in this section (the footer keeps its own line): a plain card with a red edge,
 * never a red box, so it reads as a safety net and not as an alarm. The edge is a straight bar the card's
 * corners clip (the padding keeps the buttons' focus rings clear of the clip). Always visible, named so
 * it can be found by landmark or heading, and its sentence is the reviewed one, word for word. From md
 * to lg it spans the section, so the calls sit beside the sentence.
 */
function EmergencyNote({ className }: { className?: string }) {
  return (
    <aside
      aria-labelledby="habits-sos-title"
      className={cn(
        "nv-habits-sos relative overflow-hidden rounded-2xl bg-card p-4 pl-5 ring-1 ring-border-strong ring-inset before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-danger forced-colors:border forced-colors:border-[CanvasText] sm:p-5 sm:pl-6 md:max-lg:flex md:max-lg:items-center md:max-lg:gap-6",
        className,
      )}
    >
      <div className="min-w-0 md:max-lg:flex-1">
        <h3 id="habits-sos-title" className="flex items-center gap-2 text-small font-semibold text-ink">
          <PhoneCall aria-hidden className="size-[1.125rem] shrink-0 text-danger" strokeWidth={2.25} />
          In an emergency
        </h3>
        <p className="mt-1.5 text-small/[1.5] text-pretty text-ink">
          {/* The verb stays with its number when the line wraps. */}
          {EMERGENCY_NOTE.lead} Call{" "}112 (or 108 for an ambulance) now. {EMERGENCY_NOTE.tail}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 md:max-lg:mt-0 md:max-lg:flex-none">
        <a href="tel:112" className={TEL_BUTTON}>
          <PhoneCall aria-hidden strokeWidth={2.25} />
          Call 112
        </a>
        <a href="tel:108" className={TEL_BUTTON}>
          <PhoneCall aria-hidden strokeWidth={2.25} />
          {/* Spoken as "Call ambulance 108": the name keeps the words on the button. */}
          <span>
            <span className="sr-only">Call </span>Ambulance 108
          </span>
        </a>
      </div>
    </aside>
  );
}

/** Always visible, outside the checklist's drop-down: a closed row must never hide it. */
function FastingWarning() {
  return (
    <p className="rounded-2xl bg-warning-bg px-4 py-3 text-small/[1.5] text-pretty text-warning-ink forced-colors:border forced-colors:border-[CanvasText] sm:px-5">
      <TriangleAlert aria-hidden className="float-left mt-0.5 mr-2.5 size-5 text-warning" />
      {FASTING_WARNING.text}{" "}
      <span className="text-sm whitespace-nowrap">
        <ExternalLink href={FASTING_WARNING.source.url} className="active:bg-warning/15">
          {FASTING_WARNING.source.label}
        </ExternalLink>
      </span>
    </p>
  );
}

/**
 * Every source behind the section and Take a minute, with full labels, behind one drop-down. The closed
 * row says how many there are and when they were last checked.
 */
function AllSources({ className }: { className?: string }) {
  const meta = [
    `${ALL_SOURCES.length} sources`,
    `checked ${CONTENT_REVIEW.checked}`,
    CONTENT_REVIEW.clinicalReviewer && `reviewed by ${CONTENT_REVIEW.clinicalReviewer}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={cn("nv-disc-group", className)}>
      <Disclosure id="all-sources" title="All sources" meta={meta}>
        <ul className="flex flex-col text-sm text-pretty text-ink-3">
          {ALL_SOURCES.map((s) => (
            <li key={s.url}>
              <ExternalLink href={s.url} className="flex min-h-11 w-fit items-center py-1.5 before:inset-y-0">
                {s.label}
              </ExternalLink>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}

/**
 * A quiet morning walk, from md: a picture beside the tip, as tall as its card (health-tips.css), cropped
 * to the couple. Narrower screens leave it out: in one column it was only a band between two blocks, and
 * sized 0px there it is never fetched.
 */
function WalkPhoto({ className }: { className?: string }) {
  return (
    <div className={cn("nv-habits-walk relative overflow-hidden rounded-[1.25rem] bg-aqua max-md:hidden", className)}>
      <Image
        src="/img/elder-walk.jpg"
        alt="An older couple walking and talking on a tree-lined park path in the early morning"
        fill
        // The picture fills a tall cell, so it is drawn wider than the cell it is cropped to.
        sizes="(min-width: 48rem) 560px, 0px"
        className="object-cover object-[62%_30%]"
      />
    </div>
  );
}

/**
 * Small habits, the page's coda after the callback form: something to do (Take a minute), something to
 * know (the tip of the day, then the four facts), something to prepare (the visit checklist with its
 * fasting warning), then the safety net (one emergency note, the disclaimer and every source). A gift
 * with no booking CTA anywhere in it. One grid, in reading order at every width: a column on phones,
 * two columns from md with the walk beside the tip (phones skip the walk), and from lg the tile beside the title and the
 * emergency note beside the checklist (health-tips.css).
 */
export async function HealthTips() {
  // The tip of the day and its date are per request (IST calendar day), never baked in at build time.
  await connection();
  const now = new Date();
  const todayIndex = tipOfTheDayIndex(now);
  const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(
    now,
  );

  return (
    // A sage band of its own: it sets the coda apart from the callback's light band above, and the dark
    // footer follows without a seam to draw.
    <Section id="health-tips" tone="wash" titleId="health-tips-title">
      <Container>
        <div className="nv-habits-grid grid grid-cols-1">
          <SectionTitle
            id="health-tips-title"
            title="Small habits, steady health."
            lede="The advice a good nurse leaves you with, and the source for every line."
            className="nv-habits-title"
          />

          <TakeAMinuteTile className="nv-habits-tile-cell mt-7 sm:mt-10 lg:mt-0" />

          <TipDeck
            tips={HEALTH_TIPS}
            todayIndex={todayIndex}
            dateLabel={dateLabel}
            className="nv-habits-tipcell mt-4 sm:mt-5 md:mt-6 lg:mt-16"
          />
          <WalkPhoto className="md:mt-6 lg:mt-16" />

          <section
            id="health-facts"
            aria-labelledby="health-facts-title"
            className="nv-habits-facts mt-10 scroll-mt-24 sm:mt-14 lg:mt-16"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <h3 id="health-facts-title" className="text-h3 text-balance text-ink">
                Easy to miss. Easy to check.
              </h3>
              <p className="max-w-[44ch] text-small text-pretty text-ink-3 lg:pb-0.5 xl:max-w-none">{SOURCES_NOTE}</p>
            </div>
            <FactsRow className="mt-4 sm:mt-6 lg:mt-8" />
          </section>

          <div className="nv-habits-check-cell mt-8 flex flex-col gap-3 sm:mt-10 md:mt-12 lg:mt-16">
            <VisitChecklist items={VISIT_CHECKLIST} />
            <FastingWarning />
          </div>

          <EmergencyNote className="mt-5 lg:mt-16" />
          <HealthDisclaimer className="nv-habits-small mt-5 px-0.5 md:mt-6 lg:mt-8" />
          <AllSources className="nv-habits-sources mt-4 md:mt-6 lg:mt-8" />
        </div>
      </Container>
    </Section>
  );
}
