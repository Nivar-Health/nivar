import { SITE } from "@/lib/site-facts";
import { Container, Section, SectionTitle } from "./primitives";
import { VisitJourney, type JourneyStep } from "./visit-journey";
import { ContactCtas } from "./whatsapp";

/** Keep each number with its unit ("7 AM", "30 minutes") while the sentence wraps freely. */
const units = (s: string) => s.replace(/(\d) /g, "$1\u00a0");

/**
 * The four steps of a visit. Step 1 names WhatsApp only when there is a WhatsApp number. Step 2 names the
 * first caller, the callback time and the hours from site-facts, so it agrees with the hero and the form;
 * the hours make the promise true at any time of day.
 */
export function journeySteps(): JourneyStep[] {
  return [
    {
      title: "Tell us what you need",
      text: SITE.whatsapp
        ? "Message us on WhatsApp or ask us to call you, and send a photo of the prescription if you have one."
        : "Ask us to call you back, and keep the prescription ready if you have one.",
      time: "2 min",
    },
    {
      title: `${SITE.firstCall.whoCapital} calls`,
      text: `The call usually comes within ${units(SITE.callbackWithin)}, ${units(SITE.hours.inSentence)}. A Nivar doctor checks the prescription, and we tell you the price and a time before we confirm.`,
      time: "A short call",
    },
    {
      title: "Your nurse arrives",
      text: "A registered Nivar nurse comes with a sealed, single-use kit and the medicines on your prescription. If you need one, a Nivar doctor joins on video.",
      time: `At your slot, ${units(SITE.hours.short)}`,
    },
    {
      title: "Your report",
      text: `Your visit report comes ${SITE.report.channel}. If you booked for a family member, we can send it to them too.`,
      time: "After the visit",
    },
  ];
}

/**
 * How it works: the four steps of a visit (a timeline on phones; from md a list beside a phone that acts
 * them out), then a way to start. The strip's button stays quiet: the page's one accent action is already
 * on screen, in the bar on phones and in the top pill from sm.
 */
export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="aqua" titleId="how-it-works-title">
      <Container>
        <SectionTitle
          id="how-it-works-title"
          title={
            <>
              {SITE.whatsapp ? "One message." : "One request."} <span className="whitespace-nowrap">Care at home.</span>
            </>
          }
          lede="Nothing to download, nowhere to travel. Here is what happens after you ask."
        />

        <div className="mt-8 md:mt-10 lg:mt-16">
          <VisitJourney steps={journeySteps()} />
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-[1.5rem] bg-white p-5 shadow-[0_18px_40px_-32px_rgb(1_43_54/0.45)] sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8 md:pl-8 lg:mt-16">
          <p className="text-body text-balance text-ink">
            Ready when you are. We visit {SITE.area},{" "}
            <span className="whitespace-nowrap">{SITE.hours.short}</span>.
          </p>
          <ContactCtas quiet className="shrink-0" buttonClassName="max-sm:w-full" />
        </div>
      </Container>
    </Section>
  );
}
