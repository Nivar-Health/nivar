import type { JSX, ReactNode } from "react";

/* The phone bar's glyphs (bottom-bar.tsx): a line icon, and for the current tab a filled one stacked
   over it. Path data copied from lucide v1.55.0 (ISC licence, lucide-react/dist/esm/icons): briefcase-medical,
   clipboard-list, heart, user-round and menu. The filled variants are drawn from the same paths. */

export type GlyphKind = "services" | "check-ups" | "health" | "nurse" | "menu";

const SVG = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const HEART =
  "M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5";

/* Each icon's stroked paths are joined into one path element: the same data, drawn the same way
   (every subpath keeps its own round caps). */
const LINE: Readonly<Record<GlyphKind, ReactNode>> = {
  services: (
    <>
      <path d="M12 11v4M14 13h-4M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M18 6v14M6 6v14" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </>
  ),
  "check-ups": (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </>
  ),
  health: <path d={HEART} />,
  nurse: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  menu: <path d="M4 5h16M4 12h16M4 19h16" />,
};

/** The current tab's look. Each covers its line glyph completely, so only it needs to fade. */
const FILL: Readonly<Partial<Record<GlyphKind, ReactNode>>> = {
  services: (
    <>
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" strokeWidth={2} />
      <rect width="20" height="14" x="2" y="6" rx="2" fill="currentColor" />
      <path d="M12 11v4M14 13h-4" stroke="#fff" strokeWidth={2.25} />
    </>
  ),
  "check-ups": (
    <>
      <path
        d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2Z"
        fill="currentColor"
      />
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" fill="#fff" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" stroke="#fff" strokeWidth={2.25} />
    </>
  ),
  health: <path d={HEART} fill="currentColor" />,
  nurse: (
    <>
      <circle cx="12" cy="8" r="5" fill="currentColor" />
      <path d="M20 21a8 8 0 0 0-16 0Z" fill="currentColor" />
    </>
  ),
};

/** A 24px tab glyph. Decorative: the tab's label names it. */
export function TabGlyph({ kind }: { kind: GlyphKind }): JSX.Element {
  const fill = FILL[kind];
  return (
    <span aria-hidden className="nv-tabbar-glyph" data-kind={kind}>
      <svg data-v="line" {...SVG}>
        {LINE[kind]}
      </svg>
      {fill && (
        <svg data-v="fill" {...SVG}>
          {fill}
        </svg>
      )}
    </span>
  );
}
