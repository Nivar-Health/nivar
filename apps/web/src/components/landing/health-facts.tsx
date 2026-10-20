import { Info } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  CONTENT_REVIEW,
  HEALTH_DISCLAIMER,
  HEALTH_FACTS,
  SOURCES_NOTE,
  type HealthFact,
  type HealthSource,
} from "./health-content";
import { Container, Section, SectionTitle, revealProps } from "./primitives";

/** Underlined source link that opens in a new tab (server-rendered; no client JS). */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "rounded-sm underline decoration-current/30 underline-offset-[3px] hover:text-foreground hover:decoration-current focus-ring",
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** "Source: a; b" as new-tab links. */
export function SourceLinks({ sources, className }: { sources: readonly HealthSource[]; className?: string }) {
  return (
    <p className={cn("text-caption text-ink-3", className)}>
      {sources.length > 1 ? "Sources: " : "Source: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && "; "}
          <ExternalLink href={s.url}>{s.label}</ExternalLink>
        </span>
      ))}
    </p>
  );
}

/** Info-icon disclaimer row shared by "Health, in numbers" and "Everyday care". */
export function HealthDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex max-w-[80ch] items-start gap-2.5 text-caption text-pretty text-ink-3", className)}>
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {HEALTH_DISCLAIMER} {SOURCES_NOTE} Sources checked {CONTENT_REVIEW.checked}.
        {CONTENT_REVIEW.clinicalReviewer && ` Reviewed by ${CONTENT_REVIEW.clinicalReviewer}.`}
      </span>
    </p>
  );
}

/** Each featured fact's tint, ink and picture. Unknown ids fall back to a plain aqua card. */
const LOOK: Record<string, { tint: string; ink: string; viz: (f: HealthFact) => ReactNode }> = {
  "bp-prevalence-india": { tint: "bg-rose-tint", ink: "text-rose-ink", viz: () => <People of={3} color="var(--rose)" /> },
  "bp-unaware": { tint: "bg-sky-tint", ink: "text-sky-ink", viz: () => <Ring pct={44} color="var(--sky-ink)" /> },
  "diabetes-prediabetes-india": {
    tint: "bg-marigold-tint",
    ink: "text-marigold-ink",
    viz: () => <People of={4} color="var(--marigold)" />,
  },
  "bp-lowering-benefit": { tint: "bg-aqua", ink: "text-primary", viz: () => <Bars /> },
};

/**
 * "Most of it is silent": four sourced facts, each with a small picture of what the number means.
 * It opens the "Why Nivar Health?" page, so its title is that page's h1. No CTA.
 */
export function HealthFacts() {
  const facts = HEALTH_FACTS.filter((f) => f.featured);
  return (
    <Section id="health-facts" titleId="health-facts-title" className="pt-32 lg:pt-40">
      <Container>
        <SectionTitle
          as="h1"
          id="health-facts-title"
          eyebrow="Why Nivar Health?"
          title="Most of it is silent. Until someone checks."
          lede="High blood pressure and raised blood sugar rarely cause symptoms early on. These figures come from large public-health studies, not from Nivar patients."
        />

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {facts.map((f, i) => {
            const look = LOOK[f.id] ?? { tint: "bg-aqua", ink: "text-primary", viz: () => null };
            return (
              <li key={f.id} {...revealProps(i)}>
                <article className={cn("flex h-full flex-col rounded-[1.75rem] p-6 sm:p-7", look.tint)}>
                  <div className="flex h-20 items-center justify-between gap-4">
                    {look.viz(f)}
                    <span className="self-start rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-ink-2">
                      {f.scope}
                    </span>
                  </div>
                  <p className={cn("mt-7 flex flex-wrap items-baseline gap-x-2 text-stat tabular-nums", look.ink)}>
                    {f.figure}
                    {f.figureSuffix && (
                      <span className="text-small font-semibold tracking-normal text-ink-2">{f.figureSuffix}</span>
                    )}
                  </p>
                  <p className="mt-4 text-small text-pretty text-ink">{f.text}</p>
                  <SourceLinks sources={f.sources} className="mt-auto pt-6" />
                </article>
              </li>
            );
          })}
        </ul>

        <HealthDisclaimer className="mt-10" />
      </Container>
    </Section>
  );
}

/** "1 in N": N people, the first one coloured in (it fills once when the card scrolls in). */
function People({ of, color }: { of: number; color: string }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${of * 30} 56`} className="h-14 w-auto" fill="none">
      {Array.from({ length: of }, (_, k) => (
        <g
          key={k}
          transform={`translate(${k * 30} 0)`}
          className={k === 0 ? "fact-person" : undefined}
          style={{ "--k": k } as CSSProperties}
        >
          <circle cx="13" cy="11" r="8" fill={k === 0 ? color : "white"} stroke={k === 0 ? color : "var(--ink-3)"} strokeOpacity={k === 0 ? 1 : 0.35} strokeWidth={1.5} />
          <path
            d="M1 54v-9c0-11 5.5-17 12-17s12 6 12 17v9"
            fill={k === 0 ? color : "white"}
            stroke={k === 0 ? color : "var(--ink-3)"}
            strokeOpacity={k === 0 ? 1 : 0.35}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      ))}
    </svg>
  );
}

/** A ring filled to `pct` percent (draws once). */
function Ring({ pct, color }: { pct: number; color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 80 80" className="size-20 -rotate-90">
      <circle cx="40" cy="40" r="32" fill="none" stroke="white" strokeWidth={10} />
      <circle
        className="fact-ring"
        cx="40"
        cy="40"
        r="32"
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${pct} 100`}
        style={{ "--pct": pct } as CSSProperties}
      />
    </svg>
  );
}

/** Before and after: the second bar settles 20% lower (once). */
function Bars() {
  return (
    <svg aria-hidden viewBox="0 0 92 64" className="h-16 w-auto" fill="none">
      <rect x="2" y="4" width="34" height="58" rx="8" fill="white" />
      <rect className="fact-bar" x="46" y="15.6" width="34" height="46.4" rx="8" fill="var(--primary)" />
      <path d="M84 6v14m0 0-4-4m4 4 4-4" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
