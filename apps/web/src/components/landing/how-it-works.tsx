import Link from "next/link";
import { ArrowRight, DoorOpen, MessageCircle, PhoneCall, Video, type LucideIcon } from "lucide-react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { ARROW_NUDGE, ButtonLink, Container, LiveDot, Section, SectionTitle, revealProps } from "./primitives";
import { VisitJourney, type JourneyStep } from "./visit-journey";
import { ContactCtas } from "./whatsapp";

/** The four steps, one line each (home page). The full page tells each one in detail. */
const SHORT_STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MessageCircle, title: "Book", text: "WhatsApp, call or request a callback." },
  { icon: PhoneCall, title: "Doctor calls", text: "Our doctor understands what you need." },
  { icon: DoorOpen, title: "Nurse arrives", text: "With a clinic-grade kit and medicines." },
  {
    icon: Video,
    title: "Care done",
    text: `A doctor joins on video if needed, and your report comes ${SITE.report.channel}.`,
  },
];

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    title: "Book",
    text: "Message us on WhatsApp, call, or ask for a callback. Tell us what you need, and send a photo of the prescription if you have one.",
    time: "2 min",
  },
  {
    title: "Our doctor calls",
    text: "A Nivar doctor calls to understand what you need and checks the prescription. We tell you the price and a time before we confirm.",
    time: "A short call",
  },
  {
    title: "A nurse arrives",
    text: "A registered Nivar nurse comes with a sealed, clinic-grade kit and the medicines on your prescription, for injections, drips, dressings, tests or a check-up.",
    time: `At your slot, ${SITE.hours.range}`,
  },
  {
    title: "Care done",
    text: "If you need one, a doctor joins on video while the nurse is with you. Your visit report comes on WhatsApp.",
    time: "Report on WhatsApp",
  },
];

/** Home page: four steps, one line each, a line about live readings and the way to the full page. */
export function HowItWorksShort() {
  return (
    <Section id="how-it-works" tone="aqua" titleId="how-it-works-title">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle
            id="how-it-works-title"
            title="How it works."
            lede="Four steps, from your first message to the report on WhatsApp."
          />
          <ButtonLink href="/how-it-works" variant="secondary" className={cn("w-fit", ARROW_NUDGE)}>
            See how it works
            <ArrowRight aria-hidden />
          </ButtonLink>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {SHORT_STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} {...revealProps(i)} className="flex flex-col rounded-[1.5rem] bg-white p-5 shadow-[0_18px_36px_-30px_rgb(1_43_54/0.5)] sm:p-6">
              <div className="flex items-center justify-between">
                <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className="text-small font-semibold text-ink-3">Step {i + 1}</span>
              </div>
              <h3 className="mt-5 text-h4 text-ink">{title}</h3>
              <p className="mt-1.5 text-small text-pretty text-ink-2">{text}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-body text-ink-2">
          <span className="inline-flex items-center gap-2.5">
            <LiveDot pulse className="size-2 text-signal-ink" />
            Readings reach your doctor while you&apos;re still on the sofa.
          </span>
          <Link
            href="/how-it-works#live"
            className={cn(
              "inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline decoration-border-strong underline-offset-4 hover:decoration-current focus-ring",
              ARROW_NUDGE,
            )}
          >
            See the live demo
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      </Container>
    </Section>
  );
}

/** How it works page: the visit, told as a story that plays itself, then a way to start. */
export function HowItWorksSteps() {
  return (
    <Section id="steps" tone="aqua" titleId="steps-title" className="pt-32 lg:pt-40">
      <Container>
        <SectionTitle
          as="h1"
          id="steps-title"
          title={
            <>
              One message. <span className="whitespace-nowrap">Care at home.</span>
            </>
          }
          lede="Nothing to download and nowhere to travel. Here is what happens, from your first message to the report on WhatsApp."
        />

        <div className="mt-12 lg:mt-16">
          <VisitJourney steps={JOURNEY_STEPS} />
        </div>

        <div className="mx-auto mt-14 flex max-w-[960px] flex-col items-start gap-5 rounded-[1.75rem] bg-white p-5 pl-6 shadow-[0_18px_40px_-28px_rgb(1_43_54/0.45)] md:flex-row md:items-center md:justify-between lg:mt-16">
          <p className="text-body text-balance text-ink">
            Ready when you are. We visit {SITE.area},{" "}
            <span className="whitespace-nowrap">{SITE.hours.short}</span>.
          </p>
          <ContactCtas size="md" />
        </div>
      </Container>
    </Section>
  );
}
