import Link from "next/link";
import type { Package, Service } from "@/lib/types";
import { ButtonLink, Container, Section, SectionTitle, inr } from "./primitives";

const textLink =
  "rounded-sm text-sm font-semibold text-foreground underline decoration-border underline-offset-[5px] transition-colors outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function Pricing({ packages, services }: { packages: Package[]; services: Service[] }) {
  const shortName = (code: string) => services.find((s) => s.code === code)?.shortName ?? code;

  return (
    <Section id="pricing">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <SectionTitle
              title="Premium care."
              grey="No premium price."
              lede="One price covers the nurse visit, the devices, the doctor's time and the report. Pay after the visit, in the app."
            />
            <ButtonLink href="/app/book" variant="secondary" className="mt-8">
              See all tests
            </ButtonLink>
          </div>

          <div className="lg:col-span-7">
            <ul className="divide-y divide-border border-y border-border">
              {packages.map((p) => (
                <li key={p.slug} className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[1.0625rem] leading-snug font-medium">{p.name}</h3>
                      {p.popular && <span className="text-[13px] text-muted-foreground">Most booked</span>}
                    </div>
                    <p className="mt-1.5 text-[15px] leading-[1.5] text-muted-foreground">{p.tagline}</p>
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Included in ${p.name}`}>
                      {p.serviceCodes.map((code) => (
                        <li key={code} className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground">
                          {shortName(code)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-2">
                    <p className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-[1.25rem] font-medium tracking-[-0.02em]">{inr(p.price)}</span>
                      {p.mrp > p.price && (
                        <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/60">
                          {inr(p.mrp)}
                        </span>
                      )}
                    </p>
                    <Link href={`/app/book?package=${p.slug}`} className={textLink}>
                      Book
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="mt-14 text-[1.0625rem] font-medium">Or pick individual tests</h3>
            <ul className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-border bg-background sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.code} className="bg-background shadow-[0_0_0_1px_var(--border)]">
                  <Link
                    href={`/app/book?test=${s.code}`}
                    className="flex h-full items-center justify-between gap-4 px-5 py-4 text-[15px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <span className="min-w-0 leading-snug font-medium">{s.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{inr(s.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
