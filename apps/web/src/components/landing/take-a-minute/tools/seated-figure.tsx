import type { RestPart } from "./copy";

/* The Rest tool's line drawing: someone seated for a blood pressure reading, back against the chair,
   feet flat, forearm on a table at chest height, the cuff on the upper arm, a clock for the 30 minutes
   and a closed mouth for "no talking". 96px; pond strokes 1.75px at 45%. Each tick lights its part in
   jade at 2.5px over a 12% jade disc (spec §5.6), fading opacity only. */

const BODY = [
  // head
  "M39.5 15.5a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0",
  // upper arm, shoulder to the cuff, then the cuff to the elbow
  "M31.55 34.85 28.7 30.2A3.25 3.25 0 0 1 34.3 26.8L37.15 31.45",
  "M40.48 36.88 43.8 42.3Q44.6 41.5 46 41.5",
  "M34.88 40.28 38.2 45.7Q39.4 47.5 41.5 47.5",
  // belly below the arm, thigh, knee and shin
  "M41.5 50C42.2 53 43 56 44.5 58H63C66.5 58 68.3 60.5 68 63.5L67 84",
  // under the thigh past the seat, and the calf
  "M50 70H57.5C59.5 70 60.3 72 60.4 75L60.5 84",
  // seat, legs, table leg and floor
  "M22 70H50M48 70V90M22 70V90",
  "M86 47.5V90",
  "M12 90H92",
];

const PARTS: Record<RestPart, { d: string; disc: readonly [number, number, number] }> = {
  bladder: { d: "M30.3 62a3.2 2.6 0 1 0 6.4 0a3.2 2.6 0 1 0-6.4 0", disc: [33.5, 62, 6] },
  back: {
    d: "M22 30V70M28.6 22.2C26 26 25.2 32 25 40C24.9 50 25.2 58 26 63C26.6 66.5 28 69 31 70",
    disc: [24, 47, 10],
  },
  feet: { d: "M60.5 84V90H76C76.6 87.6 74.5 86 67 84", disc: [68, 87, 8.5] },
  arm: { d: "M46 41.5H68.5C71.5 41.5 71.5 47.5 68.5 47.5M41.5 47.5H90", disc: [57, 44.5, 10] },
  cuff: { d: "M37.97 30.93 41.3 36.36 34.06 40.8 30.73 35.37Z", disc: [36, 35.9, 7.5] },
  clock: { d: "M87.5 16a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0M81 12.2V16H84", disc: [81, 16, 9.5] },
  mouth: { d: "M35.8 18.9H38.4", disc: [37.2, 18.9, 4.5] },
};

const ORDER = Object.keys(PARTS) as RestPart[];

export function SeatedFigure({ lit }: { lit: ReadonlySet<RestPart> }) {
  return (
    <svg aria-hidden viewBox="0 0 96 96" className="nv-tool-figure">
      {BODY.map((d) => (
        <path key={d} d={d} className="nv-tool-line" />
      ))}
      {ORDER.map((part) => {
        const { d, disc } = PARTS[part];
        return (
          <g key={part} data-part={part} data-lit={lit.has(part) ? "" : undefined}>
            <circle cx={disc[0]} cy={disc[1]} r={disc[2]} className="nv-tool-part-disc" />
            <path d={d} className="nv-tool-line nv-tool-part-base" />
            <path d={d} className="nv-tool-part-lit" />
          </g>
        );
      })}
    </svg>
  );
}
