import { Check, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Container, revealProps, Section, SectionTitle } from "./primitives";

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

/** Two cards side by side: the usual way, and the Nivar way. Plain headings and lists, no table roles. */
export function Doctors() {
  return (
    <Section id="doctors" titleId="doctors-title">
      <Container>
        <SectionTitle
          id="doctors-title"
          title={
            <>
              Doctors on payroll, <span className="whitespace-nowrap">not on call.</span>
            </>
          }
          lede="Most home-care apps route your visit to whichever doctor is free. Ours are full-time Nivar staff, and that changes what you can expect."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-16">
          <section
            {...revealProps(0)}
            aria-labelledby="doctors-gig"
            className="rounded-[2rem] bg-mist p-6 ring-1 ring-border sm:p-9"
          >
            <h3 id="doctors-gig" className="text-h4 text-ink-2">
              A typical home-care app
            </h3>
            <ul className="mt-6 divide-y divide-border">
              {ROWS.map((r) => (
                <li key={r.label} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                  <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-ink-3 ring-1 ring-border">
                    <X className="size-3.5" strokeWidth={2.5} />
                  </span>
                  <p>
                    <span className="block text-caption font-semibold text-ink-3">{r.label}</span>
                    <span className="mt-1 block text-body text-ink-2">{r.gig}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            {...revealProps(1)}
            aria-labelledby="doctors-nivar"
            className="theme-pine relative isolate overflow-hidden rounded-[2rem] bg-[linear-gradient(155deg,var(--jade)_0%,var(--pond-2)_60%,var(--pond)_100%)] p-6 shadow-[0_40px_70px_-40px_rgb(6_47_45/0.7)] sm:p-9"
          >
            <div
              aria-hidden
              className="absolute -top-28 -right-28 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(127_224_196/0.28),transparent)]"
            />
            <h3 id="doctors-nivar" className="flex items-center gap-2.5 text-h4 text-white">
              <LogoMark variant="light" className="size-7" />
              With Nivar
            </h3>
            <ul className="mt-6 divide-y divide-white/12">
              {ROWS.map((r) => (
                <li key={r.label} className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                  <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-mint-glow text-pond">
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                  <p>
                    <span className="block text-caption font-semibold text-mint-glow">{r.label}</span>
                    <span className="mt-1 block text-body font-medium text-white">{r.nivar}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Container>
    </Section>
  );
}
