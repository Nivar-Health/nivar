import { formatINR } from "@/lib/format";
import { FaqAccordion, type FaqItem } from "./faq";
import { Container, SectionHeading } from "./primitives";

export function FaqSection({ fromPrice, completePrice }: { fromPrice: number; completePrice: number }) {
  const items: FaqItem[] = [
    {
      q: "How much does a home check-up cost?",
      a: (
        <p>
          Packages start at {formatINR(fromPrice)}, and the Complete Home Check-up with ECG, stethoscope and a doctor
          consult is {formatINR(completePrice)}. The price you see covers the nurse visit and the devices. There is no
          separate visit fee and nothing extra to pay at the door.
        </p>
      ),
    },
    {
      q: "Which tests can be done at home?",
      a: (
        <p>
          Blood pressure, blood sugar, heart rate, oxygen saturation (SpO2), a resting ECG on our smart ECG and heart
          and lung sounds on our smart stethoscope, plus a video consult with a Nivar doctor. We do not collect blood
          samples for lab tests yet.
        </p>
      ),
    },
    {
      q: "How quickly can a nurse reach me?",
      a: (
        <p>
          Choose an Express visit and a nurse reaches you within 60 minutes, any day between 7 am and 8 pm. You can
          also pick an hourly slot on a later day. Once she leaves, you can follow her on a live map.
        </p>
      ),
    },
    {
      q: "Is the doctor a real doctor?",
      a: (
        <p>
          Yes. Every Nivar doctor is a registered medical practitioner employed full-time by Nivar, working from our
          clinic. Their name and qualifications are on your report, and they sign every prescription themselves.
        </p>
      ),
    },
    {
      q: "Who can see my health data?",
      a: (
        <p>
          Only you and the care team on your visit. Readings are encrypted in transit and stored securely, and we never
          sell or share your data with advertisers or insurers. You can ask us to delete your records at any time.
        </p>
      ),
    },
    {
      q: "How do I pay?",
      a: <p>Online when you book, with UPI, debit or credit card, or netbanking. You get a receipt in the app.</p>,
    },
    {
      q: "Can I cancel or reschedule?",
      a: (
        <p>
          Yes. Cancel from the app any time before the nurse arrives and you get a full refund to your original payment
          method. To change the time, cancel and book a new slot, or call us and we will move it for you.
        </p>
      ),
    },
    {
      q: "Which areas do you cover?",
      a: (
        <p>
          Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar, JP Nagar, Malleshwaram, BTM Layout, Bellandur
          and Hebbal in Bangalore, with more neighbourhoods and cities coming soon. Not sure about your address?{" "}
          <a href="#callback">Request a callback</a> and we will confirm.
        </p>
      ),
    },
  ];

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHeading
          id="faq-title"
          title="Questions, answered."
          lede="Anything else? Our care team picks up from 7 am to 9 pm."
          className="lg:sticky lg:top-28 lg:self-start"
        />
        <FaqAccordion items={items} />
      </Container>
    </section>
  );
}
