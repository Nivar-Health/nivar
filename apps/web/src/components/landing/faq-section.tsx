import { Container, Section, SectionTitle, inr } from "./primitives";
import { FaqAccordion, type FaqItem } from "./faq";

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
          In most of Bangalore a same-day slot is available within an hour or two of booking, between 7 am and 9 pm.
          You see the live arrival time in the app once the nurse sets off.
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
          needs urgent attention, the doctor tells you directly on the video call and explains the next step.
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
      a: <p>After the visit, in the app, by UPI, card or net banking. You are not charged if the nurse does not arrive.</p>,
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
    <Section id="faq">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <SectionTitle title="Questions," grey="answered plainly." />
          </div>
          <div className="lg:col-span-8">
            <FaqAccordion items={items} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
