import { PhoneCall, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { cn } from "@/lib/utils";
import { Disclosure } from "./disclosure";
import {
  ALL_SOURCES,
  EMERGENCY_NOTE,
  FASTING_WARNING,
  HEALTH_TIPS,
  VISIT_CHECKLIST,
  tipOfTheDayIndex,
} from "./health-content";
import { ExternalLink, FactsRow, HealthDisclaimer } from "./health-facts";
import { Container, Section, SectionTitle } from "./primitives";
import { TakeAMinuteTile } from "./take-a-minute-tile";
import { TipDeck } from "./tip-deck";
import { VisitChecklist } from "./visit-checklist";
import "./health-tips.css";

/** 48px danger-outline call buttons: never marigold, never a jade fill. Tint and scale on press. */
const TEL_BUTTON =
  "inline-flex h-12 grow items-center justify-center gap-1.5 rounded-full border-[1.5px] border-danger bg-white px-3 text-[0.9375rem] font-semibold whitespace-nowrap text-danger focus-ring transition-[background-color,scale] duration-180 ease-standard select-none hover:bg-danger/5 active:scale-[0.97] active:bg-danger/10 active:duration-90 motion-reduce:active:scale-100 sm:grow-0 sm:px-5 [&_svg]:size-4 [&_svg]:shrink-0";

/** The one emergency note in this section (the footer keeps its own line): the sentence, then two calls. */
function EmergencyNote() {
  return (
    <div className="nv-habits-sos rounded-2xl border border-danger/20 bg-danger-bg p-4 sm:p-5">
      {/* The icon floats, so the sentence runs the full width from its second line. */}
      <p className="text-small/[1.5] text-pretty text-ink md:max-w-[31rem]">
        <PhoneCall aria-hidden className="float-left mt-0.5 mr-2.5 size-5 text-danger" />
        {EMERGENCY_NOTE.lead} Call 112 (or 108 for an ambulance) now. {EMERGENCY_NOTE.tail}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href="tel:112" className={TEL_BUTTON}>
          <PhoneCall aria-hidden strokeWidth={2.25} />
          Call 112
        </a>
        <a href="tel:108" className={TEL_BUTTON}>
          <PhoneCall aria-hidden strokeWidth={2.25} />
          Call 108 (ambulance)
        </a>
      </div>
    </div>
  );
}

/** Always visible, outside the checklist's drop-down: a closed row must never hide it. */
function FastingWarning() {
  return (
    <p className="rounded-2xl bg-warning-bg px-4 py-3 text-small/[1.5] text-pretty text-warning-ink forced-colors:border forced-colors:border-[CanvasText] sm:px-5">
      <span className="block md:max-w-[31rem]">
        <TriangleAlert aria-hidden className="float-left mt-0.5 mr-2.5 size-5 text-warning" />
        {FASTING_WARNING.text}{" "}
        <span className="text-caption whitespace-nowrap">
          <ExternalLink href={FASTING_WARNING.source.url} className="active:bg-warning/15">
            {FASTING_WARNING.source.label}
          </ExternalLink>
        </span>
      </span>
    </p>
  );
}

/** Every source behind the section and Take a minute, with full labels, behind one drop-down. */
function AllSources() {
  return (
    <div className="nv-disc-group">
      <Disclosure id="all-sources" title="All sources">
        <ul className="flex flex-col text-caption text-pretty text-ink-3">
          {ALL_SOURCES.map((s) => (
            <li key={s.url}>
              <ExternalLink href={s.url} className="flex min-h-11 w-fit items-center py-1.5">
                {s.label}
              </ExternalLink>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}

/** A quiet morning walk between the tile and the facts, phones and tablets only (lg has the grid). */
function WalkBand({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-[3/1] overflow-hidden rounded-[1.25rem] bg-aqua", className)}>
      <Image
        src="/img/elder-walk.jpg"
        alt="An older couple walking and talking on a tree-lined park path in the early morning"
        fill
        sizes="(min-width: 640px) calc(100vw - 48px), calc(100vw - 40px)"
        className="object-cover object-[50%_20%]"
      />
    </div>
  );
}

/**
 * Small habits: Take a minute first (the Health tips tab lands on it), the four facts, the tip of the
 * day, the visit checklist with its fasting warning, then one emergency note, the disclaimer and every
 * source. A gift with no booking CTA anywhere in it. One grid: a column on phones and tablets, and from
 * lg "title tile / facts facts / tip notes / check notes" (health-tips.css), in reading order.
 */
export async function HealthTips() {
  // The tip of the day and its date are per request (IST calendar day), never baked in at build time.
  await connection();
  const now = new Date();
  const initialIndex = tipOfTheDayIndex(now);
  const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(
    now,
  );

  return (
    <Section id="health-tips" titleId="health-tips-title" divider="top">
      <Container>
        <div className="nv-habits-grid grid grid-cols-1">
          <SectionTitle
            id="health-tips-title"
            title="Small habits, steady health."
            lede="The advice a good nurse leaves you with, and the source for every line."
            className="nv-habits-title"
          />

          <TakeAMinuteTile className="nv-habits-tile-cell mt-7 sm:mt-10 lg:mt-0" />
          <WalkBand className="mt-4 lg:hidden" />

          <section
            id="health-facts"
            aria-labelledby="health-facts-title"
            className="nv-habits-facts mt-7 scroll-mt-24 sm:mt-14 lg:mt-16"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <h3 id="health-facts-title" className="max-w-[24ch] text-h3 text-balance text-ink">
                Most of it is silent. Until someone checks.
              </h3>
              <p className="max-w-[44ch] text-small text-pretty text-ink-3 lg:max-w-none lg:pb-0.5">
                These figures come from large public-health studies, not from Nivar patients.
              </p>
            </div>
            <FactsRow className="mt-4 sm:mt-6 lg:mt-8" />
          </section>

          <TipDeck
            tips={HEALTH_TIPS}
            initialIndex={initialIndex}
            dateLabel={dateLabel}
            className="nv-habits-tipcell mt-7 sm:mt-14 lg:mt-16"
          />

          <div className="nv-habits-check-cell mt-5 flex flex-col gap-3 lg:mt-5">
            <VisitChecklist items={VISIT_CHECKLIST} />
            <FastingWarning />
          </div>

          <div className="nv-habits-notes mt-6 flex flex-col gap-3 sm:mt-10 sm:gap-4 lg:mt-16">
            <EmergencyNote />
            <HealthDisclaimer className="px-0.5" />
            <AllSources />
          </div>
        </div>
      </Container>
    </Section>
  );
}
