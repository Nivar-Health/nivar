import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { bookingEnabled } from "@/lib/features";
import { CallbackForm } from "./callback-form";
import { BOOK_LABEL, ButtonLink, Container, Section, SectionTitle, bookHref } from "./primitives";

export function Callback() {
  return (
    <Section id="callback" className="border-t border-border">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <SectionTitle
              title="Want us to call you?"
              lede="Tell us a little about who the check-up is for. A care coordinator calls back within 30 minutes between 7 am and 9 pm, and helps you choose the right programme."
            />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="rounded-3xl border border-border p-6 sm:p-8">
              <CallbackForm />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export function FinalCta() {
  return (
    <section className="bg-[#0a0a0a] py-24 text-white lg:py-[140px]">
      <Container className="flex flex-col items-start gap-10 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display max-w-[16ch] text-[2.75rem] leading-[1.02] font-medium tracking-[-0.03em] text-balance sm:text-[3.5rem] lg:text-[4.25rem]">
            {bookingEnabled ? "Book your first check-up today." : "Plan your first check-up today."}
          </h2>
          <p className="mt-6 max-w-[44ch] text-[1.0625rem] leading-[1.6] text-[#a3a39e]">
            Same-day slots across Bangalore. Pay after the visit.
          </p>
        </div>
        <ButtonLink href={bookHref()} variant="inverse" className="h-12 px-6">
          {BOOK_LABEL}
        </ButtonLink>
      </Container>
    </section>
  );
}

const FOOTER_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Nivar",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "What we test", href: "#what-we-test" },
      { label: "Pricing", href: "#pricing" },
      { label: "For families", href: "#for-families" },
    ],
  },
  {
    heading: "Account",
    links: [
      ...(bookingEnabled
        ? [
            { label: "Book a check-up", href: "/app/book" },
            { label: "Log in", href: "/login" },
          ]
        : []),
      { label: "Request a callback", href: "#callback" },
      { label: "Questions", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Our doctors", href: "#doctors" },
      { label: "Devices", href: "#devices" },
      { label: "Live readings", href: "#live" },
      ...(bookingEnabled ? [{ label: "Staff login", href: "/staff/login" }] : []),
    ],
  },
];

const footerLink =
  "rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo size="sm" />
            <p className="mt-5 max-w-[36ch] text-[15px] leading-[1.6] text-muted-foreground">
              Doctor-led health check-ups at home, across Bangalore.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            {FOOTER_LINKS.map((col) => (
              <div key={col.heading}>
                <h3 className="text-sm font-medium text-foreground">{col.heading}</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href.startsWith("#") ? (
                        <a href={l.href} className={footerLink}>
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} className={footerLink}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Nivar is not an emergency service. In an emergency call 112.</p>
          <p>Nivar Health, Bangalore</p>
        </div>
      </Container>
    </footer>
  );
}
