import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { ArrowDown, BadgeCheck, BriefcaseMedical, IndianRupee, PackageCheck, Video, type LucideIcon } from "lucide-react";
import { SITE } from "@/lib/site-facts";
import { Container } from "./primitives";
import { ContactCtas } from "./whatsapp";
import "./hero.css";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const CHIPS: { icon: LucideIcon; text: ReactNode; key: string }[] = [
  { key: "nurses", icon: BadgeCheck, text: "Registered nurses" },
  { key: "doctor", icon: Video, text: "Doctor on video" },
  { key: "price", icon: IndianRupee, text: "Price told upfront" },
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
];

/**
 * The first screen, nurse first. On phones the photo leads (3:2) and the H1, lede and callback button
 * still fit the first screen at 390×844; from sm the photo is an arch beside or below the copy.
 * The H1, lede, CTAs and photo never fade (the photo is the LCP). Only the pill, the chips and, on
 * large screens, the sample card arrive, once.
 */
export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate scroll-mt-24 overflow-hidden">
      <div aria-hidden className="hero-sky absolute inset-0 -z-20" />
      <div
        aria-hidden
        className="hero-orb motion-loop -top-40 -left-32 -z-10 hidden size-[520px] bg-[radial-gradient(closest-side,rgb(142_211_224/0.45),transparent)] lg:block"
      />

      <Container className="pt-24 pb-10 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-28">
        {/* Side by side from md, so tablets and landscape phones see the nurse beside the headline. */}
        <div className="grid grid-cols-1 items-center gap-x-8 gap-y-4 sm:gap-y-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-x-12">
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

            <h1 id="hero-title" className="nv-hero-title mt-3 text-h1 text-ink sm:mt-7">
              <span className="block">A registered nurse,</span> <span className="block">at your door.</span>
            </h1>

            <p className="mt-3 max-w-[50ch] text-lede text-pretty text-ink-2 sm:mt-6">
              For injections, IV drips, wound dressings, <span className="whitespace-nowrap">check-ups</span> and blood
              tests, at home. A Nivar doctor joins on video when needed, and we tell you the price before we confirm.
            </p>

            <div className="mt-5 flex flex-col items-start gap-x-6 gap-y-1 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-3">
              <ContactCtas className="w-full sm:w-auto" buttonClassName="h-14 w-full px-8 text-[1.0625rem] sm:w-auto" />
              <a href="#services" className="nv-hero-link">
                See services and prices
                <ArrowDown aria-hidden className="size-4" strokeWidth={2.25} />
              </a>
            </div>
            <p className="text-caption text-balance text-ink-3 sm:mt-3">
              A care coordinator calls back within {SITE.callbackWithin}, {SITE.hours.short}.
            </p>

            <ul
              className="hero-in mt-6 grid grid-cols-2 gap-x-3 gap-y-3 sm:mt-10 sm:gap-x-6 sm:gap-y-3.5 sm:border-t sm:border-ink/10 sm:pt-8"
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
 * Phones: a 3:2 photo above the copy, with the caption on it. From sm: the arch, with the caption
 * under it and, on large screens, one sample update card on the wall.
 */
function HeroPhoto() {
  return (
    <figure className="@container relative mx-auto w-full max-sm:order-first sm:max-w-[420px] lg:max-w-[480px]">
      {/* Morning light behind the photo. Static: it never loops. */}
      <div
        aria-hidden
        className="absolute -top-16 -right-14 -z-10 size-56 rounded-full bg-[radial-gradient(closest-side,rgb(255_236_204/0.9),rgb(142_211_224/0.35)_55%,transparent)] sm:size-64 lg:-top-20 lg:-right-20 lg:size-80"
      />

      <div className="hero-settle relative aspect-[3/2] max-h-[38svh] w-full overflow-hidden rounded-[1.75rem] bg-aqua shadow-[0_24px_48px_-30px_rgb(1_43_54/0.55)] ring-4 ring-white sm:aspect-[4/5] sm:max-h-none sm:rounded-t-[50cqw] sm:rounded-b-[2.5rem] sm:shadow-[0_48px_90px_-40px_rgb(1_43_54/0.5)] sm:ring-[10px]">
        <Image
          src="/img/nurse-bp-home.jpg"
          alt="A Nivar nurse in teal scrubs kneels beside an older woman on her sofa and fits a blood pressure cuff on her arm"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 480px, (min-width: 640px) 420px, 100vw"
          className="object-cover object-[50%_38%] sm:object-[50%_30%]"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-pond/30 to-transparent" />
      </div>

      <div aria-hidden className="hero-pop absolute top-[8%] -right-[4%] z-10 hidden lg:block xl:-right-[10%]" style={delay(500)}>
        <div className="flex items-center gap-3 rounded-2xl bg-white py-3 pr-5 pl-3 shadow-[0_18px_40px_-32px_rgb(1_43_54/0.45)] ring-1 ring-ink/5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <BriefcaseMedical className="size-[1.125rem]" strokeWidth={2} />
          </span>
          <span className="leading-snug">
            <span className="block text-[0.9375rem] font-semibold text-ink">Your nurse is on the way</span>
            <span className="block text-caption text-ink-3">Sample update</span>
          </span>
        </div>
      </div>

      <figcaption className="absolute right-3 bottom-3 rounded-full bg-white/85 px-2.5 py-0.5 text-caption text-ink-2 sm:static sm:mt-6 sm:rounded-none sm:bg-transparent sm:p-0 sm:text-center sm:text-ink-3">
        Photo is illustrative.
      </figcaption>
    </figure>
  );
}
