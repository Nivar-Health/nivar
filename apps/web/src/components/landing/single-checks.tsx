import { Activity, Droplet, Gauge, HeartPulse, LayoutGrid, Stethoscope, Video, Wind, type LucideIcon } from "lucide-react";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Disclosure } from "./disclosure";
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
 * The checks a nurse does on the spot, priced from the live catalogue: the last row of the check-up list
 * (programmes.tsx), closed at every width, holding a real table and one call to action (spec U6). The
 * closed row already says how many checks there are and the lowest price. The video consult is not a
 * check, so it is left out. Below 640px the table's rows stack (check-ups.css), so its roles are explicit:
 * Safari drops table semantics from a table whose display changes.
 */
export function SingleChecks({ services }: { services: Service[] }) {
  const checks = services.filter((s) => s.code !== "CONSULT");
  if (checks.length === 0) return null;
  const n = checks.length;
  const from = Math.min(...checks.map((s) => s.price));

  return (
    <li className="nv-chk-single sm:col-span-full lg:max-w-[37rem]">
      <Disclosure
        id="lab-tests"
        collapse="always"
        leadSize="tile"
        lead={<LayoutGrid className="size-5" strokeWidth={1.9} />}
        title="Single checks"
        meta={n === 1 ? `1 check, ${inr(from)}` : `${n} checks, from ${inr(from)}`}
        bodyClassName="ps-0"
      >
        <table role="table" className="nv-chk-table w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Single checks a nurse does at home, with prices</caption>
          <thead role="rowgroup">
            <tr role="row" className="border-b border-border-strong text-caption text-ink-3">
              <th role="columnheader" scope="col" className="w-[32%] py-2.5 pr-3 font-medium">
                Check
              </th>
              <th role="columnheader" scope="col" className="py-2.5 pr-3 font-medium">
                What the nurse does
              </th>
              <th role="columnheader" scope="col" className="w-[16%] py-2.5 text-right font-medium">
                Price
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {checks.map((s) => {
              const look = CHECK_LOOK[s.icon] ?? DEFAULT_LOOK;
              return (
                <tr key={s.code} role="row" className="border-b border-border align-top last:border-b-0">
                  <th role="rowheader" scope="row" className="nv-chk-check text-small font-semibold text-ink sm:py-3.5 sm:pr-3">
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
                  <td role="cell" className="nv-chk-does text-small text-pretty text-ink-2 sm:py-3.5 sm:pt-[1.125rem] sm:pr-3">
                    {s.description}
                  </td>
                  <td
                    role="cell"
                    className="nv-chk-cost text-right font-semibold text-ink tabular-nums sm:py-3.5 sm:pt-[1.125rem] sm:text-small"
                  >
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
          className="mt-4 sm:mt-5"
        />
      </Disclosure>
    </li>
  );
}
