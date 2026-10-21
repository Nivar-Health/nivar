import { ChevronRight, PhoneCall } from "lucide-react";
import { connection } from "next/server";
import {
  ALL_SOURCES,
  CONTENT_REVIEW,
  EMERGENCY_NOTE,
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

const TEL_LINK = "rounded-sm font-semibold text-danger underline underline-offset-2 focus-ring";

/** The one emergency note in this section (the footer keeps its own line). */
function EmergencyNote() {
  return (
    <p className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-small/[1.5] text-pretty text-ink sm:px-5 sm:py-4 sm:text-small">
      <PhoneCall aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
      <span>
        {EMERGENCY_NOTE.lead} Call{" "}
        <a href="tel:112" className={TEL_LINK}>
          112
        </a>{" "}
        (or{" "}
        <a href="tel:108" className={TEL_LINK}>
          108
        </a>{" "}
        for an ambulance) now. {EMERGENCY_NOTE.tail}
      </span>
    </p>
  );
}

/** Every source behind the section and Take a minute, behind one disclosure. */
function AllSources() {
  return (
    <details className="group text-caption text-ink-3">
      {/* The chevron sits in the disclaimer's 16px icon column, so both text columns align. */}
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2.5 rounded-sm font-medium text-foreground-2 focus-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 transition-transform duration-160 ease-standard group-open:rotate-90"
        />
        All sources (checked {CONTENT_REVIEW.checked})
      </summary>
      <ul className="flex flex-col pb-1 pl-[1.625rem] text-pretty">
        {ALL_SOURCES.map((s) => (
          <li key={s.url}>
            <ExternalLink href={s.url} className="flex min-h-11 w-fit items-center py-1.5">
              {s.label}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Small habits: the four facts, the tip of the day, the way into Take a minute and the visit checklist,
 * with one emergency note, the disclaimer and every source. A gift with no booking CTA anywhere in it.
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
        <SectionTitle
          id="health-tips-title"
          title="Small habits, steady health."
          lede="The advice a good nurse leaves you with, and the source for every line."
        />

        <section id="health-facts" aria-labelledby="health-facts-title" className="mt-8 scroll-mt-24 sm:mt-14 lg:mt-16">
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

        <div className="mt-8 grid gap-3 sm:mt-14 sm:gap-4 lg:mt-16 lg:grid-cols-12 lg:gap-5">
          <TipDeck
            tips={HEALTH_TIPS}
            initialIndex={initialIndex}
            dateLabel={dateLabel}
            className="lg:col-span-7"
          />
          <TakeAMinuteTile className="lg:col-span-5" />
          <VisitChecklist items={VISIT_CHECKLIST} className="lg:col-span-7" />
          <div className="mt-1 flex flex-col gap-3 sm:gap-4 lg:col-span-5 lg:mt-0">
            <EmergencyNote />
            <HealthDisclaimer className="px-0.5" />
            <AllSources />
          </div>
        </div>
      </Container>
    </Section>
  );
}
