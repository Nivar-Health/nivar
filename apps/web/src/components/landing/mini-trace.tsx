import { cn } from "@/lib/utils";

/* One PQRST complex, 60 units wide on a 24 unit tall stage with baseline at y=15. */
const BEAT =
  "h6 c2 0 3 -2.5 5 -2.5 s3 2.5 5 2.5 h4 l2 -9.5 l2.5 15 l2 -7.5 h5 c2 0 3 -3.5 5 -3.5 s3 3.5 5 3.5 h18.5";
const BEATS_PER_STRIP = 4;
const STRIP_WIDTH = 60 * BEATS_PER_STRIP;

function strip(offset: number) {
  return `M${offset} 15 ${Array.from({ length: BEATS_PER_STRIP }, () => BEAT).join(" ")}`;
}

/**
 * A small, continuously scrolling ECG trace in signal green.
 * Two identical strips sit side by side; translating the pair by half its
 * width loops seamlessly.
 */
export function MiniTrace({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${STRIP_WIDTH} 24`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("block h-6 w-full overflow-hidden text-signal", className)}
    >
      <g className="landing-trace">
        <path
          d={`${strip(0)} ${strip(STRIP_WIDTH)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
