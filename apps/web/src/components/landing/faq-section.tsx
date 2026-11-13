import Image from "next/image";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { FaqAccordion, type FaqItem } from "./faq";
import { buttonClass, CALLBACK_HREF, Container, inr, revealProps, Section, SectionTitle } from "./primitives";
import { WhatsAppIcon, WhatsAppLink, whatsappHref } from "./whatsapp";

/** What "Still unsure?" sends when its door is WhatsApp. */
const QUESTION_MESSAGE = "Hi Nivar, I have a question about a home visit.";

/** Keep each number with its unit ("7 AM", "30 minutes") while the sentence wraps freely. */
const units = (s: string) => s.replace(/(\d) /g, "$1 ");

/** 112 and 108 inside an answer: tappable, with a 44px hit area that leaves the line box alone. */
const TEL_LINK =
  "relative rounded-sm font-semibold whitespace-nowrap text-ink underline underline-offset-[3px] transition-colors duration-180 before:absolute before:-inset-x-2 before:-inset-y-3 focus-ring active:bg-aqua/60 active:duration-90";

/** A sentence with its emergency numbers as tel: links. */
function withCallLinks(sentence: string): ReactNode {
  return sentence.split(/\b(112|108)\b/).map((part, i) =>
    i % 2 ? (
      <a key={i} href={`tel:${part}`} className={TEL_LINK}>
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/**
 * One quiet link under an answer, to the section that carries on from it. A line of its own, 44px tall,
 * pulled into the card's bottom padding so the answer is no taller for it.
 */
function More({ href, children }: { href: `#${string}`; children: ReactNode }) {
  return (
    <p className="mt-1 -mb-2.5">
      <a
        href={href}
        className="inline-flex min-h-11 items-center rounded-sm font-semibold text-primary underline decoration-primary/35 underline-offset-[3px] transition-colors duration-180 hover:decoration-current focus-ring active:bg-aqua/60 active:duration-90"
      >
        {children}
      </a>
    </p>
  );
}

/**
 * The close: the person who answers, and one way to ask them. From lg it sits beside the questions and
 * its button is a plain in-page link to the form, so it works without JS. Below lg the form is the very
 * next thing on the page, so the card shows there only when it opens a different door: WhatsApp, while
 * a number is set (`phone`). The photo is decorative (alt=""): the sentence beside it says who answers.
 * The words drop under the photo when the card is too narrow for both, so nothing pushes the page wide.
 */
function StillUnsure({ className, phone = false }: { className?: string; phone?: boolean }) {
  const wa = phone ? whatsappHref(QUESTION_MESSAGE) : null;
  if (phone && !wa) return null;
  return (
    <div
      className={cn(
        "flex-wrap items-center gap-4 rounded-2xl bg-card p-4 shadow-[0_0_0_1px_rgb(1_58_72/0.06)]",
        phone && "sm:gap-5 sm:px-6 sm:py-5",
        className,
      )}
    >
      <span className="relative size-18 shrink-0 overflow-hidden rounded-full bg-aqua-2">
        <Image src="/img/care-coordinator-1x1.jpg" alt="" fill sizes="72px" className="object-cover" />
      </span>
      <div className={cn("min-w-[10rem] flex-1", phone && "sm:flex sm:items-center sm:gap-6")}>
        <p className={cn("text-small text-balance text-ink-2 sm:text-body", phone && "sm:flex-1")}>
          <span className="font-semibold text-ink">Still unsure?</span>{" "}
          {wa ? "Send us your question on WhatsApp." : "A care coordinator can answer your questions on a call."}
        </p>
        {wa ? (
          <WhatsAppLink href={wa} className={buttonClass("whatsapp", "mt-3 max-w-full sm:mt-0")}>
            <WhatsAppIcon className="size-4.5!" />
            Ask on WhatsApp
          </WhatsAppLink>
        ) : (
          <a href={CALLBACK_HREF} className={buttonClass("secondary", "mt-3 max-w-full")}>
            Request a callback
          </a>
        )}
      </div>
    </div>
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
  const channel = wa ? "on WhatsApp or when we call you" : "when we call you";
  const prices = checkupPrices(fromPrice, completePrice);
  // In the order a family decides: what, where, how quickly, what it costs, then who comes and what follows.
  const items: FaqItem[] = [
    {
      id: "faq-services",
      q: "What can a Nivar nurse do at home?",
      a: (
        <>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-primary/50">
            <li>Injections (into a muscle or a vein) and vaccines, such as B12 or tetanus</li>
            <li>IV drips, as prescribed</li>
            <li>Wound dressings and care after surgery</li>
            <li>Health check-ups, with a heart tracing (ECG) and a digital stethoscope</li>
            <li>Blood samples, collected for our partner lab</li>
          </ul>
          <p className="mt-3">A Nivar doctor joins on video when you need one.</p>
          <More href="#services">See all services</More>
        </>
      ),
    },
    {
      id: "faq-area",
      q: "Where and when do you visit?",
      a: (
        <p>
          Homes in {SITE.area}, {SITE.city}, {units(SITE.hours.inSentence)}. If you are a little further away, ask
          us anyway and we will tell you if we can reach you.
        </p>
      ),
    },
    {
      // Only promises the page already makes: who calls, how quickly, the hours, and a visit at the agreed slot.
      id: "faq-soon",
      q: "How quickly can a nurse come?",
      a: (
        <>
          <p>
            {wa ? "Message us on WhatsApp, or ask us to call you." : "Ask us to call you."} {SITE.firstCall.whoCapital}{" "}
            usually calls back within {units(SITE.callbackWithin)}, {units(SITE.hours.inSentence)}. We tell you the
            next free slot, and your nurse comes at the time you agree.
          </p>
          <More href={CALLBACK_HREF}>Request a callback</More>
        </>
      ),
    },
    {
      id: "faq-cost",
      q: "How much does it cost?",
      a: (
        <>
          <p>
            {prices
              ? `${prices} For injections, drips, dressings and blood tests, we tell you the full price ${channel}, before we confirm.`
              : `We tell you the full price ${channel}, before we confirm.`}{" "}
            There is no travel charge, no surge pricing and no hidden doctor&apos;s fee.
          </p>
          <More href="#check-ups">See check-up prices</More>
        </>
      ),
    },
    {
      id: "faq-pay",
      q: "How do I pay?",
      a: <p>{SITE.payment.faq}</p>,
    },
    {
      id: "faq-prescription",
      q: "Do I need a prescription?",
      a: (
        <p>
          For injections and IV drips, yes: the nurse gives medicines only as a doctor has prescribed them.{" "}
          {wa
            ? "Send us a photo of the prescription on WhatsApp. If you do not have one, our doctor will explain the options when we call you."
            : "Keep the prescription ready when we call you, so our doctor can check it. If you do not have one, our doctor will explain the options."}
        </p>
      ),
    },
    {
      id: "faq-team",
      q: "Who are the nurses and doctors?",
      a: (
        <>
          <p>
            Our nurses are registered with the Karnataka State Nursing Council. Our doctors are MBBS or higher and
            registered with the Karnataka Medical Council. All of them are trained on our devices and protocols
            before their first visit, and the doctor&apos;s name and registration number appear on your report.
          </p>
          <More href="#nurses">Meet your nurse</More>
        </>
      ),
    },
    {
      id: "faq-report",
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
      id: "faq-abnormal",
      q: "What happens if a reading is abnormal?",
      a: (
        <p>
          The doctor sees it as it is recorded and will usually ask the nurse to repeat the measurement. If something
          needs urgent attention, the doctor tells you directly on the video call and explains the next step, including
          a hospital referral if you need one.{" "}
          {/* The site's one emergency sentence, as it reads everywhere else. */}
          {withCallLinks(SITE.emergency.short)}
        </p>
      ),
    },
    {
      id: "faq-data",
      q: "Who can see my health data?",
      a: (
        <p>
          You, and anyone you ask us to share it with. The nurse and doctor looking after your visit and the small
          Nivar care team who arrange it can see it too, and so can our partner lab for blood tests. Readings are
          encrypted when they are sent and when they are stored, kept in India, and never sold or shared with
          insurers or advertisers.
        </p>
      ),
    },
    {
      // No fee is named: none is published (site-facts.ts).
      id: "faq-cancel",
      q: "Can I cancel or reschedule?",
      a: (
        <>
          <p>
            Yes, free of charge until {SITE.cancellationUntil}. After that, a visit fee applies.{" "}
            {wa
              ? "To move your visit, message us on WhatsApp or ask us to call you."
              : "To move your visit, ask us to call you."}
          </p>
          <More href={CALLBACK_HREF}>Request a callback</More>
        </>
      ),
    },
  ];

  return (
    <Section id="faq" tone="aqua" titleId="faq-title">
      <Container>
        {/* 5/7: the title column lines up with the Callback card's title column below. From lg the title
            and the close card stay in view beside the questions. Below lg the form follows the last
            question, so the close card shows only with WhatsApp to offer. */}
        <div className="grid gap-7 sm:gap-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <SectionTitle
                id="faq-title"
                title="Questions, answered plainly."
                lede={"What families usually want to know before a first visit."}
              />
              <StillUnsure className="mt-10 hidden lg:flex" />
            </div>
          </div>
          <div {...revealProps(1)} className="lg:col-span-7">
            <FaqAccordion items={items} />
            <StillUnsure phone className="mt-5 flex lg:hidden" />
          </div>
        </div>
      </Container>
    </Section>
  );
}
