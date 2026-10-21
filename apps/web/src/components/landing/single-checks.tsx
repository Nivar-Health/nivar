import {
  Activity,
  ChevronRight,
  Droplet,
  Gauge,
  HeartPulse,
  Stethoscope,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { inr } from "./primitives";
import { CareCta } from "./whatsapp";

/** Catalogue `icon` names mapped to an icon and a tint. Unknown names fall back to a pulse on aqua. */
const CHECK_LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  gauge: { icon: Gauge, tone: "bg-rose-tint text-rose-ink" },
  activity: { icon: Activity, tone: "bg-aqua text-primary" },
  droplet: { icon: Droplet, tone: "bg-marigold-tint text-marigold-ink" },
  "heart-pulse": { icon: HeartPulse, tone: "bg-rose-tint text-rose-ink" },
  wind: { icon: Wind, tone: "bg-sky-tint text-sky-ink" },
  stethoscope: { icon: Stethoscope, tone: "bg-aqua text-primary" },
  video: { icon: Video, tone: "bg-sky-tint text-sky-ink" },
};
const DEFAULT_LOOK = { icon: Activity, tone: "bg-aqua text-primary" };

/**
 * The checks a nurse does on the spot, priced from the live catalogue: a closed disclosure holding a
 * real table and one call to action (spec §3.6). The video consult is not a check, so it is left out.
 * Native <details>, so it opens without JavaScript.
 */
export function SingleChecks({ services, className }: { services: Service[]; className?: string }) {
  const checks = services.filter((s) => s.code !== "CONSULT");
  if (checks.length === 0) return null;
  const from = Math.min(...checks.map((s) => s.price));

  return (
    <details id="lab-tests" className={cn("nv-chk-details scroll-mt-24 border-y border-border", className)}>
      <summary className="nv-chk-summary flex min-h-11 items-center rounded-xl py-1.5 text-ink focus-ring">
        <span className="nv-chk-sum-inner flex items-center gap-3 text-[1.0625rem] leading-snug font-semibold">
          <span aria-hidden className="nv-chk-chev flex size-8 shrink-0 items-center justify-center rounded-full bg-aqua text-primary">
            <ChevronRight className="size-4" strokeWidth={2.25} />
          </span>
          Single checks and their prices ({checks.length})
        </span>
      </summary>

      <div className="nv-chk-body pt-2 pb-7">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Single checks a nurse does at home, with prices</caption>
          <thead>
            <tr className="border-b border-border-strong text-caption text-ink-3">
              <th scope="col" className="w-[34%] py-2.5 pr-3 font-medium sm:w-[32%]">
                Check
              </th>
              <th scope="col" className="py-2.5 pr-3 font-medium">
                What the nurse does
              </th>
              <th scope="col" className="w-[19%] py-2.5 text-right font-medium sm:w-[16%]">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            {checks.map((s) => {
              const look = CHECK_LOOK[s.icon] ?? DEFAULT_LOOK;
              return (
                <tr key={s.code} className="border-b border-border align-top last:border-b-0">
                  <th scope="row" className="py-3.5 pr-3 text-small font-semibold text-ink">
                    <span className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={cn("hidden size-8 shrink-0 items-center justify-center rounded-[10px] sm:flex", look.tone)}
                      >
                        <look.icon className="size-4" strokeWidth={1.9} />
                      </span>
                      <span className="sm:pt-1">{s.name}</span>
                    </span>
                  </th>
                  <td className="py-3.5 pr-3 text-small text-pretty text-ink-2 sm:pt-[1.125rem]">{s.description}</td>
                  <td className="py-3.5 text-right text-small font-semibold text-ink tabular-nums sm:pt-[1.125rem]">
                    {inr(s.price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <CareCta
          name="a single check"
          ask="a single check"
          from={from}
          label="Ask about a single check"
          need="I'd like to book a single check at home."
          needLabel="A single check"
          className="mt-5"
        />
      </div>
    </details>
  );
}
