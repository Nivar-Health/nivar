import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MessageCircle, Phone, PhoneCall, Stethoscope, type LucideIcon } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { bookingEnabled } from "@/lib/features";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { CallbackForm } from "./callback-form";
import { Disclosure } from "./disclosure";
import { STAY_HEALTHY } from "./l10n";
import { MotionToggle } from "./motion-toggle";
import { Container, revealProps } from "./primitives";
import { Pearl } from "./take-a-minute/pearl";
import { WhatsAppLink, whatsappHref } from "./whatsapp";
import "./closing.css";

/** Short phrases (the hours) that should never break, e.g. "9 / pm" on a narrow phone. */
const nowrap = (s: string) => <span className="whitespace-nowrap">{s}</span>;

// Each promise is made once in this section: the number's privacy lives under the form's button.
const CALLBACK_POINTS: { key: string; icon: LucideIcon; text: ReactNode }[] = [
  {
    key: "call",
    icon: Phone,
    text: (
      <span>
        A call back within {SITE.callbackWithin}, {nowrap(SITE.hours.short)}
      </span>
    ),
  },
  { key: "help", icon: Stethoscope, text: "Help working out what care you need" },
];

/** Inline text link with a 44px hit area that does not change the line box. */
const INLINE_LINK =
  "relative rounded-sm font-semibold underline underline-offset-2 focus-ring before:absolute before:-inset-x-3 before:-inset-y-3.5";
/**
 * The 112 and 108 links: 47px tall hit areas that reach 44px wide on their outer sides, so 8px stays
 * free between the two (the links sit 25px apart). Pressed: a tint on the digits, 90 ms in, 180 out.
 */
const TEL_LINK =
  "relative rounded-sm font-semibold underline underline-offset-2 transition-colors duration-180 ease-standard focus-ring before:absolute before:-inset-y-3.5 active:bg-white/12 active:duration-90";

const POINT_ICON =
  "flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-mint-glow ring-1 ring-white/15";

/* ------------------------------------------------------------------------- */
/* Callback                                                                   */
/* ------------------------------------------------------------------------- */

export function Callback() {
  const wa = whatsappHref();
  return (
    // The scroll margin lands the pond card itself just under the fixed nav (where every other band
    // lands), not the white gap above it, so a jump here shows the heading and the first fields.
    <section
      id="callback"
      aria-labelledby="callback-title"
      className="scroll-mt-8 py-16 sm:scroll-mt-4 sm:py-20 lg:scroll-mt-0 lg:py-28"
    >
      <Container>
        {/* overflow-clip, not hidden: it clips the glows without becoming a scroll container, so the
            success message can stay sticky inside the card. */}
        <div className="theme-pine relative isolate overflow-clip rounded-[2rem] bg-[linear-gradient(150deg,var(--jade)_0%,var(--pond-2)_50%,var(--pond)_100%)] px-3 pt-9 pb-6 sm:p-10 lg:p-14">
          <div
            aria-hidden
            className="absolute -top-40 -left-40 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.22),transparent)]"
          />
          <div
            aria-hidden
            className="absolute -right-32 -bottom-48 -z-10 size-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.12),transparent)]"
          />
          {/* Phones read the heading, then the form, whose side note under the button keeps the call-back
              promise; from sm the reassurances follow the form. From lg the left column is the heading, the
              coordinator's photo and the reassurances, beside the form: the photo's row takes what the form
              leaves, so the photo never makes the section taller than the form. */}
          <div className="grid gap-7 sm:gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr_auto] lg:gap-x-12 lg:gap-y-8">
            <div className="px-1 sm:px-0 lg:col-span-5 lg:pt-4">
              <h2 id="callback-title" className="text-h2 text-balance text-white">
                Want us to call you?
              </h2>
              {/* on-pine, not on-pine-2: over the top-left glow on-pine-2 falls under 4.5:1 on phones. */}
              <p className="mt-4 max-w-[46ch] text-lede text-pretty text-on-pine sm:mt-5">
                Tell us who the visit is for and what they need. A care coordinator calls you back and tells you the
                price before anything is booked.
              </p>
            </div>
            {/* lg only, and lazy: hidden below that and sized 0px, so it is never fetched. 4:3 at the full height
                of its row, so its width follows. With WhatsApp set, a third point shares the column, which leaves
                the photo enough room only from xl. */}
            <div
              className={cn(
                "relative hidden aspect-[4/3] h-full max-w-full min-h-36 justify-self-start overflow-hidden rounded-3xl bg-white/8 ring-1 ring-white/10 lg:col-span-5 lg:row-start-2",
                wa ? "xl:block" : "lg:block",
              )}
            >
              <Image
                src="/img/care-coordinator.jpg"
                alt="A Nivar care coordinator wearing a headset takes notes at a desk"
                fill
                sizes="(min-width: 1024px) 400px, 0px"
                className="object-cover"
              />
            </div>
            <div {...revealProps(1)} className="lg:col-span-7 lg:col-start-6 lg:row-span-3 lg:row-start-1">
              <div className="theme-light rounded-3xl bg-white p-5 text-ink shadow-[0_40px_80px_-40px_rgb(0_0_0/0.55)] max-sm:px-4 sm:p-8">
                <CallbackForm />
              </div>
            </div>
            {/* Below sm the points leave (the side note carries the call back); a WhatsApp or phone line stays. */}
            <ul
              className={cn(
                "flex flex-col gap-4 px-1 sm:px-0 lg:col-span-5 lg:row-start-3",
                !wa && !SITE.phone && "max-sm:hidden",
              )}
            >
              {CALLBACK_POINTS.map(({ key, icon: Icon, text }) => (
                <li key={key} className="flex items-center gap-3.5 text-body text-pretty text-white max-sm:hidden">
                  <span className={POINT_ICON}>
                    <Icon aria-hidden className="size-[1.125rem]" />
                  </span>
                  {text}
                </li>
              ))}
              {wa && (
                <li className="flex items-center gap-3.5 text-body text-pretty text-white">
                  <span className={POINT_ICON}>
                    <MessageCircle aria-hidden className="size-[1.125rem]" />
                  </span>
                  <span>
                    Prefer to chat?{" "}
                    <WhatsAppLink href={wa} className={`${INLINE_LINK} text-mint-glow`}>
                      Message us on WhatsApp
                    </WhatsAppLink>
                  </span>
                </li>
              )}
              {SITE.phone && (
                <li className="flex items-center gap-3.5 text-body text-pretty text-white">
                  <span className={POINT_ICON}>
                    <PhoneCall aria-hidden className="size-[1.125rem]" />
                  </span>
                  <span>
                    Prefer to call?{" "}
                    <a href={`tel:${SITE.phone.tel}`} className={`${INLINE_LINK} text-mint-glow tabular-nums`}>
                      {SITE.phone.display}
                    </a>
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------- */
/* Footer                                                                     */
/* ------------------------------------------------------------------------- */

/** An in-page anchor, another route (sign-in only), or the Take a minute launcher. */
type FooterItem = { label: string; href: `#${string}` } | { label: string; route: string } | { label: string; minute: true };

/** Spec §2.3. Plain `#id` links, so they work without JS and scroll natively. */
const FOOTER_COLUMNS: { id: `foot-${string}`; heading: string; items: FooterItem[] }[] = [
  {
    id: "foot-nivar",
    heading: "Nivar",
    items: [
      { label: "Services", href: "#services" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Your nurse", href: "#nurses" },
      { label: "Compare", href: "#compare" },
      { label: "Check-ups", href: "#check-ups" },
    ],
  },
  {
    id: "foot-care",
    heading: "Care at home",
    items: [
      { label: "Injections and vaccines", href: "#service-injections" },
      { label: "IV drips", href: "#service-iv-drips" },
      { label: "Wound care", href: "#service-wound-care" },
      { label: "Blood tests at home", href: "#service-blood-tests" },
      { label: "Live readings", href: "#live" },
    ],
  },
  {
    id: "foot-help",
    heading: "Help",
    items: [
      { label: "Health tips", href: "#health-tips" },
      { label: "Take a minute", minute: true },
      { label: "Questions", href: "#faq" },
      { label: "Request a callback", href: "#callback" },
      // Staff reach /staff/login directly: the public footer doesn't advertise the console (spec Q8).
      ...(bookingEnabled ? [{ label: "Log in", route: "/login" }] : []),
    ],
  },
];

/** 44px tall rows; the pressed tint bleeds 10px past the text, which stays aligned with its heading. */
const FOOTER_LINK =
  "nv-foot-link -mx-2.5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-small focus-ring";

function FooterLink({ item }: { item: FooterItem }) {
  if ("minute" in item) {
    return (
      <button
        type="button"
        data-minute-open=""
        data-minute-scope=""
        aria-haspopup="dialog"
        className={cn(FOOTER_LINK, "cursor-pointer")}
      >
        {item.label}
        <Pearl size={12} data-minute-origin="" />
      </button>
    );
  }
  if ("route" in item) {
    return (
      <Link href={item.route} className={FOOTER_LINK}>
        {item.label}
      </Link>
    );
  }
  return (
    <a href={item.href} className={FOOTER_LINK}>
      {item.label}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="theme-pine band-pond relative isolate overflow-hidden">
      <h2 className="sr-only">Site footer</h2>
      <Container className="pt-16 pb-8 sm:pt-20 lg:pt-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <p className="text-cta max-w-[15ch] text-balance text-white">Your OPD, at home.</p>
            <p className="mt-4 max-w-[34ch] text-lede text-pretty text-on-pine-2 sm:mt-5">
              Nurses at your door in {SITE.area}, {nowrap(SITE.hours.short)}.
            </p>
            <p className="nv-foot-hello mt-4 text-body font-medium text-mint-glow sm:mt-5">
              {STAY_HEALTHY.map((p) => (
                <span key={p.lang} lang={p.lang}>
                  {p.text}
                </span>
              ))}
            </p>
          </div>
          {/* Phones: three closed drop-downs, so the footer stops repeating the menu. From sm the three
              columns as before, each heading rendered once as its drop-down's head (spec §1.10). */}
          <nav aria-label="Footer" className="lg:col-span-7 lg:pt-2">
            <ul role="list" className="nv-disc-group--dark nv-foot-groups sm:grid sm:grid-cols-3 sm:gap-x-4">
              {FOOTER_COLUMNS.map((col) => (
                <li key={col.id}>
                  <Disclosure
                    id={col.id}
                    collapse="phone"
                    variant="dark"
                    title={col.heading}
                    head={<h3 className="text-sm font-semibold text-white">{col.heading}</h3>}
                  >
                    <ul className="grid gap-2 sm:mt-2.5">
                      {col.items.map((item) => (
                        <li key={item.label} className="flex">
                          <FooterLink item={item} />
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* The trace draws once as the footer arrives (landing.css .ecg-draw); at rest it is simply drawn. */}
        <div {...revealProps(0)} className="mt-12 sm:mt-16">
          <EcgLine draw beats={3} thin className="h-10 sm:hidden" strokeClassName="stroke-mint-glow/50" />
          <EcgLine draw beats={6} thin className="hidden h-12 sm:block" strokeClassName="stroke-mint-glow/50" />
        </div>

        <div className="mt-8 flex flex-col gap-5 sm:mt-10">
          <p className="flex w-fit items-start gap-2.5 rounded-2xl bg-white/8 px-4 py-3 text-small text-pretty text-white ring-1 ring-white/12">
            <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-mint-glow" />
            <span>
              Nivar is not an emergency service. In an emergency, call{" "}
              <a href="tel:112" className={`${TEL_LINK} text-mint-glow before:-right-2 before:-left-5`}>
                112
              </a>{" "}
              (or{" "}
              <a href="tel:108" className={`${TEL_LINK} text-mint-glow before:-right-3.5 before:-left-2`}>
                108
              </a>{" "}
              for an ambulance).
            </span>
          </p>
          <div className="flex flex-col gap-1.5 text-caption text-on-pine-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <p className="text-pretty">
              Health information on this page is general guidance, not a diagnosis.{" "}
              <span className="whitespace-nowrap">Photographs are illustrative.</span>
            </p>
            <div className="flex flex-wrap items-center justify-between gap-x-6 lg:shrink-0">
              <p className="whitespace-nowrap">
                {SITE.legalName}, {SITE.city}
              </p>
              <MotionToggle className="nv-foot-link -mx-2.5 shrink-0 cursor-pointer rounded-xl px-2.5 [&_svg]:size-3.5" />
            </div>
          </div>
        </div>
      </Container>

      {/* The name, very large, fading into the bottom of the page. */}
      <div
        aria-hidden
        className="pointer-events-none relative -mt-6 flex flex-col justify-end overflow-hidden select-none sm:-mt-10"
      >
        <p className="mx-auto max-w-[1600px] translate-y-[16%] bg-[linear-gradient(180deg,rgb(255_255_255/0.22)_0%,rgb(255_255_255/0.07)_50%,rgb(255_255_255/0)_82%)] bg-clip-text px-2 text-center text-[clamp(7rem,37vw,42rem)] leading-[0.85] font-semibold tracking-[-0.07em] text-transparent">
          nivar
          <span className="bg-[linear-gradient(180deg,rgb(142_211_224/0.55)_0%,rgb(142_211_224/0.12)_60%,rgb(142_211_224/0)_90%)] bg-clip-text">.</span>
        </p>
      </div>
    </footer>
  );
}
