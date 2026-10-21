import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { FaqAccordion, type FaqItem } from "./faq";
import { buttonClass, Container, inr, revealProps, Section, SectionTitle } from "./primitives";
import "./closing.css";

/** "In an emergency, call 112 (or 108 for an ambulance) straight away." built from SITE. */
const EMERGENCY_NOW = `${SITE.emergency.short.replace(/\.$/, "")} straight away.`;

/** "Still unsure? [Ask us to call you]": a plain in-page link, so it works without JS. */
function StillUnsure({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 text-body text-foreground-2", className)}>
      Still unsure?
      <a
        href="#callback"
        className={buttonClass(
          "secondary",
          "duration-180 active:bg-aqua active:duration-90 motion-safe:active:scale-[0.97] motion-reduce:active:scale-100",
        )}
      >
        Ask us to call you
      </a>
    </p>
  );
}

/**
 * "Health check-ups start at ₹449, and the Complete Home Check-up is ₹1,899." Each clause appears only
 * while the catalogue has its price; with neither, the answer opens on the price promise instead.
 */
function checkupPrices(from: number | null, complete: number | null): string | null {
  const completeIs = complete === null ? null : `Complete Home Check-up is ${inr(complete)}`;
  if (from === null) return completeIs && `The ${completeIs}.`;
  return `Health check-ups start at ${inr(from)}${completeIs ? `, and the ${completeIs}` : ""}.`;
}

export function FaqSection({ fromPrice, completePrice }: { fromPrice: number | null; completePrice: number | null }) {
  // The FAQ never names a channel that doesn't exist: WhatsApp only while a number is set (spec §3.8).
  const wa = Boolean(SITE.whatsapp);
  const channel = wa ? "on WhatsApp or on the call" : "on the call";
  const prices = checkupPrices(fromPrice, completePrice);
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
      q: "Do I need a prescription?",
      a: (
        <p>
          For injections and drips, yes: the nurse gives medicines only as a doctor has prescribed them.{" "}
          {wa
            ? "Send us a photo of the prescription on WhatsApp. If you do not have one, our doctor will talk you through the options on the call."
            : "Keep it handy: our doctor checks it on the call. If you do not have one, our doctor will talk you through the options."}
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
      q: "How much does it cost?",
      a: (
        <p>
          {prices
            ? `${prices} For injections, drips, dressings and lab tests, we tell you the full price ${channel} before we confirm.`
            : `We tell you the full price ${channel} before we confirm.`}{" "}
          There is no travel charge, no surge pricing and no hidden consultation fee.
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
          You, and anyone you ask us to share it with. The nurse and doctor looking after your visit and the small
          Nivar care team who arrange it can see it too, and so can our partner lab for blood tests. Readings are
          encrypted in transit and at rest, stored in India, and never sold or shared with insurers or advertisers.
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
          Yes, free of charge until the nurse sets off. After that, a small visit fee applies.{" "}
          {wa
            ? "Message us on WhatsApp, or ask us to call you, to move your visit to another slot."
            : "Ask us to call you to move your visit to another slot."}
        </p>
      ),
    },
  ];

  return (
    <Section id="faq" tone="aqua" titleId="faq-title">
      <Container>
        {/* 5/7: the title column lines up with the Callback card's title column below. From lg the title
            and "Still unsure?" stay in view beside the questions; below lg the close line follows them. */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionTitle
                id="faq-title"
                title="Questions, answered plainly."
                lede="The things families ask us most before a first visit."
              />
              <StillUnsure className="mt-10 hidden lg:flex" />
            </div>
          </div>
          <div {...revealProps(1)} className="lg:col-span-7">
            <FaqAccordion items={items} />
            <StillUnsure className="mt-8 lg:hidden" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
