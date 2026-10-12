import { Check } from "lucide-react";
import { Container, Section, SectionTitle } from "./primitives";

const ROWS = [
  {
    label: "Accountability",
    gig: "A freelancer you will never meet again",
    nivar: "A salaried doctor whose name is on your report",
  },
  {
    label: "Training",
    gig: "Varies with whoever accepts the job",
    nivar: "Trained on our devices and protocols before the first visit",
  },
  {
    label: "Consistency",
    gig: "A different doctor and a different opinion each time",
    nivar: "The same small team sees your history every visit",
  },
  {
    label: "Review",
    gig: "A report you decode yourself, days later",
    nivar: "Every reading reviewed live and explained on video",
  },
];

export function Doctors() {
  return (
    <Section id="doctors">
      <Container>
        <SectionTitle
          title="Doctors on payroll,"
          grey="not on call."
          lede="Most home-care apps route your visit to whichever doctor is free. Ours are full-time Nivar staff, and that changes what you can expect."
        />

        <div className="mt-14 lg:mt-16" role="table" aria-label="Typical gig model compared with Nivar">
          <div role="row" className="hidden grid-cols-[180px_1fr_1fr] gap-8 border-b border-border pb-4 text-sm font-medium text-muted-foreground md:grid">
            <span role="columnheader" />
            <span role="columnheader">Typical gig model</span>
            <span role="columnheader" className="text-foreground">
              Nivar
            </span>
          </div>
          <ul className="divide-y divide-border border-b border-border md:border-t-0">
            {ROWS.map((r) => (
              <li key={r.label} role="row" className="grid gap-3 py-6 md:grid-cols-[180px_1fr_1fr] md:gap-8">
                <span role="rowheader" className="text-[1.0625rem] font-medium">
                  {r.label}
                </span>
                <p role="cell" className="text-[15px] leading-[1.55] text-muted-foreground">
                  <span className="mb-1 block text-xs font-medium md:hidden">Typical gig model</span>
                  {r.gig}
                </p>
                <p role="cell" className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-foreground">
                  <Check aria-hidden className="mt-1 size-4 shrink-0" strokeWidth={2.25} />
                  <span>{r.nivar}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
