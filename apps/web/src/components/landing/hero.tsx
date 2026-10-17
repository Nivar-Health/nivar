import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { BadgeCheck, Check, Clock, HeartPulse, IndianRupee, Stethoscope } from "lucide-react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { HealthWords } from "./health-words";
import { MiniTrace } from "./mini-trace";
import { Avatar, BOOK_LABEL, ButtonLink, Container, bookHref, buttonClass, inr } from "./primitives";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * The first screen. Copy on the left; on the right the visit itself, framed as a doorway with the
 * morning sun behind it, heartbeat ripples, and three sample readings floating beside it.
 * The H1, lede, CTAs and photo never fade in (they are the LCP candidates); everything else
 * arrives once, in sequence, then breathes.
 */
export function Hero({ fromPrice }: { fromPrice: number }) {
  const promises = [
    { icon: Stethoscope, text: "Doctors on the Nivar payroll" },
    { icon: Clock, text: SITE.report.strip },
    { icon: IndianRupee, text: `From ${inr(fromPrice)}, all inclusive` },
  ];

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="hero-sky absolute inset-0 -z-20" />
      <div
        aria-hidden
        className="hero-orb motion-loop -top-40 -left-32 -z-10 size-[520px] bg-[radial-gradient(closest-side,rgb(127_224_196/0.45),transparent)]"
      />
      <div
        aria-hidden
        className="hero-orb motion-loop top-1/3 -right-48 -z-10 hidden size-[560px] bg-[radial-gradient(closest-side,rgb(47_109_181/0.18),transparent)] [animation-delay:-9s] lg:block"
      />

      <Container className="pt-28 pb-20 sm:pt-32 lg:pt-36 lg:pb-28">
        <div className="grid items-center gap-x-12 gap-y-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div>
            <p
              className="hero-in inline-flex items-center gap-2.5 rounded-full border border-white bg-white/75 py-1.5 pr-4 pl-2 text-sm font-medium text-ink-2 shadow-[0_6px_18px_-12px_rgb(6_47_45/0.4)] backdrop-blur"
              style={delay(0)}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-aqua text-primary">
                <span aria-hidden className="live-dot size-1.5 text-primary motion-loop" />
              </span>
              Now visiting homes across {SITE.city}
            </p>

            <h1 id="hero-title" className="mt-7 text-h1 text-balance text-ink">
              Your doctor&apos;s <span className="whitespace-nowrap">check-up,</span>{" "}
              <span className="min-[380px]:whitespace-nowrap">at your doorstep.</span>
            </h1>

            <HealthWords className="hero-in mt-7" />

            <p className="mt-7 max-w-[50ch] text-lede text-pretty text-ink-2">
              A Nivar nurse brings clinic-grade devices to your home. A Nivar doctor watches every reading live,
              talks with you on video, and sends your report, {SITE.report.promise}.
            </p>

            <div className="mt-9 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              <ButtonLink href={bookHref()} size="lg" className="h-14 px-8 text-[1.0625rem]">
                {BOOK_LABEL}
              </ButtonLink>
              <a href="#how-it-works" className={buttonClass("secondary", "h-14 px-8 text-[1.0625rem]", "lg")}>
                See how it works
              </a>
            </div>

            <ul className="hero-in mt-12 grid gap-x-6 gap-y-3 sm:grid-cols-3" style={delay(300)}>
              {promises.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-small font-medium text-ink-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_4px_12px_-6px_rgb(6_47_45/0.35)] ring-1 ring-aqua-2">
                    <Icon aria-hidden className="size-4" strokeWidth={2.25} />
                  </span>
                  <span className="text-pretty">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <Doorway />
        </div>
      </Container>
    </section>
  );
}

/** The visit, framed as an open doorway. Decorative cards are sample data and labelled as such. */
function Doorway() {
  return (
    <figure className="@container relative mx-auto w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[480px]">
      {/* Morning sun rising behind the doorway */}
      <div
        aria-hidden
        className="hero-sun motion-loop absolute -top-16 -right-14 -z-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_222_160/0.95),rgb(242_163_58/0.5)_45%,rgb(242_163_58/0.14)_72%,transparent)] sm:size-64 lg:-top-20 lg:-right-20 lg:size-80"
      />
      {/* Heartbeat ripples */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        {[0, 1.8, 3.6].map((d) => (
          <span
            key={d}
            className="hero-ripple motion-loop absolute aspect-square w-[118%] rounded-full border border-primary/25 bg-primary/[0.03]"
            style={{ "--d": `${d}s` } as CSSProperties}
          />
        ))}
      </div>

      <div className="hero-settle relative aspect-[4/5] w-full overflow-hidden rounded-t-[50cqw] rounded-b-[2.5rem] bg-aqua shadow-[0_48px_90px_-40px_rgb(6_47_45/0.5)] ring-[10px] ring-white">
        <Image
          src="/img/hero-nurse.jpg"
          alt="A Nivar nurse placing a smart ECG patch on a woman seated at home"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 480px, (min-width: 640px) 420px, 340px"
          className="object-cover object-[50%_40%]"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-pond/30 to-transparent" />
      </div>

      {/* Heart rhythm, streaming */}
      <FloatCard position="top-[14%] -left-4 w-[178px] sm:-left-12 sm:w-[212px]" enter={500} float="7.5s" floatDelay="-1s">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink">Heart rhythm</span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-signal-ink">
            <span aria-hidden className="live-dot size-1.5 motion-loop" />
            Live
          </span>
        </div>
        <MiniTrace className="mt-2.5 h-7 text-primary" />
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-baseline gap-1.5">
            <span aria-hidden className="hero-heart motion-loop self-center text-rose">
              <HeartPulse className="size-4" strokeWidth={2.25} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink tabular-nums">72</span>
            <span className="text-xs font-medium text-ink-3">bpm</span>
          </span>
          <span className="rounded-full bg-aqua px-2 py-0.5 text-xs font-semibold text-primary">Normal</span>
        </div>
      </FloatCard>

      {/* The doctor, watching live */}
      <FloatCard
        position="top-[52%] -right-3 hidden sm:block lg:-right-14"
        className="flex items-center gap-3 pr-4"
        enter={750}
        float="8.5s"
        floatDelay="-3s"
      >
        <span className="relative">
          <Avatar initials="AR" className="size-10 text-[0.8125rem]" />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-white">
            <span className="size-2.5 rounded-full bg-signal" />
          </span>
        </span>
        <span>
          <span className="block font-semibold text-ink">Dr. Ananya Rao</span>
          <span className="block text-xs text-ink-3">Watching your readings live</span>
        </span>
      </FloatCard>

      {/* The report */}
      <FloatCard
        position="bottom-[9%] -left-3 sm:-left-10"
        className="flex items-center gap-3 pr-5"
        enter={1000}
        float="9s"
        floatDelay="-5s"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Check aria-hidden className="size-5" strokeWidth={2.75} />
        </span>
        <span>
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            Report ready
            <BadgeCheck aria-hidden className="size-4 text-primary" />
          </span>
          <span className="block text-xs text-ink-3">Signed by your doctor at 5:27 pm</span>
        </span>
      </FloatCard>

      <figcaption className="mt-8 text-center text-caption text-ink-3">
        Sample screens. Names and readings are illustrative.
      </figcaption>
    </figure>
  );
}

function FloatCard({
  position,
  className,
  enter,
  float,
  floatDelay,
  children,
}: {
  /** Placement and visibility of the card on the doorway. */
  position: string;
  /** Layout inside the card. */
  className?: string;
  enter: number;
  float: string;
  floatDelay: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden className={cn("hero-pop absolute z-10", position)} style={delay(enter)}>
      <div
        className={cn(
          "hero-float motion-loop rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-[0.8125rem] leading-snug shadow-[0_20px_40px_-20px_rgb(6_47_45/0.45)] backdrop-blur-md",
          className,
        )}
        style={{ "--t": float, "--d": floatDelay } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
