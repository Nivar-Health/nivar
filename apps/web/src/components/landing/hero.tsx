import Image from "next/image";
import { Check } from "lucide-react";
import { Avatar, BOOK_LABEL, ButtonLink, Container, GlassCard, LiveDot, bookHref, inr } from "./primitives";
import { MiniTrace } from "./mini-trace";

const PROMISES = [
  "A Nivar nurse comes to you with a smart ECG and stethoscope",
  "A full-time Nivar doctor watches your readings live and consults on video",
  "Your report and prescription in the app, usually before she leaves",
];

export function Hero({ fromPrice }: { fromPrice: number }) {
  return (
    <section className="pt-10 pb-20 sm:pt-14 lg:pt-20 lg:pb-[140px]">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="landing-reveal flex flex-col lg:col-span-7 lg:pt-6">
            <p className="inline-flex w-fit items-center gap-2.5 rounded-full border border-border py-1.5 pr-3.5 pl-3 text-[13px] font-medium text-foreground">
              <LiveDot />
              Now in Bangalore
            </p>

            <h1 className="font-display mt-7 text-[2.75rem] leading-[1.02] font-medium tracking-[-0.03em] sm:text-[3.5rem] lg:text-[3.75rem]">
              Your doctor&apos;s check-up.
              <br />
              <span className="text-muted-foreground">At home, within the hour.</span>
            </h1>

            <p className="mt-7 max-w-[52ch] text-[1.0625rem] leading-[1.6] text-muted-foreground">
              Nivar brings the clinic to your sofa. A nurse brings the devices, a doctor you can see
              watches every reading as it is taken, and you get a clear report the same evening. From{" "}
              {inr(fromPrice)}, all inclusive.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href={bookHref()}>{BOOK_LABEL}</ButtonLink>
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors outline-none hover:border-[#c8c8c2] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                See how it works
              </a>
            </div>

            <ul className="mt-14 max-w-[560px] divide-y divide-border border-y border-border">
              {PROMISES.map((text) => (
                <li key={text} className="flex items-start gap-3.5 py-4 text-[15px] leading-[1.5] text-foreground">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="landing-reveal flex flex-col gap-4 [--reveal-delay:120ms] lg:col-span-5">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-muted">
              <Image
                src="/img/hero-nurse.jpg"
                alt="A Nivar nurse placing a smart ECG patch on a woman seated at home"
                fill
                priority
                sizes="(min-width: 1024px) 480px, (min-width: 640px) 90vw, 100vw"
                className="object-cover"
              />

              <GlassCard className="absolute top-4 left-4 w-[200px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Smart ECG</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <LiveDot className="size-1.5" />
                    Lead II
                  </span>
                </div>
                <MiniTrace className="mt-2" />
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold tabular-nums">
                    82 <span className="text-[11px] font-medium text-muted-foreground">bpm</span>
                  </span>
                  <span className="text-muted-foreground">Normal</span>
                </div>
              </GlassCard>

              <GlassCard className="absolute right-4 bottom-4 flex items-center gap-3 pr-4">
                <Avatar initials="AR" />
                <div>
                  <p className="font-semibold">Dr. Ananya Rao</p>
                  <p className="mt-0.5 text-muted-foreground">Cardiologist, on video</p>
                </div>
              </GlassCard>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col justify-between gap-6 rounded-2xl bg-[#0a0a0a] p-5 text-white">
                <p className="text-[13px] leading-snug text-[#a3a39e]">Nurse at your door</p>
                <div>
                  <p className="text-[1.375rem] leading-none font-medium tracking-[-0.02em] tabular-nums">
                    in 48 min
                  </p>
                  <div className="mt-3.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div className="landing-progress h-full w-[62%] rounded-full bg-white" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-6 rounded-2xl border border-border p-5">
                <p className="text-[13px] leading-snug text-muted-foreground">Starts at</p>
                <div>
                  <p className="text-[1.375rem] leading-none font-medium tracking-[-0.02em] tabular-nums">
                    {inr(fromPrice)}
                  </p>
                  <p className="mt-2 text-[13px] text-muted-foreground">all inclusive</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
