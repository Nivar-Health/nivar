import Link from "next/link";
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
      q: "What can a Nivar nurse do at home?",
      a: (
        <p>
          Injections and vaccines (IM, IV, B12, tetanus), IV drips as prescribed, wound dressings and post-surgery
          care, health check-ups with a smart ECG and digital stethoscope, and blood sample collection for a partner
          lab. A Nivar doctor joins on video when you need one.
        </p>
      ),
    },
    {
      q: "Where and when do you visit?",
      a: (
        <p>
          Homes in {SITE.area}, {SITE.city}, {SITE.hours.inSentence}. If you are a little further away, ask us
          anyway and we will tell you if we can reach you.
        </p>
      ),
    },
    {
      q: "How much does it cost?",
      a: (
        <p>
          Health check-ups start at {inr(fromPrice)}, and the Complete Home Check-up is {inr(completePrice)}. For
          injections, drips, dressings and lab tests, we tell you the full price on WhatsApp or on the call before we
          confirm. There is no travel charge, no surge pricing and no hidden consultation fee.
        </p>
      ),
    },
    {
      q: "Do I need a prescription?",
      a: (
        <p>
          For injections and drips, yes: the nurse gives medicines only as a doctor has prescribed them. Send us a
          photo of the prescription on WhatsApp. If you do not have one, our doctor will talk you through the options
          on the call.
        </p>
      ),
    },
    {
      q: "When do I get my report?",
      a: (
        <p>
          After the visit, {SITE.report.channel}. For a check-up it is {SITE.report.checkup}: your Nivar doctor
          reviews every reading, explains it in plain words and adds a prescription if you need one. If you booked
          for a family member, we can send it to them too.
        </p>
      ),
    },
    {
      q: "Who are the nurses and doctors?",
      a: (
        <p>
          Our nurses are registered with the Karnataka State Nursing Council. Our doctors are MBBS or higher and
          registered with the Karnataka Medical Council. All of them are trained on our devices and protocols before
          their first visit, and the doctor&apos;s name and registration number appear on your report.
        </p>
      ),
    },
    {
      q: "What happens if a reading is abnormal?",
      a: (
        <p>
          The doctor sees it as it is recorded and will usually ask the nurse to repeat the measurement. If something
          needs urgent attention, the doctor tells you directly on the video call and explains the next step, including
          a hospital referral if you need one. {EMERGENCY_NOW}
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
          Yes, free of charge until the nurse sets off. After that, a small visit fee applies. Message us on WhatsApp,
          or ask us to call you, to move your visit to another slot.
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
              <Link
                href="/#callback"
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline decoration-border-strong underline-offset-4 hover:decoration-current focus-ring",
                  ARROW_NUDGE,
                )}
              >
                Ask us to call you
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
