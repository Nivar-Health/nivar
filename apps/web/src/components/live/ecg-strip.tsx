import { useId } from "react";
import { cn } from "@/lib/utils";

export type EcgStripProps = {
  /** Samples in millivolts. */
  samples: number[];
  sampleRate?: number;
  heartRate?: number | null;
  lead?: string;
  /** Seconds per printed row (default 5). Long captures wrap into rows. */
  secondsPerRow?: number;
  /** "paper" = classic pink ECG paper, "brand" = Nivar mist paper with a pine-ink trace. */
  variant?: "paper" | "brand";
  /** Optional caption shown on the right of the footer, e.g. capture time. */
  caption?: string;
  className?: string;
};

const MM_PER_S = 25;
const MM_PER_MV = 10;
const ROW_MM = 30; // height of a row in mm
const CAL_MM = 7; // calibration pulse block width

const THEMES = {
  paper: { paper: "#FFF8F6", minor: "#F7D4D0", major: "#EBA59D", trace: "#1B1B1B", text: "#7A3B35" },
  brand: { paper: "#F7FAF8", minor: "#E4ECE8", major: "#C9D8D1", trace: "#10201B", text: "#5A6964" },
} as const;

/**
 * Static ECG strip, rendered as vector SVG on a millimetre grid so it prints
 * crisply. Server-safe (no hooks beyond useId).
 */
export function EcgStrip({
  samples,
  sampleRate = 250,
  heartRate,
  lead = "II",
  secondsPerRow = 5,
  variant = "paper",
  caption,
  className,
}: EcgStripProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const t = THEMES[variant];
  const perRow = Math.max(1, Math.round(secondsPerRow * sampleRate));
  const rows: number[][] = [];
  for (let i = 0; i < samples.length; i += perRow) rows.push(samples.slice(i, i + perRow));
  if (rows.length === 0) rows.push([]);
  const rowWidthMm = CAL_MM + secondsPerRow * MM_PER_S;
  const heightMm = rows.length * ROW_MM;
  const baseline = ROW_MM * 0.66;
  const seconds = samples.length / sampleRate;

  return (
    <figure
      className={cn("w-full overflow-hidden rounded-lg border", className)}
      style={{ borderColor: t.major, background: t.paper, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <svg
        viewBox={`0 0 ${rowWidthMm} ${heightMm}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`ECG strip, lead ${lead}, ${seconds.toFixed(1)} seconds${heartRate ? `, ${heartRate} bpm` : ""}`}
      >
        <defs>
          <pattern id={`minor-${uid}`} width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke={t.minor} strokeWidth="0.06" />
          </pattern>
          <pattern id={`major-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill={`url(#minor-${uid})`} />
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke={t.major} strokeWidth="0.14" />
          </pattern>
        </defs>
        <rect width={rowWidthMm} height={heightMm} fill={t.paper} />
        <rect width={rowWidthMm} height={heightMm} fill={`url(#major-${uid})`} />

        {rows.map((row, r) => {
          const y0 = r * ROW_MM + baseline;
          // 1 mV calibration pulse: 0.2 s wide, 10 mm tall.
          const cal = `M 0.5 ${y0} L 1.5 ${y0} L 1.5 ${y0 - MM_PER_MV} L 6.5 ${y0 - MM_PER_MV} L 6.5 ${y0} L ${CAL_MM} ${y0}`;
          let d = "";
          for (let i = 0; i < row.length; i++) {
            const x = CAL_MM + (i / sampleRate) * MM_PER_S;
            const v = Number.isFinite(row[i]) ? row[i] : 0;
            const y = y0 - Math.max(-1.8, Math.min(2.2, v)) * MM_PER_MV;
            d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
          }
          return (
            <g key={r}>
              <path d={cal} fill="none" stroke={t.trace} strokeWidth="0.32" strokeLinejoin="round" />
              {d && (
                <path d={d} fill="none" stroke={t.trace} strokeWidth="0.3" strokeLinejoin="round" strokeLinecap="round" />
              )}
              <text x={CAL_MM + 1.2} y={r * ROW_MM + 3.6} fontSize="2.6" fontWeight="600" fill={t.text} fontFamily="ui-sans-serif, system-ui">
                {lead}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-3 py-1.5 text-[11px] tabular-nums"
        style={{ borderColor: t.minor, color: t.text }}
      >
        <span>
          Lead {lead} · {MM_PER_S} mm/s · {MM_PER_MV} mm/mV · {seconds.toFixed(1)} s
        </span>
        <span>
          {heartRate ? <strong className="font-semibold">{Math.round(heartRate)} bpm</strong> : null}
          {heartRate && caption ? " · " : null}
          {caption}
        </span>
      </figcaption>
    </figure>
  );
}
