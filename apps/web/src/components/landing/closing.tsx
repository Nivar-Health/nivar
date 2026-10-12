import Link from "next/link";
import type { ReactNode } from "react";
import { Clock, Mail, PhoneCall } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";
import { CallbackForm } from "./callback-form";
import { Container, CtaLink, SectionHeading } from "./primitives";

export function Callback() {
  return (
    <section id="callback" aria-labelledby="callback-title" className="scroll-mt-20 pb-20 sm:pb-24 lg:pb-32">
      <Container>
        <div className="grid grid-cols-1 gap-10 rounded-[28px] bg-mint/60 p-5 ring-1 ring-primary/10 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:p-14">
          <div className="pt-3 sm:pt-0">
            <SectionHeading
              id="callback-title"
              title="Rather talk it through first?"
              lede="Leave your number and a Nivar care coordinator will call you back. We can help you pick the right check-up, or book one for your parents while you are on the phone."
            />
            <ul className="mt-8 space-y-4 text-[0.95rem] text-ink">
              <li className="flex items-center gap-3">
                <PhoneCall className="size-[18px] text-primary" aria-hidden />
                Callbacks usually within 30 minutes
              </li>
              <li className="flex items-center gap-3">
                <Clock className="size-[18px] text-primary" aria-hidden />
                Every day, 7 am to 9 pm
              </li>
              <li className="flex items-center gap-3">
                <Mail className="size-[18px] text-primary" aria-hidden />
                <a
                  href="mailto:care@nivar.health"
                  className="rounded-sm underline decoration-ink/20 underline-offset-4 outline-none hover:decoration-ink focus-visible:ring-3 focus-visible:ring-primary/30"
                >
                  care@nivar.health
                </a>
              </li>
            </ul>
          </div>
          <div className="rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgb(19_35_33/0.05),0_24px_48px_-28px_rgb(14_94_82/0.35)] sm:p-8">
            <CallbackForm />
          </div>
        </div>
      </Container>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="relative isolate overflow-hidden bg-teal-deep text-ivory">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ecg-grid-dark" />
      <EcgLine
        beats={7}
        amplitude={0.9}
        className="pointer-events-none absolute inset-x-0 bottom-3 -z-10 h-20 opacity-70 sm:h-24"
        strokeClassName="stroke-white/40"
        glowClassName="stroke-saffron"
      />
      <Container className="flex flex-col items-start gap-8 pt-20 pb-32 sm:pt-24 sm:pb-36 lg:flex-row lg:items-end lg:justify-between lg:pt-28 lg:pb-40">
        <div className="max-w-2xl">
          <h2
            id="final-cta-title"
            className="font-display text-[2.2rem] leading-[1.06] font-medium tracking-[-0.03em] text-balance text-white sm:text-[3rem] lg:text-[3.5rem]"
          >
            The next <span className="whitespace-nowrap">check-up</span> can happen on your sofa.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ivory/75">
            Book in two minutes. A nurse at your door within the hour, a doctor on video, a report in your app.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 min-[420px]:w-auto min-[420px]:flex-row">
          <CtaLink href="/app/book" variant="saffron" size="lg">
            Book a home check-up
          </CtaLink>
          <CtaLink
            href="#callback"
            size="lg"
            variant="ghost"
            className="text-ivory ring-1 ring-white/25 hover:bg-white/10 focus-visible:ring-offset-teal-deep"
          >
            Request a callback
          </CtaLink>
        </div>
      </Container>
    </section>
  );
}

const FOOTER_LINKS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Check-ups",
    links: [
      { href: "#how-it-works", label: "How it works" },
      { href: "#services", label: "Packages and prices" },
      { href: "#devices", label: "Smart devices" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Nivar",
    links: [
      { href: "#doctors", label: "Our doctors and nurses" },
      { href: "#callback", label: "Request a callback" },
      { href: "mailto:care@nivar.health", label: "care@nivar.health" },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/app/book", label: "Book a check-up" },
      { href: "/app/bookings", label: "My bookings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ivory">
      <Container className="py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          <div className="max-w-xs">
            <Logo size="md" />
            <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
              Doctor-led health check-ups at home, by a team that works for us full-time. Made in Bangalore.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {FOOTER_LINKS.map((col) => (
              <div key={col.title}>
                <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterLink href={l.href}>{l.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 rounded-2xl border border-danger/15 bg-danger/[0.04] px-5 py-4 text-sm leading-relaxed text-ink/80">
          Nivar is not an emergency service. For chest pain, breathlessness or any emergency, call{" "}
          <a href="tel:112" className="font-semibold text-danger underline underline-offset-4">
            112
          </a>{" "}
          or go to the nearest hospital.
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-ink/8 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Nivar Health. All rights reserved.</p>
          <Link
            href="/staff/login"
            className="rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-ink hover:underline focus-visible:ring-3 focus-visible:ring-primary/30"
          >
            Staff login
          </Link>
        </div>
      </Container>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  const cls =
    "rounded-sm text-[0.92rem] text-muted-foreground transition-colors outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/30";
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {children}
    </a>
  );
}
