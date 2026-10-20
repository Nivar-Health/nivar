import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { MessageCircle, Phone, PhoneCall, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";
import { bookingEnabled } from "@/lib/features";
import { SITE } from "@/lib/site-facts";
import { CallbackForm } from "./callback-form";
import { STAY_HEALTHY } from "./l10n";
import { Container, revealProps } from "./primitives";
import { ContactCtas, WhatsAppLink, whatsappHref } from "./whatsapp";

/** Short phrases (the hours) that should never break, e.g. "9 / pm" on a narrow phone. */
const nowrap = (s: string) => <span className="whitespace-nowrap">{s}</span>;
/** In running text, keep each number with its unit ("7 AM", "30 minutes") but let the sentence wrap freely. */
const units = (s: string) => s.replace(/(\d) /g, "$1 ");

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
  { key: "privacy", icon: ShieldCheck, text: "Your number is only used for this request" },
];

/** Inline text link with a 44px hit area that does not change the line box. */
const INLINE_LINK =
  "relative rounded-sm font-semibold underline underline-offset-2 focus-ring before:absolute before:-inset-x-3 before:-inset-y-3.5";

/* ------------------------------------------------------------------------- */
/* Callback                                                                   */
/* ------------------------------------------------------------------------- */

export function Callback() {
  const wa = whatsappHref();
  return (
    <section id="callback" aria-labelledby="callback-title" className="scroll-mt-24 py-20 lg:py-28">
      <Container>
        <div className="theme-pine relative isolate overflow-hidden rounded-[2.25rem] bg-[linear-gradient(150deg,var(--jade)_0%,var(--pond-2)_50%,var(--pond)_100%)] p-6 sm:p-10 lg:p-14">
          <div
            aria-hidden
            className="absolute -top-40 -left-40 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.22),transparent)]"
          />
          <div
            aria-hidden
            className="absolute -right-32 -bottom-48 -z-10 size-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.12),transparent)]"
          />
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5 lg:pt-4">
              <h2 id="callback-title" className="text-h2 text-balance text-white">
                Want us to call you?
              </h2>
              <p className="mt-5 max-w-[46ch] text-lede text-pretty text-on-pine-2">
                {units(
                  `Tell us who the visit is for and what they need. A care coordinator calls back within ${SITE.callbackWithin}, ${SITE.hours.inSentence}, and tells you the price before anything is booked.`,
                )}
              </p>
              <ul className="mt-9 flex flex-col gap-4">
                {CALLBACK_POINTS.map(({ key, icon: Icon, text }) => (
                  <li key={key} className="flex items-center gap-3.5 text-body text-white">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-mint-glow ring-1 ring-white/15">
                      <Icon aria-hidden className="size-[1.125rem]" />
                    </span>
                    {text}
                  </li>
                ))}
                {wa && (
                  <li className="flex items-center gap-3.5 text-body text-white">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-mint-glow ring-1 ring-white/15">
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
                  <li className="flex items-center gap-3.5 text-body text-white">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-mint-glow ring-1 ring-white/15">
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
            <div {...revealProps(1)} className="lg:col-span-7">
              <div className="theme-light rounded-[1.75rem] bg-white p-6 text-ink shadow-[0_40px_80px_-40px_rgb(0_0_0/0.55)] sm:p-8">
                <CallbackForm />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The final call to action now opens the footer (see SiteFooter); kept as a no-op for older imports. */
export function FinalCta() {
  return null;
}

/* ------------------------------------------------------------------------- */
/* Footer                                                                     */
/* ------------------------------------------------------------------------- */

const FOOTER_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Nivar",
    links: [
      { label: "Services and prices", href: "/services" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Why Nivar Health?", href: "/why-nivar" },
      { label: "Health tips", href: "/#health-tips" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Injections and drips", href: "/services#service-injections" },
      { label: "Health check-ups", href: "/services#check-ups" },
      { label: "Lab tests", href: "/services#lab-tests" },
      { label: "Live readings", href: "/how-it-works#live" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: "Request a callback", href: "/#callback" },
      { label: "Questions", href: "/#faq" },
      ...(bookingEnabled
        ? [
            { label: "Log in", href: "/login" },
            { label: "Staff login", href: "/staff/login" },
          ]
        : []),
    ],
  },
];

/** Footer link: the outline hugs the text; the ::before gives a 44px hit area without overlapping its neighbours. */
const FOOTER_LINK =
  "relative rounded-sm text-small text-on-pine-2 transition-colors hover:text-white focus-ring before:absolute before:-inset-x-1 before:-inset-y-2.75";

export function SiteFooter() {
  return (
    <footer className="theme-pine band-pond relative isolate overflow-hidden">
      <h2 className="sr-only">Site footer</h2>
      <Container className="pt-20 pb-10 lg:pt-28">
        {/* The closing call to action */}
        <div className="relative flex flex-col items-start gap-10 pb-20 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-cta max-w-[15ch] text-balance text-white">Your OPD, at home.</p>
            <p className="mt-6 max-w-[44ch] text-lede text-on-pine-2">
              Nurses at your door in {SITE.area}, {nowrap(SITE.hours.short)}.
            </p>
            <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-body font-medium text-mint-glow">
              {STAY_HEALTHY.map((p, i) => (
                <Fragment key={p.lang}>
                  {i > 0 && (
                    <span aria-hidden className="size-1 rounded-full bg-white/30" />
                  )}
                  <span lang={p.lang}>{p.text}</span>
                </Fragment>
              ))}
            </p>
          </div>
          <ContactCtas tone="dark" buttonClassName="h-14 px-8 text-[1.0625rem]" />
          <EcgLine
            draw
            beats={6}
            thin
            className="pointer-events-none absolute inset-x-0 bottom-4 hidden h-12 sm:block"
            strokeClassName="stroke-mint-glow/50 motion-reduce:[animation-delay:0s]!"
          />
        </div>

        <div className="grid gap-12 border-t border-white/12 pt-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo size="md" variant="light" />
            <p className="mt-5 max-w-[36ch] text-small text-pretty text-on-pine-2">
              Nurse-led care at home, with a doctor on video when you need one. {SITE.area}, {SITE.city}.
            </p>
            {SITE.phone && (
              <p className="mt-4 text-small text-on-pine-2">
                Call us on{" "}
                <a href={`tel:${SITE.phone.tel}`} className={`${INLINE_LINK} text-white tabular-nums`}>
                  {SITE.phone.display}
                </a>
              </p>
            )}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading}>
                <h3 className="text-sm font-semibold text-white">{col.heading}</h3>
                <ul className="mt-4 flex flex-col gap-5.5">
                  {col.links.map((l) => (
                    <li key={l.label} className="flex">
                      <Link href={l.href} className={FOOTER_LINK}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/12 pt-8">
          <p className="flex w-fit items-start gap-2.5 rounded-2xl bg-white/8 px-4 py-3 text-small text-pretty text-white ring-1 ring-white/12">
            <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold" />
            <span>
              Nivar is not an emergency service. In an emergency, call{" "}
              <a href="tel:112" className={`${INLINE_LINK} text-marigold`}>
                112
              </a>{" "}
              (or{" "}
              <a href="tel:108" className={`${INLINE_LINK} text-marigold`}>
                108
              </a>{" "}
              for an ambulance).
            </span>
          </p>
          <div className="flex flex-col gap-2 text-caption text-on-pine-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-pretty">Health information on this page is general guidance, not a diagnosis.</p>
            <p>
              {SITE.legalName}, {SITE.city}
            </p>
          </div>
        </div>
      </Container>

      {/* The name, very large, fading into the bottom of the page. */}
      <div aria-hidden className="pointer-events-none relative -mt-6 overflow-hidden select-none sm:-mt-10">
        <p className="mx-auto max-w-[1600px] translate-y-[16%] bg-[linear-gradient(180deg,rgb(255_255_255/0.22)_0%,rgb(255_255_255/0.07)_50%,rgb(255_255_255/0)_82%)] bg-clip-text px-2 text-center text-[clamp(7rem,37vw,42rem)] leading-[0.85] font-semibold tracking-[-0.07em] text-transparent">
          nivar
          <span className="bg-[linear-gradient(180deg,rgb(142_211_224/0.55)_0%,rgb(142_211_224/0.12)_60%,rgb(142_211_224/0)_90%)] bg-clip-text">.</span>
        </p>
      </div>
    </footer>
  );
}
