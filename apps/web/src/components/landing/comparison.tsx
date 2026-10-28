import { Check, Minus } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site-facts";
import { Container, Section, SectionTitle, revealProps } from "./primitives";
import "./comparison.css";

type Col = "nivar" | "opd" | "compounder";
type MarkKind = "yes" | "partly" | "no";
type Cell = { mark: MarkKind; text: string; go?: boolean };

const COLUMNS: readonly { id: Col; name: string }[] = [
  { id: "nivar", name: "Nivar at home" },
  { id: "opd", name: "Hospital OPD" },
  { id: "compounder", name: "Local compounder" },
];

const SAY: Record<MarkKind, string> = { yes: "Yes.", partly: "Partly.", no: "No." };

/** [Nivar at home, Hospital OPD, Local compounder] for each row (mobile spec U5): typical experiences, kept
 * honest and short, so every cell reads at 15px in three lines or fewer on a phone. */
const ROWS: readonly { label: string; cells: readonly [Cell, Cell, Cell] }[] = [
  {
    label: "At home, at a set time",
    cells: [
      { mark: "yes", text: `Booked slot, ${SITE.hours.short}` },
      { mark: "no", text: "You travel and queue" },
      { mark: "partly", text: "When they're free" },
    ],
  },
  {
    label: "A registered nurse",
    cells: [
      { mark: "yes", text: "Registered in Karnataka" },
      { mark: "yes", text: "Hospital nurses" },
      { mark: "partly", text: "Varies" },
    ],
  },
  {
    label: "A doctor involved",
    cells: [
      { mark: "yes", text: "Calls ahead; video if needed" },
      { mark: "yes", text: "In person" },
      { mark: "no", text: "Not usually" },
    ],
  },
  {
    label: "BP, sugar and ECG",
    cells: [
      { mark: "yes", text: "At home, smart ECG" },
      { mark: "yes", text: "Often separate counters" },
      { mark: "no", text: "Not usually" },
    ],
  },
  {
    label: "Sealed, single-use kit",
    cells: [
      { mark: "yes", text: "Every visit" },
      { mark: "yes", text: "Hospital standard" },
      { mark: "partly", text: "Varies" },
    ],
  },
  {
    label: "Price told upfront",
    cells: [
      { mark: "yes", text: "Before we confirm" },
      { mark: "partly", text: "Fee fixed, tests extra" },
      { mark: "partly", text: "Agreed on the spot" },
    ],
  },
  {
    label: "A record of the visit",
    cells: [
      { mark: "yes", text: `Visit report ${SITE.report.channel}` },
      { mark: "yes", text: "Prescription, lab reports" },
      { mark: "no", text: "Usually none" },
    ],
  },
  {
    label: "Specialists, scans and emergencies",
    cells: [
      { mark: "no", text: "Not an emergency service. Call 112 (or 108)" },
      { mark: "yes", text: "On site", go: true },
      { mark: "no", text: "No" },
    ],
  },
];

/**
 * "Why families choose Nivar": one real table (sr-only caption, column and row headers) on a white sheet,
 * with Nivar's column raised on a jade spine. Every cell is a mark plus a short phrase.
 * Below lg it shows Nivar and one comparator at a time, picked by a radio switch that works through CSS
 * :has() alone (browsers without :has() get all four columns, scrolling inside the sheet), and the
 * column names stay in view while the rows scroll.
 */
export function Comparison() {
  return (
    <Section id="compare" tone="aqua" titleId="compare-title">
      <Container>
        <SectionTitle
          id="compare-title"
          title="Why families choose Nivar."
          lede="How a Nivar visit compares with the two usual options. We've kept it honest, including where a hospital is the better choice."
        />

        <div className="nv-cmp mt-5 lg:mt-14">
          <fieldset className="nv-cmp-switch">
            <legend className="nv-cmp-legend">Compare Nivar with</legend>
            <div className="nv-cmp-seg">
              {COLUMNS.slice(1).map((c, i) => (
                <label key={c.id} className="nv-cmp-pill">
                  <input type="radio" name="nv-cmp-with" value={c.id} defaultChecked={i === 0} className="sr-only" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div {...revealProps(0)} className="nv-cmp-sheet">
            <div className="nv-cmp-scroll">
              <div className="nv-cmp-grid">
                <div aria-hidden className="nv-cmp-spine" />
                <table className="nv-cmp-table">
                  <caption className="sr-only">
                    How a Nivar nurse at home compares with a hospital OPD and a local compounder
                  </caption>
                  <thead>
                    <tr>
                      <td />
                      {COLUMNS.map((c) => (
                        <th key={c.id} scope="col" data-col={c.id}>
                          {c.id === "nivar" && <LogoMark variant="light" className="nv-cmp-logo" />}
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((r) => (
                      <tr key={r.label}>
                        <th scope="row">{r.label}</th>
                        {r.cells.map((cell, i) => (
                          <td key={COLUMNS[i].id} data-col={COLUMNS[i].id} data-go={cell.go ? "" : undefined}>
                            <Mark kind={cell.mark} />
                            <span className="sr-only">{SAY[cell.mark]} </span>
                            {cell.go && (
                              <span className="nv-cmp-go">
                                Go here<span className="sr-only">.</span>
                              </span>
                            )}
                            <span className="nv-cmp-say">{cell.text}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="mt-3 text-caption text-ink-2 lg:mt-7">Typical experiences, not a rating of any hospital or person.</p>
        </div>
      </Container>
    </Section>
  );
}

/** ● yes (a check on a filled disc), ◐ partly (a half-filled ring), ○ no (a ring with a dash). Decorative:
 * each cell's sr-only "Yes." / "Partly." / "No." says it. */
function Mark({ kind }: { kind: MarkKind }) {
  return (
    <span aria-hidden className="nv-cmp-mark" data-mark={kind}>
      {kind === "yes" && <Check strokeWidth={3} />}
      {kind === "no" && <Minus strokeWidth={3} />}
    </span>
  );
}
