import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

/*
 * Care illustrations for the four nursing services, shown wherever a service has no photo (a frame that
 * fails the nurse's check loses its `photo`): one calm line scene per service, in the language of
 * programme-glyphs.tsx (2px teal strokes, white fills at 0.7, one accent colour per scene). Drawn on a
 * 4:3 canvas (240×180) with the subject inside the centre square, so `preserveAspectRatio="xMidYMid
 * slice"` crops it to a square for the phone tiles and the 96px thumbnail. Strokes don't scale
 * (services.css), so they stay 2px on screen at every size.
 * Every shape's base style is its final pose: the scenes read without JavaScript and under reduced
 * motion. The nv-care-* classes are motion hooks for services.css: once when the card is revealed
 * (data-nv-revealed) and once on hover or keyboard focus (*-h wrappers). Server component, no hooks.
 */

export type CareGlyphKind = "injections" | "iv-drips" | "wound-care" | "blood-tests";

/** The mat behind each scene. */
export const CARE_TINT: Record<CareGlyphKind, string> = {
  injections: "var(--aqua)",
  "iv-drips": "var(--sky-tint)",
  "wound-care": "var(--marigold-tint)",
  "blood-tests": "var(--rose-tint)",
};

const LINE = "var(--teal)";
const GLASS = { fill: "var(--white)", fillOpacity: 0.7 } as const;
const OUTLINE = { stroke: LINE, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/* ---- Injections: a syringe draws from an upturned vial. The plunger eases back while the barrel fills
   and the vial's level falls. Local axis is vertical; the group is tilted 30deg. ---- */

const VIAL = "M-14 -69a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v18c0 4.5-2.5 7.5-6 9v5h-16v-5c-3.5-1.5-6-4.5-6-9z";
const MED = "var(--teal)";

function InjectionScene() {
  return (
    <>
      <defs>
        <clipPath id="nv-care-vial">
          <path d={VIAL} />
        </clipPath>
        <clipPath id="nv-care-barrel">
          <rect x="-11" y="-10" width="22" height="52" rx="3" />
        </clipPath>
      </defs>
      <g transform="translate(120 90) rotate(30) scale(0.9) translate(0 -4.5)">
        {/* The needle runs up into the vial; the glass fill softens the part inside it. */}
        <path d="M0 -16V-54" stroke={LINE} strokeWidth={1.5} strokeLinecap="round" />
        <path d={VIAL} {...GLASS} />
        <g clipPath="url(#nv-care-vial)">
          <g className="nv-care-vial-h">
            <g className="nv-care-vial">
              <rect x="-14" y="-60" width="28" height="23" fill={MED} fillOpacity={0.22} />
              <path d="M-14 -60H14" stroke={MED} strokeOpacity={0.55} strokeWidth={1.5} />
            </g>
          </g>
        </g>
        <path d={VIAL} {...OUTLINE} />
        <path d="M-7.5 -69v9" stroke="var(--white)" strokeWidth={2} strokeLinecap="round" />
        <rect x="-11" y="-38" width="22" height="9" rx="2.5" fill="var(--jade)" />
        <path d="M-3 -16h6l3 6h-12z" fill="var(--white)" {...OUTLINE} />

        <rect x="-11" y="-10" width="22" height="52" rx="3" {...GLASS} />
        <g clipPath="url(#nv-care-barrel)">
          <g className="nv-care-fill-h">
            <rect className="nv-care-fill" x="-11" y="-10" width="22" height="34" fill={MED} fillOpacity={0.22} />
          </g>
        </g>
        <path
          className="nv-care-fine"
          d="M11 -2h-5M11 6h-3M11 14h-5M11 22h-3M11 30h-5"
          stroke={LINE}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <g className="nv-care-plunger-h">
          <g className="nv-care-plunger">
            <rect x="-10" y="24" width="20" height="6" rx="1.5" fill="var(--jade)" />
            <rect x="-3" y="30" width="6" height="49" fill="var(--white)" {...OUTLINE} />
            <rect x="-14" y="79" width="28" height="5" rx="2.5" fill="var(--white)" {...OUTLINE} />
          </g>
        </g>
        <rect x="-11" y="-10" width="22" height="52" rx="3" {...OUTLINE} />
        <path d="M-6 -4v24" stroke="var(--white)" strokeWidth={2} strokeLinecap="round" />
        <rect x="-22" y="42" width="44" height="5" rx="2.5" fill="var(--white)" {...OUTLINE} />
      </g>
    </>
  );
}

/* ---- IV drips: a bag on its hook, the drip chamber and the line. One drop falls into the chamber's
   pool and the next one forms; the line flows once. ---- */

const BAG =
  "M98 26h36a10 10 0 0 1 10 10v42c0 8-4 13-11 16l-8 4h-18l-8-4c-7-3-11-8-11-16v-42a10 10 0 0 1 10-10z";
const IV_LINE = "M116 146v4c0 9 7 14 17 14h117";
const DRIP = "var(--sky-ink)";

function DripScene() {
  return (
    <>
      <defs>
        <clipPath id="nv-care-bag">
          <path d={BAG} />
        </clipPath>
        <clipPath id="nv-care-chamber">
          <rect x="106" y="106" width="20" height="40" rx="7" />
        </clipPath>
      </defs>
      <rect x="110" y="13" width="12" height="15" rx="3" fill="var(--white)" {...OUTLINE} />
      <path d="M116 -2v19" stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <path d={BAG} {...GLASS} />
      <g clipPath="url(#nv-care-bag)">
        <rect x="88" y="46" width="56" height="52" fill={DRIP} fillOpacity={0.16} />
        <path d="M88 46h56" stroke={DRIP} strokeOpacity={0.5} strokeWidth={1.5} />
      </g>
      <rect x="99" y="56" width="32" height="22" rx="3" fill="var(--white)" fillOpacity={0.9} />
      <path
        className="nv-care-fine"
        d="M105 63h20M105 69h13M144 52h-5M144 62h-3M144 72h-5"
        stroke={LINE}
        strokeOpacity={0.45}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path d={BAG} {...OUTLINE} />
      <rect x="111" y="97" width="10" height="9" rx="1.5" fill="var(--white)" {...OUTLINE} />

      <rect x="106" y="106" width="20" height="40" rx="7" {...GLASS} />
      <g clipPath="url(#nv-care-chamber)">
        <rect x="106" y="137" width="20" height="9" fill={DRIP} fillOpacity={0.28} />
        <path d="M106 137h20" stroke={DRIP} strokeOpacity={0.5} strokeWidth={1.5} />
      </g>
      {/* Transient marks rest invisible, so the hover replay gets its own copy (-h). */}
      <ellipse className="nv-care-ripple" cx="116" cy="137" rx="6" ry="1.8" stroke={DRIP} strokeWidth={1.5} />
      <ellipse className="nv-care-ripple-h" cx="116" cy="137" rx="6" ry="1.8" stroke={DRIP} strokeWidth={1.5} />
      <g className="nv-care-drop-h">
        <path
          className="nv-care-drop"
          d="M116 112c2.4 2.9 4 5.1 4 6.9a4 4 0 0 1-8 0c0-1.8 1.6-4 4-6.9z"
          fill={DRIP}
          fillOpacity={0.8}
        />
      </g>
      <path d="M116 106v6" stroke={LINE} strokeWidth={2} strokeLinecap="round" />
      <rect x="106" y="106" width="20" height="40" rx="7" {...OUTLINE} />

      {/* The line is a tube: teal walls round a pale core, so the flow can run inside it. */}
      <path d={IV_LINE} stroke={LINE} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={IV_LINE} stroke="var(--sky-tint)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path className="nv-care-flow" d={IV_LINE} stroke={DRIP} strokeWidth={2} />
      <path className="nv-care-flow-h" d={IV_LINE} stroke={DRIP} strokeWidth={2} />
      <rect x="164" y="157" width="22" height="14" rx="3.5" fill="var(--white)" {...OUTLINE} />
      <circle cx="175" cy="164" r="3" stroke={LINE} strokeWidth={1.5} />
    </>
  );
}

/* ---- Wound care: a forearm comes in from the edge, palm down; a dressing settles on it with a soft
   press. Local axis: the wrist at x=0, the hand pointing right. ---- */

const ARM =
  "M-200 -19C-120 -19.5 -40 -16 0 -12.5C4 -12 8 -12.5 11 -14C16 -19 22 -25 28 -28.5C32 -30.5 36 -28 34 -24.5C31 -20 26 -16 25 -13.5C34 -13 46 -12 56 -10C63 -8.5 64.5 -2 64 1C63.5 5 61 9.5 55 10.5C44 12 30 13.5 20 13.5C12 13.5 5 12.5 0 12.5C-40 15.5 -120 19.5 -200 19z";
const AMBER = "var(--glyph-amber)";

function WoundScene() {
  return (
    <g transform="translate(120 96) rotate(-8) scale(1.1) translate(-3.5 0)">
      <path d={ARM} {...GLASS} />
      <path
        className="nv-care-fine"
        d="M63 -5.5C55 -6 48 -6.5 42 -6.5M64 0C56 0 48 0 41 0M62 5C55 5.5 48 6 42 6.5"
        stroke={LINE}
        strokeOpacity={0.5}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path d={ARM} {...OUTLINE} />
      <ellipse className="nv-care-press" cx="-30" cy="0" rx="34" ry="20" stroke={AMBER} strokeWidth={1.5} />
      <ellipse className="nv-care-press-h" cx="-30" cy="0" rx="34" ry="20" stroke={AMBER} strokeWidth={1.5} />
      <g className="nv-care-dressing-h">
        <g className="nv-care-dressing">
          <g className="nv-care-pressed">
            <rect x="-55" y="-12" width="50" height="24" rx="6" fill="var(--white)" fillOpacity={0.96} />
            <rect x="-42" y="-6.5" width="24" height="13" rx="3" fill="var(--marigold)" fillOpacity={0.32} />
            <rect x="-42" y="-6.5" width="24" height="13" rx="3" stroke={AMBER} strokeOpacity={0.55} strokeWidth={1.5} />
            <rect x="-55" y="-12" width="50" height="24" rx="6" stroke={AMBER} strokeWidth={2} />
          </g>
        </g>
      </g>
    </g>
  );
}

/* ---- Blood tests: a capped tube in a small rack fills to its line, then the cap settles. ---- */

const TUBE = "M110 46V132a10 10 0 0 0 20 0V46z";
const ROSE = "var(--glyph-rose)";

function TubeScene() {
  const side = (x: number) => (
    <g key={x}>
      <path d={`M${x} 66V134a8 8 0 0 0 16 0V66z`} {...GLASS} />
      <path d={`M${x} 66V134a8 8 0 0 0 16 0V66`} {...OUTLINE} strokeOpacity={0.5} />
      <rect x={x - 3} y="54" width="22" height="14" rx="3" fill="var(--white)" {...OUTLINE} strokeOpacity={0.5} />
    </g>
  );
  return (
    <>
      <defs>
        <clipPath id="nv-care-tube">
          <path d={TUBE} />
        </clipPath>
      </defs>
      {side(80)}
      {side(144)}
      <path d={TUBE} {...GLASS} />
      <g clipPath="url(#nv-care-tube)">
        <g className="nv-care-level-h">
          <g className="nv-care-level">
            <rect x="110" y="74" width="20" height="70" fill="var(--rose)" fillOpacity={0.3} />
            <path d="M110 74q10 3 20 0" stroke={ROSE} strokeOpacity={0.6} strokeWidth={1.5} />
          </g>
        </g>
      </g>
      <path d={TUBE} {...OUTLINE} />
      <path d="M116 56v40" stroke="var(--white)" strokeWidth={2} strokeLinecap="round" />
      <path d="M134 74h6" stroke={ROSE} strokeWidth={2} strokeLinecap="round" />
      <g className="nv-care-cap-h">
        <g className="nv-care-cap">
          <rect x="106" y="28" width="28" height="20" rx="4" fill={ROSE} />
          <path
            className="nv-care-fine"
            d="M114 32v12M120 32v12M126 32v12"
            stroke="var(--white)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      </g>
      <rect x="62" y="118" width="116" height="32" rx="7" fill="var(--white)" />
      <path
        className="nv-care-fine"
        d="M64 127h112"
        stroke={LINE}
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      <rect x="62" y="118" width="116" height="32" rx="7" {...OUTLINE} />
    </>
  );
}

const SCENES: Record<CareGlyphKind, () => ReactElement> = {
  injections: InjectionScene,
  "iv-drips": DripScene,
  "wound-care": WoundScene,
  "blood-tests": TubeScene,
};

export function isCareGlyph(id: string): id is CareGlyphKind {
  return Object.hasOwn(SCENES, id);
}

export function CareGlyph({ kind, className }: { kind: CareGlyphKind; className?: string }): ReactElement {
  const Scene = SCENES[kind];
  return (
    <svg
      viewBox="0 0 240 180"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden
      className={cn("nv-care-glyph", className)}
      data-glyph={kind}
    >
      <circle cx="120" cy="90" r="68" fill="var(--white)" fillOpacity={0.55} />
      <Scene />
    </svg>
  );
}
