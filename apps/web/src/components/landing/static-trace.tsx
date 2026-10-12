import { generateEcgSamples } from "@/lib/device-sim";
import { cn } from "@/lib/utils";

/**
 * A still frame of the bedside monitor, used instead of the live canvas when
 * the visitor prefers reduced motion. Same palette as EcgMonitor.
 */
export function StaticEcgPanel({
  height,
  heartRate = 72,
  className,
}: {
  height: number;
  heartRate?: number;
  className?: string;
}) {
  const sr = 125;
  const seconds = 4;
  const samples = generateEcgSamples(seconds, heartRate, sr, 7);
  const w = 400;
  const h = 100;
  const base = 66;
  const scale = 38;
  const d = samples
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / samples.length) * w).toFixed(1)} ${(base - v * scale).toFixed(1)}`)
    .join(" ");
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-[#14332E] bg-[#071B18] text-[#CFEFE6]",
        className,
      )}
      style={{ height }}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3.5 py-2 text-[11px] tracking-wide">
        <span className="flex items-center gap-2.5">
          <span className="font-semibold text-[#3BE3B4]">ECG</span>
          <span className="rounded border border-[#3BE3B4]/25 px-1.5 py-px font-medium text-[#9FE9D2]">Lead II</span>
        </span>
        <span className="text-[#6E8F87]">Captured strip</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="h-full min-w-0 flex-1 bg-ecg-grid-dark"
          role="img"
          aria-label={`ECG trace, ${heartRate} beats per minute`}
        >
          <path d={d} fill="none" stroke="#3BE3B4" strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <div className="flex w-[92px] shrink-0 flex-col justify-center border-l border-white/5 bg-[#0A221E] px-3 sm:w-[124px]">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-[#3BE3B4]">HR</span>
          <span className="font-mono text-[44px] leading-none font-semibold text-[#3BE3B4] tabular-nums sm:text-[52px]">
            {heartRate}
          </span>
          <span className="mt-1 text-[10px] tracking-wider text-[#6E8F87]">bpm</span>
        </div>
      </div>
    </div>
  );
}
