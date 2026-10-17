import { SITE } from "@/lib/site-facts";
import { BOOK_LABEL, ButtonLink, Container, Section, SectionTitle, bookHref } from "./primitives";
import { VisitJourney, type JourneyStep } from "./visit-journey";

const STEPS: JourneyStep[] = [
  {
    title: "Book in two minutes",
    text: "Choose a programme or a few tests, pick a slot and an address. Same-day slots open every morning.",
    time: "2 min",
  },
  {
    title: "A nurse arrives with the devices",
    text: "A certified Nivar nurse comes with a smart ECG, a digital stethoscope, a BP monitor and a glucometer.",
    time: "About 45 min",
  },
  {
    title: "Your doctor joins live",
    text: "Readings stream to a Nivar doctor as they are taken. She reviews them and speaks with you on video.",
    time: "15 min",
  },
  {
    title: "Report in your app",
    text: "A signed report and prescription, with every reading explained in plain words, lands in the app.",
    time: SITE.report.chip,
  },
];

/** The visit, told as a story that plays itself: the steps on the left, a phone acting each one out. */
export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="aqua" titleId="how-it-works-title">
      <Container>
        <SectionTitle
          id="how-it-works-title"
          title={
            <>
              One visit. <span className="whitespace-nowrap">The whole check-up.</span>
            </>
          }
          lede="Nothing to download before the nurse arrives, nothing to carry to a lab. Here is what happens, from booking to report."
        />

        <div className="mt-12 lg:mt-16">
          <VisitJourney steps={STEPS} />
        </div>

        <div className="mx-auto mt-14 flex max-w-[860px] flex-col items-start gap-4 rounded-[1.75rem] bg-white p-5 pl-6 shadow-[0_18px_40px_-28px_rgb(6_47_45/0.45)] sm:flex-row sm:items-center sm:justify-between lg:mt-16">
          <p className="text-body text-balance text-ink">
            Ready when you are. <span className="whitespace-nowrap">Same-day</span> slots open every morning,{" "}
            <span className="whitespace-nowrap">{SITE.hours.short}</span>.
          </p>
          <ButtonLink href={bookHref()}>{BOOK_LABEL}</ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
