import Link from "next/link";
import type { Package } from "@/lib/types";
import { Container, Section, SectionTitle, bookHref, inr } from "./primitives";

type Programme = {
  slug: string;
  name: string;
  line: string;
  /** Orb colour: deliberately desaturated so the cards stay monochrome at a glance. */
  glow: string;
};

const PROGRAMMES: Programme[] = [
  {
    slug: "heart-check",
    name: "Heart Check",
    line: "ECG and stethoscope, reviewed live by a cardiologist.",
    glow: "#b7717c",
  },
  {
    slug: "diabetes-care",
    name: "Diabetes Care",
    line: "Sugar, BP and a doctor who adjusts your medicines.",
    glow: "#b59a5a",
  },
  {
    slug: "complete-home-checkup",
    name: "Complete Home Check-up",
    line: "Every vital, ECG, stethoscope and a consult, in one visit.",
    glow: "#6d86a0",
  },
];

export function Programmes({ packages }: { packages: Package[] }) {
  const priceOf = (slug: string) => packages.find((p) => p.slug === slug)?.price;

  return (
    <Section id="what-we-test">
      <Container>
        <SectionTitle
          title="Programmes designed around"
          grey="what you worry about."
          lede="Pick the check-up that matches the question on your mind. Every programme includes the nurse visit, the devices and the doctor's written report."
        />

        <ul className="mt-14 grid gap-5 md:grid-cols-3 lg:mt-16">
          {PROGRAMMES.map((p) => {
            const price = priceOf(p.slug);
            return (
              <li key={p.slug}>
                <Link
                  href={bookHref(`package=${p.slug}`)}
                  className="group relative flex h-[320px] flex-col md:h-[420px] justify-end overflow-hidden rounded-3xl bg-[#0a0a0a] p-7 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {/* A soft sphere: a defined orb with a lit top edge, haloed by a wide blur, like a lamp in a dark room. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-[62%] rounded-full blur-3xl"
                    style={{ background: p.glow, opacity: 0.55 }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-[62%] rounded-full transition-transform duration-500 group-hover:scale-[1.04]"
                    style={{
                      background: `radial-gradient(circle at 38% 32%, ${p.glow} 0%, ${p.glow} 28%, #0a0a0a 100%)`,
                      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.25), 0 30px 60px -20px ${p.glow}`,
                    }}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent"
                  />
                  <div className="relative">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-[1.375rem] leading-tight font-medium tracking-[-0.02em]">{p.name}</h3>
                      {price !== undefined && (
                        <span className="shrink-0 text-[15px] font-medium text-[#c9c9c4] tabular-nums">{inr(price)}</span>
                      )}
                    </div>
                    <p className="mt-2.5 max-w-[30ch] text-[15px] leading-[1.5] text-[#a3a39e]">{p.line}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 max-w-[60ch] text-[15px] leading-[1.6] text-muted-foreground">
          Every visit is carried out by a certified Nivar nurse and reviewed by a Nivar doctor who is on
          our payroll. Prices include the home visit and the report. No surge pricing, no hidden consultation fee.
        </p>
      </Container>
    </Section>
  );
}
