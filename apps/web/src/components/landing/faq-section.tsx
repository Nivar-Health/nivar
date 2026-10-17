import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { FaqAccordion, type FaqItem } from "./faq";
import { ARROW_NUDGE, Container, inr, revealProps, Section, SectionTitle } from "./primitives";

/** "In an emergency, call 112 (or 108 for an ambulance) straight away." built from SITE. */
const EMERGENCY_NOW = `${SITE.emergency.short.replace(/\.$/, "")} straight away.`;

export function FaqSection({ fromPrice, completePrice }: { fromPrice: number; completePrice: number }) {
  const items: FaqItem[] = [
    {
      q: "How much does a home check-up cost?",
      a: (
        <p>
          Programmes start at {inr(fromPrice)} and the Complete Home Check-up is {inr(completePrice)}. The price
          covers the nurse visit, the devices, the doctor consult and the report. There is no travel charge and
          no separate consultation fee.
        </p>
      ),
    },
    {
      q: "Which tests can be done at home?",
      a: (
        <p>
          Blood pressure, blood sugar, heart rate, oxygen saturation, a resting smart ECG and digital auscultation
          of the heart and lungs. Anything that needs a lab, such as a blood panel, is not part of a Nivar visit yet.
        </p>
      ),
    },
    {
      q: "How quickly can a nurse reach me?",
      a: (
        <p>
          In most of {SITE.city} a same-day slot is available within an hour or two of booking, {SITE.hours.inSentence}.
          You see the live arrival time in the app once the nurse sets off.
        </p>
      ),
    },
    {
      q: "How soon do I get my report?",
      a: (
        <p>
          {SITE.report.chip} of the visit. Your Nivar doctor signs it, explains every reading in plain words and adds
          a prescription if you need one. It lands in the app, and in your family member&apos;s app if you booked for
          them.
        </p>
      ),
    },
    {
      q: "Is the doctor a real, registered doctor?",
      a: (
        <p>
          Yes. Every Nivar doctor is MBBS or higher, registered with the Karnataka Medical Council and employed
          full-time by Nivar. Their name and registration number appear on your report.
        </p>
      ),
    },
    {
      q: "What happens if a reading is abnormal?",
      a: (
        <p>
          The doctor sees it as it is recorded and will usually ask the nurse to repeat the measurement. If something
          needs urgent attention, the doctor tells you directly on the video call and explains the next step.{" "}
          {EMERGENCY_NOW}
        </p>
      ),
    },
    {
      q: "Who can see my health data?",
      a: (
        <p>
          You, the nurse during the visit, and the Nivar doctor reviewing it. Readings are encrypted in transit and
          at rest, stored in India, and never sold or shared with insurers or advertisers.
        </p>
      ),
    },
    {
      q: "How do I pay?",
      a: <p>{SITE.payment.faq}</p>,
    },
    {
      q: "Can I cancel or reschedule?",
      a: (
        <p>
          Yes, free of charge until the nurse starts travelling to you. After that, a small visit fee applies. You can
          move a booking to any open slot from the app.
        </p>
      ),
    },
  ];

  return (
    <Section id="faq" tone="aqua" titleId="faq-title">
      <Container>
        {/* 5/7, not the spec's 4/8: at 4 columns the accent ("answered plainly.", 339-375px) is wider than the
            column (299-373px) at every lg width, so it always broke as "answered / plainly.". 5 columns keeps it
            on one line and lines the title column up with the Callback section's title column below. */}
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionTitle
              id="faq-title"
              title="Questions, answered plainly."
              lede="The things families ask us most before a first visit."
            />
          </div>
          <div {...revealProps(1)} className="lg:col-span-7">
            <FaqAccordion items={items} />
            <p className="mt-8 text-body text-foreground-2">
              Still unsure?{" "}
              <a
                href="#callback"
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline decoration-border-strong underline-offset-4 hover:decoration-current focus-ring",
                  ARROW_NUDGE,
                )}
              >
                Ask us to call you
                <ArrowRight aria-hidden className="size-4" />
              </a>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
