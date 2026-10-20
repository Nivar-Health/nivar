import { Car, Check, IndianRupee, Undo2, Video, X, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { Container, Section, SectionTitle, revealProps } from "./primitives";

const COLUMNS = ["Nivar", "Hospital OPD", "Local compounder"] as const;

/** [Nivar, Hospital OPD, Local compounder] for each row. */
const ROWS: { label: string; has: [boolean, boolean, boolean] }[] = [
  { label: "Care at your home", has: [true, false, false] },
  { label: "No travel or waiting in queues", has: [true, false, false] },
  { label: "Injections, drips and dressings", has: [true, true, true] },
  { label: "BP, ECG and stethoscope checks", has: [true, true, false] },
  { label: "Doctor involved", has: [true, true, false] },
  { label: "Verified, registered staff", has: [true, true, false] },
  { label: "Price told upfront", has: [true, false, false] },
  { label: "Digital record of every visit", has: [true, false, false] },
];

/** What one price covers (the old "Premium care. No premium price." block, folded in here). */
const INCLUDED: { icon: LucideIcon; text: string }[] = [
  { icon: Car, text: "No travel charge" },
  { icon: IndianRupee, text: "No surge pricing" },
  { icon: Video, text: "No hidden consultation fee" },
  { icon: Undo2, text: SITE.cancellation },
];

/** "Why families choose Nivar": a real table (row and column headers), Nivar's column tinted. */
export function Comparison() {
  return (
    <Section id="compare" titleId="compare-title">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <SectionTitle
              id="compare-title"
              title="Why families choose Nivar."
              lede="One price, told upfront, covers the nurse's visit, the kit and the doctor's time. No surge pricing, no hidden consultation fee."
            />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {INCLUDED.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3.5 text-[0.9375rem] font-medium text-ink">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-aqua text-primary">
                    <Icon aria-hidden className="size-[1.125rem]" strokeWidth={2} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div {...revealProps(1)} className="lg:col-span-8">
            <div className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-border shadow-[0_24px_48px_-36px_rgb(1_43_54/0.5)]">
              <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">How Nivar compares with a hospital OPD and a local compounder</caption>
                <colgroup>
                  <col className="w-[34%] sm:w-[46%]" />
                  <col className="bg-aqua" />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-border">
                    <td className="px-4 py-4 sm:px-6" />
                    {COLUMNS.map((c, i) => (
                      <th
                        key={c}
                        scope="col"
                        className={cn(
                          // Phones: 11px and hyphenation, so "compounder" fits its 64px column.
                          "px-1 py-4 text-center align-bottom text-[0.6875rem] leading-tight font-semibold text-balance hyphens-auto sm:px-3 sm:text-small",
                          i === 0 ? "text-primary" : "text-ink-2",
                        )}
                      >
                        {i === 0 ? (
                          <span className="inline-flex flex-col items-center gap-1.5">
                            <LogoMark className="size-6" />
                            {c}
                          </span>
                        ) : (
                          c
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ROWS.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="py-3.5 pr-2 pl-4 text-small font-medium text-pretty text-ink sm:px-6 sm:text-body">
                        {r.label}
                      </th>
                      {r.has.map((yes, i) => (
                        <td key={COLUMNS[i]} className="px-1 py-3.5 text-center sm:px-3">
                          <Mark yes={yes} strong={i === 0} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function Mark({ yes, strong }: { yes: boolean; strong: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full",
        yes ? (strong ? "bg-primary text-white" : "bg-aqua-2 text-primary") : "bg-danger-bg text-danger",
      )}
    >
      {yes ? (
        <Check aria-hidden className="size-4" strokeWidth={3} />
      ) : (
        <X aria-hidden className="size-3.5" strokeWidth={3} />
      )}
      <span className="sr-only">{yes ? "Yes" : "No"}</span>
    </span>
  );
}
