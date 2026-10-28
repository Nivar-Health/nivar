import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDown,
  BadgeCheck,
  BriefcaseMedical,
  FileText,
  Gauge,
  House,
  PackageCheck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { ArtPicture } from "./art-picture";
import { Container } from "./primitives";
import { ContactCtas } from "./whatsapp";
import "./hero.css";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/* What the lede doesn't already say. The report chip is a document, never the WhatsApp glyph. */
const CHIPS: { icon: LucideIcon; text: ReactNode; key: string }[] = [
  { key: "nurses", icon: BadgeCheck, text: "Registered nurses" },
  {
    key: "kits",
    icon: PackageCheck,
    // Kept on one line when it wraps on phones, so it never splits at the hyphen.
    text: (
      <>
        Sealed, <span className="whitespace-nowrap">single-use kits</span>
      </>
    ),
  },
  { key: "travel", icon: House, text: "No travel charge" },
  { key: "report", icon: FileText, text: `Visit report ${SITE.report.channel}` },
];

/**
 * The first screen, nurse first. On phones the photo leads (16:10) and the H1, lede and callback button
 * fit the first screen down to 360×640 (Safari's visible 390×664 too); from sm the photo is an arch
 * beside or below the copy. The H1, lede, CTAs and photo never fade (the photo is the LCP). Only the
 * pill, the chips and, on large screens, the sample card arrive, once.
 */
export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate scroll-mt-24 overflow-hidden">
      <div aria-hidden className="hero-sky absolute inset-0 -z-20" />
      <div
        aria-hidden
        className="hero-orb motion-loop -top-40 -left-32 -z-10 hidden size-[520px] bg-[radial-gradient(closest-side,rgb(142_211_224/0.45),transparent)] lg:block"
      />

      <Container className="nv-hero-pad pt-[5.25rem] pb-10 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-28">
        {/* Side by side from md, so tablets and landscape phones see the nurse beside the headline. */}
        <div className="nv-hero-grid grid grid-cols-1 items-center gap-x-8 gap-y-3 sm:gap-y-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-x-12">
          <div className="@container">
            {/* One line down to 360px (tighter under 380px); if it ever wraps, the radius keeps it a soft card. */}
            <p
              className="hero-in inline-flex max-w-full items-center gap-2 rounded-[1.25rem] border border-white bg-white/80 py-1 pr-3 pl-1 text-[0.8125rem] font-medium text-balance text-ink-2 shadow-[0_6px_18px_-12px_rgb(1_43_54/0.4)] max-[379px]:gap-1.5 max-[379px]:pr-2.5 sm:gap-2.5 sm:py-1.5 sm:pr-4 sm:pl-2 sm:text-sm"
              style={delay(0)}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-aqua text-primary sm:size-6">
                <span aria-hidden className="live-dot size-1.5 text-primary motion-loop" />
              </span>
              Now visiting homes in {SITE.area}
            </p>

            {/* Focusable by script only: Take a minute returns focus here when its opener is gone. */}
            <h1 id="hero-title" tabIndex={-1} className="nv-hero-title mt-3 text-h1 text-ink focus:outline-none sm:mt-7">
              <span className="block">A registered nurse,</span> <span className="block">at your door.</span>
            </h1>

            <p className="nv-hero-lede mt-3 max-w-[50ch] text-lede text-pretty text-ink-2 sm:mt-6">
              For injections, IV drips, wound dressings, <span className="whitespace-nowrap">check-ups</span> and blood
              tests, at home. A Nivar doctor joins on video when needed, and we tell you the price before we confirm.
            </p>

            {/* Phones read down: the CTA, who calls and when, then the way into the services (8px and 4px
                apart, so no target sits next to the CTA). From sm the link sits beside the CTA, the line under both. */}
            <div className="nv-hero-actions mt-4 flex flex-col items-start sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
              <div data-nv-hero-cta className="w-full sm:w-auto">
                <ContactCtas
                  className="w-full sm:w-auto"
                  buttonClassName="nv-hero-cta h-14 w-full px-8 text-[1.0625rem] sm:w-auto"
                />
              </div>
              <p className="mt-2 text-small text-balance text-ink-2 sm:order-last sm:mt-0 sm:basis-full">
                A care coordinator calls back within {SITE.callbackWithin}, {SITE.hours.short}.
              </p>
              <a href="#services-nursing" className="nv-hero-link mt-1 sm:mt-0">
                See what a nurse can do
                <ArrowDown aria-hidden className="size-4" strokeWidth={2.25} />
              </a>
            </div>

            {/* Phones fill by column, so the two longer chips share the second row (one two-line row, not two). */}
            <ul
              className="hero-in mt-6 grid grid-flow-col grid-cols-2 grid-rows-[auto_auto] gap-x-3 gap-y-3 sm:mt-10 sm:grid-flow-row sm:grid-rows-none sm:gap-x-6 sm:gap-y-3.5 sm:border-t sm:border-ink/10 sm:pt-8"
              style={delay(300)}
            >
              {CHIPS.map(({ key, icon: Icon, text }) => (
                <li key={key} className="flex items-center gap-2 text-[0.875rem] leading-snug font-medium text-ink-2 sm:gap-3 sm:text-small">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-[0_4px_12px_-6px_rgb(1_43_54/0.35)] ring-1 ring-aqua-2 sm:size-9">
                    <Icon aria-hidden className="size-3.5 sm:size-4" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 text-pretty">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <HeroPhoto />
        </div>
      </Container>
    </section>
  );
}

/**
 * Phones: a 16:10 photo above the copy (its own 3:2 file, so the LCP carries only what shows), with the
 * reading the nurse is taking and the caption on it.
 * From sm: the arch inside slow heartbeat ripples, with sample cards that float beside it: the
 * doctor always, the blood pressure reading where the arch is wide enough (not in the narrow md
 * column), the nurse's update on large screens. Cards sit on the wall, the lap and the floor, never
 * on a face. All of it is decoration, so it stays out of the accessibility tree.
 */
function HeroPhoto() {
  return (
    <figure className="@container relative mx-auto w-full max-sm:order-first sm:max-w-[420px] lg:max-w-[480px]">
      <div className="relative">
        {/* Morning light behind the photo. Static: it never loops. */}
        <div
          aria-hidden
          className="absolute -top-16 -right-14 -z-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_236_204/0.9),rgb(142_211_224/0.35)_55%,transparent)] sm:size-64 lg:-top-20 lg:-right-20 lg:size-80"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden items-center justify-center sm:flex">
          {RIPPLES.map(({ start, rest }) => (
            <span
              key={start}
              className="nv-hero-ripple motion-loop absolute aspect-square w-[118%] rounded-full border border-primary/25 bg-primary/[0.03]"
              style={{ "--d": start, "--rest": rest } as CSSProperties}
            />
          ))}
        </div>

        <div className="nv-hero-photo hero-settle relative aspect-[16/10] max-h-[38svh] w-full overflow-hidden rounded-[1.75rem] bg-aqua shadow-[0_24px_48px_-30px_rgb(1_43_54/0.55)] ring-4 ring-white sm:aspect-[4/5] sm:max-h-none sm:rounded-t-[50cqw] sm:rounded-b-[2.5rem] sm:shadow-[0_48px_90px_-40px_rgb(1_43_54/0.5)] sm:ring-[10px]">
          <ArtPicture
            alt="A Nivar nurse in teal scrubs kneels beside an older woman on her sofa and fits a blood pressure cuff on her arm"
            sources={HERO_PHONE}
            fallback={{ src: "/img/nurse-bp-home.jpg", sizes: "(min-width: 1024px) 480px, 420px" }}
            eager
            imgClassName="object-cover object-[50%_40%] sm:object-[50%_30%]"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-pond/30 to-transparent" />
        </div>

        {/* Phones: the reading being taken, low on the left over the nurse's scrubs. Two short lines keep it
            narrow enough to stay clear of both faces and every hand in the 16:10 frame, down to 320px. */}
        <div aria-hidden className="hero-pop absolute bottom-3 left-3 z-10 sm:hidden" style={delay(450)}>
          <div className="rounded-[0.875rem] bg-white/95 py-1.5 pr-3 pl-2 text-ink shadow-[0_10px_24px_-14px_rgb(1_43_54/0.6)]">
            <span className="flex items-center gap-1.5 text-[0.9375rem] leading-5 font-semibold whitespace-nowrap tabular-nums">
              <Gauge className="size-4 shrink-0 text-rose" strokeWidth={2.25} />
              118/76
            </span>
            <span className="flex items-center gap-1.5 text-[0.8125rem] leading-4 font-semibold text-primary">
              <span className="flex size-4 shrink-0 items-center justify-center">
                <span className="size-1.5 rounded-full bg-signal" />
              </span>
              Normal
            </span>
          </div>
        </div>

        <FloatCard position="top-[8%] -right-[2%] hidden lg:block xl:-right-[10%]" enter={500} float="8s" floatDelay="-1s">
          <StatusCard icon={BriefcaseMedical} title="Your nurse is on the way" sub="Sample update" />
        </FloatCard>
        <FloatCard
          position="top-[54%] -right-[8%] hidden w-[220px] sm:block md:max-lg:hidden lg:-right-[2%] xl:-right-[12%]"
          className="px-4 py-3"
          enter={750}
          float="7.5s"
          floatDelay="-3s"
        >
          <BpCard />
        </FloatCard>
        <FloatCard
          position="bottom-[5%] -left-8 hidden sm:block md:-left-4 lg:-left-10"
          enter={1000}
          float="9s"
          floatDelay="-5s"
        >
          <StatusCard icon={Video} title="Your Nivar doctor" sub="On video when you need one" online />
        </FloatCard>
      </div>

      <figcaption className="absolute right-3 bottom-3 rounded-full bg-white/85 px-2.5 py-0.5 text-caption text-ink-2 sm:static sm:mt-6 sm:rounded-none sm:bg-transparent sm:p-0 sm:text-center">
        <span className="sm:hidden">
          Illustrative<span className="sr-only"> photo and reading</span>
        </span>
        <span className="max-sm:hidden md:max-lg:hidden">Photo and readings are illustrative.</span>
        <span className="hidden md:max-lg:inline">Photo is illustrative.</span>
      </figcaption>
    </figure>
  );
}

/* Phones get the 3:2 crop of the same frame (perf-09). */
const HERO_PHONE = [{ media: "(width < 40rem)", src: "/img/nurse-bp-home-3x2.jpg", sizes: "calc(100vw - 40px)" }] as const;

/* Three rings, a third of a cycle apart. With motion off they rest as three still circles. */
const RIPPLES = [
  { start: "0s", rest: 0.96 },
  { start: "1.8s", rest: 1.08 },
  { start: "3.6s", rest: 1.2 },
];

const CARD = "rounded-2xl bg-white/95 shadow-[0_20px_40px_-24px_rgb(1_43_54/0.45)] ring-1 ring-ink/5";

/** Placement and entrance on the outside; the slow float on the card itself. */
function FloatCard({
  position,
  className,
  enter,
  float,
  floatDelay,
  children,
}: {
  position: string;
  className?: string;
  enter: number;
  float: string;
  floatDelay: string;
  children: ReactNode;
}) {
  return (
    <div aria-hidden className={cn("hero-pop absolute z-10", position)} style={delay(enter)}>
      <div className={cn("nv-hero-float motion-loop", CARD, className)} style={{ "--t": float, "--fd": floatDelay } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, title, sub, online = false }: { icon: LucideIcon; title: string; sub: string; online?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 pr-5 pl-3">
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Icon className="size-[1.125rem]" strokeWidth={2} />
        {online && (
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-white">
            <span className="size-2.5 rounded-full bg-signal" />
          </span>
        )}
      </span>
      <span className="leading-snug">
        <span className="block text-[0.9375rem] font-semibold whitespace-nowrap text-ink">{title}</span>
        <span className="block text-caption whitespace-nowrap text-ink-3">{sub}</span>
      </span>
    </div>
  );
}

/** The reading in the photo, as the nurse's monitor would show it. Sample values. */
function BpCard() {
  return (
    <>
      <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <Gauge className="size-4 text-rose" strokeWidth={2.25} />
          Blood pressure
        </span>
        <span className="text-xs text-ink-3">Just now</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tracking-tight text-ink tabular-nums">118/76</span>
          <span className="text-xs font-medium text-ink-3">mmHg</span>
        </span>
        <span className="rounded-full bg-aqua px-2 py-0.5 text-xs font-semibold text-primary">Normal</span>
      </div>
      <BpScale />
    </>
  );
}

/*
 * Where the reading falls, on a systolic scale from 90 to 160 mmHg: normal below 120, elevated 120–129,
 * high from 130 (AHA/ACC 2025). 118 sits at 40%. The bands draw in, then the marker slides to the
 * reading (hero.css), once.
 */
function BpScale() {
  return (
    <span className="relative mt-3 block h-3.5">
      <span className="nv-hero-bp-bands absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-0.5 overflow-hidden rounded-full">
        <span className="basis-[43%] bg-signal" />
        <span className="basis-[14%] bg-saffron/45" />
        <span className="flex-1 bg-rose/55" />
      </span>
      <span className="nv-hero-bp-slide absolute inset-0">
        <span className="absolute top-0 left-[40%] size-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_2px_6px_rgb(1_43_54/0.35)] ring-2 ring-primary" />
      </span>
    </span>
  );
}
