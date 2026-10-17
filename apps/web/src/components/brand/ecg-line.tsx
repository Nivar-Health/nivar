import { cn } from "@/lib/utils";

const BEAT = 200;

/** One PQRST complex starting at x, on a baseline y. */
function beat(x: number, y: number, amp: number): string {
  const a = (v: number) => (v * amp).toFixed(1);
  return [
    `L${x + 34} ${y}`,
    `Q${x + 44} ${y - +a(9)} ${x + 54} ${y}`, // P wave
    `L${x + 70} ${y}`,
    `L${x + 75} ${y + +a(6)}`, // Q
    `L${x + 82} ${y - +a(52)}`, // R
    `L${x + 89} ${y + +a(16)}`, // S
    `L${x + 95} ${y}`,
    `L${x + 116} ${y}`,
    `Q${x + 134} ${y - +a(15)} ${x + 152} ${y}`, // T wave
    `L${x + BEAT} ${y}`,
  ].join(" ");
}

function ecgPath(beats: number, y: number, amp: number): string {
  let d = `M0 ${y}`;
  for (let i = 0; i < beats; i++) d += ` ${beat(i * BEAT, y, amp)}`;
  return d;
}

/**
 * Decorative ECG trace: a faint full trace with a bright segment sweeping
 * across it like a bedside monitor. Purely visual (aria-hidden).
 * With `draw`, a single trace instead draws itself once when an ancestor is revealed
 * (`.ecg-draw` in landing.css).
 */
export function EcgLine({
  beats = 6,
  className,
  strokeClassName = "stroke-primary",
  glowClassName = "stroke-primary",
  amplitude = 1,
  animated = true,
  thin = false,
  draw = false,
}: {
  beats?: number;
  className?: string;
  strokeClassName?: string;
  glowClassName?: string;
  amplitude?: number;
  animated?: boolean;
  /** 1px hairline trace for the monochrome panels. */
  thin?: boolean;
  /** One trace that draws once on reveal; no faint underlay or sweep. */
  draw?: boolean;
}) {
  const width = beats * BEAT;
  const d = ecgPath(beats, 70, amplitude);
  if (draw) {
    return (
      <svg
        aria-hidden
        viewBox={`0 0 ${width} 120`}
        preserveAspectRatio="none"
        fill="none"
        className={cn("w-full", className)}
      >
        <path
          d={d}
          pathLength={1}
          className={cn(strokeClassName, "ecg-draw")}
          strokeWidth={thin ? 1.5 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 120`}
      preserveAspectRatio="none"
      fill="none"
      className={cn("w-full", className)}
    >
      <path
        d={d}
        className={cn(strokeClassName, thin ? "opacity-60" : "opacity-25")}
        strokeWidth={thin ? 1 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {animated && (
        <path
          d={d}
          pathLength={1000}
          className={cn(glowClassName, "animate-ecg-sweep motion-loop")}
          strokeWidth={thin ? 1.5 : 2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="160 840"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
