"use client";

import {
  ArrowLeft,
  ArrowRight,
  Droplet,
  Footprints,
  Gauge,
  HeartPulse,
  Moon,
  Soup,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HealthSource, HealthTip, TipCategory } from "./health-content";
import { buttonClass } from "./primitives";

const TIP_ICONS: Record<TipCategory, LucideIcon> = {
  Checks: Gauge,
  Heart: HeartPulse,
  Food: Soup,
  Movement: Footprints,
  Sleep: Moon,
  Sugar: Droplet,
  Breath: Wind,
};

const TIP_TONES: Record<TipCategory, string> = {
  Checks: "bg-sky-tint text-sky-ink",
  Heart: "bg-rose-tint text-rose-ink",
  Food: "bg-marigold-tint text-marigold-ink",
  Movement: "bg-aqua text-primary",
  Sleep: "bg-sky-tint text-sky-ink",
  Sugar: "bg-marigold-tint text-marigold-ink",
  Breath: "bg-aqua text-primary",
};

/** Underlined source link that opens in a new tab. Client twin of the one in health-facts.tsx. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "rounded-sm underline decoration-border-strong underline-offset-[3px] hover:text-foreground hover:decoration-current focus-ring",
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function TipSources({ sources }: { sources: readonly HealthSource[] }) {
  return (
    <p className="mt-5 text-caption text-ink-3">
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

function TipBody({ tip, titleId }: { tip: HealthTip; titleId?: string }) {
  const Icon = TIP_ICONS[tip.category];
  return (
    <>
      <span className={cn("inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1.5 text-sm font-semibold", TIP_TONES[tip.category])}>
        <span className="flex size-6 items-center justify-center rounded-full bg-white">
          <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
        </span>
        {tip.category}
      </span>
      <h3 id={titleId} className="mt-5 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-balance text-ink">
        {tip.title}
      </h3>
      <p className="mt-3 text-body text-pretty text-ink-2">{tip.text}</p>
      <TipSources sources={tip.sources} />
    </>
  );
}

/**
 * Tip of the day (IST calendar day) with manual Previous / Next that wrap around.
 * Never auto-advances. Every tip is rendered invisibly underneath so the card keeps the height of
 * the longest tip, and the visible copy sits in a polite live region that only changes on click.
 */
export function TipDeck({
  tips,
  initialIndex,
  dateLabel,
}: {
  tips: readonly HealthTip[];
  initialIndex: number;
  dateLabel: string;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [dir, setDir] = useState<1 | -1>(1);
  const [touched, setTouched] = useState(false);
  const titleId = useId();
  const tip = tips[index];
  const isToday = index === initialIndex;

  const go = (step: 1 | -1) => {
    setDir(step);
    setTouched(true);
    setIndex((i) => (i + step + tips.length) % tips.length);
  };

  return (
    <article
      aria-labelledby={titleId}
      className="flex h-full flex-col rounded-[2rem] bg-white p-6 shadow-[0_24px_50px_-32px_rgb(1_43_54/0.45)] ring-1 ring-ink/5 sm:p-9"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="rounded-full bg-aqua px-3 py-1 text-sm font-semibold text-primary">
          {isToday ? "Tip of the day" : "Health tip"}
        </p>
        {isToday && <p className="text-small font-medium text-ink-3">{dateLabel}</p>}
      </div>

      <div className="mt-7 grid flex-1">
        {tips.map((t) => (
          <div key={t.id} aria-hidden className="invisible [grid-area:1/1]">
            <TipBody tip={t} />
          </div>
        ))}
        <div aria-live="polite" aria-atomic="true" className="[grid-area:1/1]">
          <div key={tip.id} className={touched ? "tip-in" : undefined} style={{ "--dir": dir } as CSSProperties}>
            <span className="sr-only">
              Tip {index + 1} of {tips.length}.{" "}
            </span>
            <TipBody tip={tip} titleId={titleId} />
          </div>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-4 border-t border-border pt-5">
        <div aria-hidden className="flex items-center gap-1.5">
          {tips.map((t, i) => (
            <span
              key={t.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 ease-calm",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border-strong",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous tip"
            onClick={() => go(-1)}
            className={buttonClass("secondary", "size-11 px-0")}
          >
            <ArrowLeft aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next tip"
            onClick={() => go(1)}
            className={buttonClass("secondary", "size-11 px-0")}
          >
            <ArrowRight aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
