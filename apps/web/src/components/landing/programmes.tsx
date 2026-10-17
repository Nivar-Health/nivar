import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Package } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgrammeGlyph, programmeStyle } from "./programme-glyphs";
import { Container, ROW_CTA_LABEL, Section, SectionTitle, bookHref, inr, revealProps } from "./primitives";

/** Plain names for the tests a programme includes. */
const TEST_NAMES: Record<string, string> = {
  BP: "Blood pressure",
  ECG: "Smart ECG",
  SUGAR: "Blood sugar",
  HR: "Heart rate",
  SPO2: "Oxygen",
  STETH: "Stethoscope",
  CONSULT: "Doctor consult",
};

/** Desktop columns by card count, so admin deactivations never leave a ragged last row. */
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1 lg:max-w-md",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-2 xl:grid-cols-4",
};

/** Catalog-driven: `packages` arrives sorted by sortOrder, so admin edits and deactivations show up here. */
export function Programmes({ packages }: { packages: Package[] }) {
  return (
    <Section id="what-we-test" titleId="what-we-test-title">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle
            id="what-we-test-title"
            title="Programmes designed around what you worry about."
            lede="Pick the check-up that matches the question on your mind. Every programme includes the nurse visit, the devices and the doctor's written report."
          />
          <p className="max-w-[34ch] text-small text-ink-3 lg:pb-2 lg:text-right">
            Prices include the home visit and the report. No surge pricing, no hidden consultation fee.
          </p>
        </div>

        <ul className={cn("mt-12 grid gap-5 sm:grid-cols-2 lg:mt-16", LG_COLS[packages.length] ?? "lg:grid-cols-3")}>
          {packages.map((p, i) => {
            const style = programmeStyle(p.slug);
            const tests = p.serviceCodes.map((c) => TEST_NAMES[c] ?? c);
            return (
              <li key={p.slug} {...revealProps(i)}>
                <Link
                  href={bookHref(`package=${p.slug}`)}
                  className="group relative flex h-full flex-col rounded-[1.75rem] bg-(--pg-tint) p-6 ring-1 ring-ink/[0.05] transition-[transform,box-shadow] duration-300 ease-calm focus-ring hover:-translate-y-1 hover:shadow-[0_28px_50px_-28px_rgb(6_47_45/0.45)] motion-reduce:hover:translate-y-0 sm:p-7"
                  style={{ "--pg-tint": style.tint } as CSSProperties}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      aria-hidden
                      className="flex size-[5.5rem] items-center justify-center rounded-full bg-white shadow-[0_14px_28px_-16px_rgb(6_47_45/0.4)]"
                    >
                      <ProgrammeGlyph slug={p.slug} className="size-16" />
                    </span>
                    {p.popular && (
                      <span className="rounded-full bg-marigold px-3 py-1 text-xs font-semibold text-ink">Most booked</span>
                    )}
                  </div>

                  <h3 className="mt-7 text-h3 text-ink">{p.name}</h3>
                  <p className="mt-2 text-small text-pretty text-ink-2">{p.tagline}</p>

                  <ul aria-label={`Included in ${p.name}`} className="mt-5 flex flex-wrap gap-1.5">
                    {tests.map((t) => (
                      <li key={t} className="rounded-full bg-white/75 px-2.5 py-1 text-xs font-medium text-ink-2">
                        {t}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                    <p className="flex flex-col tabular-nums">
                      {p.mrp > p.price && (
                        <s className="text-small text-ink-3">
                          <span className="sr-only">Usual price </span>
                          {inr(p.mrp)}
                        </s>
                      )}
                      <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink">
                        {inr(p.price)}
                      </span>
                    </p>
                    <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white pr-3 pl-4 text-[0.9375rem] font-semibold text-primary shadow-[0_8px_18px_-12px_rgb(6_47_45/0.5)] transition-colors duration-200 group-hover:bg-primary group-hover:text-white">
                      {ROW_CTA_LABEL}
                      <ArrowUpRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-small text-ink-3">
          Every visit is carried out by a certified Nivar nurse and reviewed by a Nivar doctor on our payroll.
        </p>
      </Container>
    </Section>
  );
}
