import { Check, ChevronRight, PhoneCall } from "lucide-react";
import { connection } from "next/server";
import { BreathingCard } from "./breathing-card";
import {
  CONTENT_REVIEW,
  EMERGENCY_NOTE,
  HEALTH_FACTS,
  HEALTH_TIPS,
  VISIT_CHECKLIST,
  tipOfTheDayIndex,
  type HealthSource,
} from "./health-content";
import { ExternalLink, HealthDisclaimer } from "./health-facts";
import { Container, Section, SectionTitle, revealProps } from "./primitives";
import { TipDeck } from "./tip-deck";

/** Every unique source URL behind the featured facts and all tips, in first-seen order. */
const ALL_SOURCES: HealthSource[] = (() => {
  const seen = new Map<string, HealthSource>();
  for (const s of [...HEALTH_FACTS.filter((f) => f.featured), ...HEALTH_TIPS].flatMap((x) => x.sources)) {
    if (!seen.has(s.url)) seen.set(s.url, s);
  }
  return [...seen.values()];
})();

const TEL_LINK = "rounded-sm font-semibold text-danger underline underline-offset-2 focus-ring";

/** "Everyday care": a one-minute breathing guide, the tip of the day and a visit checklist. No CTA. */
export async function EverydayCare() {
  // The tip of the day and its date are per request (IST calendar day), never baked in at build time.
  await connection();
  const now = new Date();
  const initialIndex = tipOfTheDayIndex(now);
  const dateLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(
    now,
  );

  return (
    <Section id="health-tips" titleId="health-tips-title">
      <Container>
        <SectionTitle
          id="health-tips-title"
          title="Small habits, steady health."
          lede="Practical, sourced tips for you and your parents. Try one today, or take a calm minute before your next reading."
        />

        <div className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-12">
          <div {...revealProps(0)} className="lg:col-span-5 lg:row-span-2">
            <BreathingCard />
          </div>
          <div {...revealProps(1)} className="lg:col-span-7">
            <TipDeck tips={HEALTH_TIPS} initialIndex={initialIndex} dateLabel={dateLabel} />
          </div>
          <section
            {...revealProps(2)}
            aria-labelledby="visit-checklist-title"
            className="rounded-[2rem] bg-aqua p-6 sm:p-8 lg:col-span-7"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 id="visit-checklist-title" className="text-h3 text-ink">
                Before your nurse arrives
              </h3>
              <p className="text-small text-ink-3">A short checklist for the day of your visit</p>
            </div>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {VISIT_CHECKLIST.map((item) => (
                <li key={item.id} className="flex items-start gap-3.5 rounded-2xl bg-white p-4 shadow-xs">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-small text-pretty text-ink">{item.text}</p>
                    <p className="mt-2 text-caption text-ink-3">
                      {item.source.url ? (
                        <ExternalLink href={item.source.url}>{item.source.label}</ExternalLink>
                      ) : (
                        item.source.label
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="mt-8 flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-bg px-5 py-4 text-small text-pretty text-ink">
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

        <div className="mt-6 flex flex-col gap-3 text-caption text-muted-foreground">
          <HealthDisclaimer />
          <details className="group">
            {/* Chevron sits in the same 16px column as the Info icon above, so both text columns align. */}
            <summary className="relative flex w-fit cursor-pointer list-none items-center gap-2.5 rounded-sm font-medium text-foreground-2 focus-ring before:absolute before:-inset-x-1 before:-top-3.5 before:-bottom-3 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 transition-transform duration-160 ease-standard group-open:rotate-90"
              />
              All sources (checked {CONTENT_REVIEW.checked})
            </summary>
            <ul className="mt-3 flex flex-col gap-1.5 pl-[1.625rem] text-pretty">
              {ALL_SOURCES.map((s) => (
                <li key={s.url}>
                  <ExternalLink href={s.url}>{s.label}</ExternalLink>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </Container>
    </Section>
  );
}
