import type { CSSProperties, ReactElement } from "react";
import { cn } from "@/lib/utils";

/*
 * Programme illustrations: one calm line glyph per check-up, drawn on a 112 grid at 1:1 (size-28).
 * Line strokes are 2px (ticks 1.5px, needle 2.5px, the gauge's meter band 7px). Every shape's base
 * style is its final pose, so the glyphs read correctly without JavaScript and under reduced motion.
 * The pg-* classes are the motion hooks: landing.css section 5 plays them once on reveal (the package
 * list gets data-nv-revealed), check-ups.css once more on hover or focus of the card. Server component, no hooks.
 */

export type GlyphKind = "heart" | "drop" | "rings" | "gauge";
export type ProgrammeStyle = { tint: string; glyph: GlyphKind };

export const PROGRAMME_STYLES: Record<string, ProgrammeStyle> = {
  "essential-vitals": { tint: "var(--sky-tint)", glyph: "gauge" },
  "heart-check": { tint: "var(--rose-tint)", glyph: "heart" },
  "diabetes-care": { tint: "var(--marigold-tint)", glyph: "drop" },
  "complete-home-checkup": { tint: "var(--aqua)", glyph: "rings" },
};

export const DEFAULT_PROGRAMME_STYLE: ProgrammeStyle = { tint: "var(--aqua)", glyph: "rings" };

export function programmeStyle(slug: string): ProgrammeStyle {
  // hasOwn: an admin slug such as "constructor" must not resolve to an Object.prototype member.
  return Object.hasOwn(PROGRAMME_STYLES, slug) ? PROGRAMME_STYLES[slug] : DEFAULT_PROGRAMME_STYLE;
}

const DROP = "M56 14S26 48 26 70a30 30 0 0060 0C86 48 56 14 56 14z";

/** Stroke width on the 112 grid. `bold` (the 40px phone tile) adds 1.5 so a 2px line still draws at ~1.3px. */
type Stroke = (w: number) => number;

/** Heart Check: an ECG (P, QRS, T) crosses a heart. The heart beats once on reveal and on hover. */
function HeartGlyph({ sw }: { sw: Stroke }) {
  return (
    <>
      <g className="pg-heart-h">
        <g className="pg-heart">
          <path
            d="M56 90C30 72 16 57 16 40c0-12 9-20 20-20 8 0 15 4 20 12 5-8 12-12 20-12 11 0 20 8 20 20 0 17-14 32-40 50z"
            fill="var(--white)"
            fillOpacity={0.7}
            stroke="var(--glyph-rose)"
            strokeWidth={sw(2)}
            strokeLinejoin="round"
          />
        </g>
      </g>
      <path
        d="M6 58H31c1.5-4 5-4 6.5 0H45l3 4 8-26 6 32 4-10h6c2-6 8-6 10 0H106"
        stroke="var(--teal)"
        strokeWidth={sw(2)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** Diabetes Care: a drop whose sugar level rises and settles. */
function DropGlyph({ clipId, sw }: { clipId: string; sw: Stroke }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={DROP} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="112" height="112" fill="var(--white)" fillOpacity={0.7} />
        <g className="pg-level-h">
          <g className="pg-level">
            <path d="M8 66c14-6 28 6 48 0s34-6 48 0v46H8z" fill="var(--glyph-amber)" fillOpacity={0.24} />
          </g>
        </g>
      </g>
      <path d={DROP} stroke="var(--glyph-amber)" strokeWidth={sw(2)} strokeLinejoin="round" />
      {/* Glint: gives the drop volume once the level has settled behind it. */}
      <path d="M38 74a18 18 0 0010 14" stroke="var(--white)" strokeWidth={sw(2)} strokeLinecap="round" />
    </>
  );
}

/** Complete Home Check-up: three vital rings draw in around the logo's roof-and-pulse line. */
function RingsGlyph({ sw }: { sw: Stroke }) {
  const ring = (r: number, k: number, stroke: string, opacity?: number) => (
    <circle
      cx="56"
      cy="56"
      r={r}
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={sw(2)}
      strokeLinecap="round"
      pathLength={1}
      className="pg-arc"
      style={{ "--k": k } as CSSProperties}
      transform="rotate(-90 56 56)"
    />
  );
  return (
    <g className="pg-rings-h">
      {ring(42, 0, "var(--sage)")}
      {ring(32, 1, "var(--teal)", 0.55)}
      {ring(22, 2, "var(--teal)")}
      <path
        d="M42 59H48L56 47.5L61.2 64.5L64.4 59H70"
        stroke="var(--teal-deep)"
        strokeWidth={sw(2)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Essential Vitals: a BP dial whose needle settles on its reading with no overshoot. Pivot (56, 74). */
function GaugeGlyph({ sw }: { sw: Stroke }) {
  return (
    <>
      <path d="M14 74a42 42 0 0184 0" stroke="var(--glyph-sky)" strokeOpacity={0.22} strokeWidth={sw(7)} strokeLinecap="round" />
      {/* The reading: the band ends at 60deg, on the third tick, and the needle points at it. */}
      <path d="M14 74A42 42 0 0177 37.63" stroke="var(--glyph-sky)" strokeWidth={sw(7)} strokeLinecap="round" />
      <path
        d="M82.4 58.75l2.6-1.5M71.25 47.6l1.5-2.6M56 43.5v-3M40.75 47.6l-1.5-2.6M29.6 58.75l-2.6-1.5"
        stroke="var(--glyph-sky)"
        strokeOpacity={0.5}
        strokeWidth={sw(1.5)}
        strokeLinecap="round"
      />
      <g className="pg-needle-h">
        <g className="pg-needle">
          <path d="M56 74L69.5 50.62" stroke="var(--ink)" strokeWidth={sw(2.5)} strokeLinecap="round" />
        </g>
      </g>
      <circle cx="56" cy="74" r={sw(5)} fill="var(--ink)" />
      <circle cx="56" cy="74" r="1.75" fill="var(--white)" />
    </>
  );
}

const REGULAR: Stroke = (w) => w;
const BOLD: Stroke = (w) => w + 1.5;

/**
 * `bold` is for the 40px phone tile, where the 2px lines of the 112 grid would draw at under a pixel.
 * `uid` keeps ids unique when one package's glyph renders twice (the phone row and the card head).
 */
export function ProgrammeGlyph({
  slug,
  className,
  bold = false,
  uid = "",
}: {
  slug: string;
  className?: string;
  bold?: boolean;
  uid?: string;
}): ReactElement {
  const { glyph } = programmeStyle(slug);
  const sw = bold ? BOLD : REGULAR;
  return (
    // Reduced motion: no animation at all. The global rule only shortens durations, so a delayed
    // one-shot (needle 250ms, arcs 200-440ms) would still hold its start pose and then jump.
    <svg
      viewBox="0 0 112 112"
      fill="none"
      aria-hidden
      className={cn("pg-glyph motion-reduce:[&_*]:animate-none!", className)}
    >
      {glyph === "heart" && <HeartGlyph sw={sw} />}
      {glyph === "drop" && <DropGlyph clipId={`pg-drop-${slug}${uid && `-${uid}`}`} sw={sw} />}
      {glyph === "rings" && <RingsGlyph sw={sw} />}
      {glyph === "gauge" && <GaugeGlyph sw={sw} />}
    </svg>
  );
}
