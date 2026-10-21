import { SITE } from "@/lib/site-facts";
import { Container, Section, SectionTitle } from "./primitives";
import { VisitJourney, type JourneyStep } from "./visit-journey";
import { ContactCtas } from "./whatsapp";

/** The four steps of a visit (spec §3.3). Step 1 names WhatsApp only when there is a WhatsApp number. */
export function journeySteps(): JourneyStep[] {
  return [
    {
      title: "Book",
      text: SITE.whatsapp
        ? "Message us on WhatsApp or ask us to call you. Tell us what you need, and send a photo of the prescription if you have one."
        : "Ask us to call you back. Tell us what you need, and keep the prescription handy if you have one.",
      time: "2 min",
    },
    {
      title: "Our doctor calls",
      text: "A Nivar doctor calls to understand what you need and checks the prescription. We tell you the price and a time before we confirm.",
      time: "A short call",
    },
    {
      title: "Your nurse arrives",
      text: "A registered Nivar nurse comes with a sealed, clinic-grade kit and the medicines on your prescription, for an injection, a drip, a dressing, a blood test or a check-up.",
      time: `At your slot, ${SITE.hours.range}`,
    },
    {
      title: "Care done",
      text: "If you need one, a doctor joins on video while the nurse is with you. Your visit report comes on WhatsApp.",
      time: "Report on WhatsApp",
    },
  ];
}

/** How it works: the visit, told as a phone story that plays itself, then a way to start (spec §4.3). */
export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="aqua" titleId="how-it-works-title">
      <Container>
        <SectionTitle
          id="how-it-works-title"
          title={
            <>
              One message. <span className="whitespace-nowrap">Care at home.</span>
            </>
          }
          lede="Nothing to download and nowhere to travel. Here is what happens, from your first message to the report on WhatsApp."
        />

        <div className="mt-6 lg:mt-16">
          <VisitJourney steps={journeySteps()} />
        </div>

        <div className="mx-auto mt-8 flex max-w-[960px] flex-col gap-3 rounded-[1.5rem] bg-white p-4 pl-5 shadow-[0_18px_40px_-32px_rgb(1_43_54/0.45)] sm:mt-10 sm:gap-4 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8 md:pl-8 lg:mt-16">
          <p className="text-body text-balance text-ink">
            Ready when you are. We visit {SITE.area},{" "}
            <span className="whitespace-nowrap">{SITE.hours.short}</span>.
          </p>
          <ContactCtas size="md" className="shrink-0" />
        </div>
      </Container>
    </Section>
  );
}
