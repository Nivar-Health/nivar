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
import { SnapRow } from "./snap-row";
import "./health-tips.css";

/**
 * Underlined source link that opens in a new tab (server-rendered; no client JS). Inline, so its press
 * is a tint only: transforms don't apply to inline boxes.
 */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "rounded-sm underline decoration-current/30 underline-offset-[3px] transition-colors duration-180 hover:text-foreground hover:decoration-current focus-ring active:bg-aqua/60 active:duration-90",
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** "Source: a; b" as new-tab links, with the cards' short labels ("All sources" keeps the full ones). */
export function SourceLinks({ sources, className }: { sources: readonly HealthSource[]; className?: string }) {
  return (
    <p className={cn("text-caption text-ink-3", className)}>
      {sources.length > 1 ? "Sources: " : "Source: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && "; "}
          <ExternalLink href={s.url} className={s.short && "whitespace-nowrap"}>
            {s.short ?? s.label}
          </ExternalLink>
        </span>
      ))}
    </p>
  );
}

/** Info-icon disclaimer row for the health content (Small habits). */
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

const PLAIN_LOOK = { tint: "bg-aqua", ink: "text-primary", viz: () => null };

/**
 * One sourced fact with a small picture of what the number means. The picture plays once as the card
 * comes into view: the card carries data-nv-reveal only to get [data-nv-revealed] (landing.css §6b);
 * health-tips.css switches the usual fade-up off, because the row has its own entrance (SnapRow).
 */
function FactCard({ fact: f }: { fact: HealthFact }) {
  const look = LOOK[f.id] ?? PLAIN_LOOK;
  return (
    <article data-nv-reveal="" className={cn("nv-habits-fact flex h-full flex-col rounded-3xl p-5 sm:p-6 lg:p-5 xl:p-6", look.tint)}>
      <div className="nv-habits-fact-head">
        <span className="nv-habits-fact-scope rounded-full bg-white/80 px-2.5 py-1 text-[0.8125rem] leading-none font-semibold whitespace-nowrap text-ink-2">
          {f.scope}
        </span>
        <p
          className={cn(
            "nv-habits-fact-figure flex flex-wrap items-baseline gap-x-2 text-[clamp(2.5rem,1.6rem+2.4vw,4rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums",
            look.ink,
          )}
        >
          {f.figure}
          {f.figureSuffix && (
            <span className="text-small font-semibold tracking-normal text-ink-2">{f.figureSuffix}</span>
          )}
        </p>
        <div className="nv-habits-fact-viz">{look.viz(f)}</div>
      </div>
      <p className="mt-3 text-small/[1.5] text-pretty text-ink sm:text-small lg:mt-5">{f.text}</p>
      <SourceLinks sources={f.sources} className="mt-auto pt-3 sm:pt-4" />
    </article>
  );
}

/**
 * "Most of it is silent": the four featured facts. A snap row on phones, 2 × 2 from md and four
 * across from lg. No CTA, here or near it (health-content.ts).
 */
export function FactsRow({ className }: { className?: string }) {
  const facts = HEALTH_FACTS.filter((f) => f.featured);
  return (
    <SnapRow
      label="Health facts"
      className={className}
      itemClassName="basis-[85%] sm:basis-[46%]"
      gridFrom="md"
      gridClassName="md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-5"
    >
      {facts.map((f) => (
        <FactCard key={f.id} fact={f} />
      ))}
    </SnapRow>
  );
}

/** "1 in N": N people, the first one coloured in (it fills once when the card scrolls in). */
function People({ of, color }: { of: number; color: string }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${of * 30} 56`} className="h-11 w-auto sm:h-12 lg:h-14" fill="none">
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
    <svg aria-hidden viewBox="0 0 80 80" className="size-14 -rotate-90 lg:size-16">
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
    <svg aria-hidden viewBox="0 0 92 64" className="h-12 w-auto xl:h-14" fill="none">
      <rect x="2" y="4" width="34" height="58" rx="8" fill="white" />
      <rect className="fact-bar" x="46" y="15.6" width="34" height="46.4" rx="8" fill="var(--primary)" />
      <path d="M84 6v14m0 0-4-4m4 4 4-4" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
