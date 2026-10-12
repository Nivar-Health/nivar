import { ArrowDown } from "lucide-react";
import { formatINR } from "@/lib/format";
import { HeroVisual } from "./hero-visual";
import { Container, CtaLink } from "./primitives";

export function Hero({ fromPrice }: { fromPrice: number }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* ECG paper, fading out towards the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-ecg-grid [mask-image:radial-gradient(ellipse_80%_70%_at_70%_35%,black,transparent_75%)]"
      />
      <Container className="grid grid-cols-1 items-center gap-8 pt-8 pb-16 sm:pt-12 sm:pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pt-16 lg:pb-28">
        <div className="max-w-[600px]">
          <p
            className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/15 bg-mint/70 py-1 pr-3.5 pl-2.5 text-[0.8rem] font-medium text-teal-deep"
          >
            <span className="live-dot text-primary" aria-hidden />
            Now visiting homes across Bangalore
          </p>
          <h1
            id="hero-title"
            className="mt-5 animate-fade-up font-display text-[2.6rem] leading-[1.02] font-medium tracking-[-0.035em] text-balance text-ink sm:text-[3.6rem] lg:text-[4.35rem]"
            style={{ animationDelay: "60ms", fontVariationSettings: '"SOFT" 60, "opsz" 144' }}
          >
            Your doctor&apos;s check-up, at home within the hour.
          </h1>
          <p
            className="mt-5 max-w-[34rem] animate-fade-up text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground sm:mt-6 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            A Nivar nurse brings a smart ECG and stethoscope to your door. Your readings stream live to a Nivar doctor,
            who sees you on video and sends your report and prescription, usually before the nurse has packed up.
          </p>
          <div
            className="mt-8 flex animate-fade-up flex-col gap-3 min-[420px]:flex-row"
            style={{ animationDelay: "180ms" }}
          >
            <CtaLink href="/app/book" size="lg">
              Book a home check-up
            </CtaLink>
            <CtaLink href="#how-it-works" size="lg" variant="secondary">
              See how it works
              <ArrowDown aria-hidden />
            </CtaLink>
          </div>
          <dl
            className="mt-10 grid max-w-[34rem] animate-fade-up grid-cols-3 gap-4 border-t border-ink/10 pt-6"
            style={{ animationDelay: "240ms" }}
          >
            <Stat value={formatINR(fromPrice)} label="Check-ups from, all inclusive" />
            <Stat value="60 min" label="Express nurse visit, booked today" />
            <Stat value="100%" label="Doctors and nurses on our payroll" />
          </dl>
        </div>
        <HeroVisual />
      </Container>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="order-last text-[0.78rem] leading-snug text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="font-display text-[1.6rem] leading-none font-medium tracking-[-0.02em] text-ink tabular-nums sm:text-[2rem]">
        {value}
      </dd>
    </div>
  );
}
