import Image from "next/image";
import {
  Activity,
  Baby,
  BadgeCheck,
  Bandage,
  Bell,
  Briefcase,
  Droplet,
  FileText,
  Gauge,
  MessageCircle,
  PackageCheck,
  PhoneCall,
  ShieldPlus,
  Stethoscope,
  UserRound,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { HealthWords } from "./health-words";
import { Container, Section, SectionTitle, revealProps } from "./primitives";
import { ContactCtas } from "./whatsapp";
import "./your-nurse.css";

/** What stands behind every visit: four facts, each in full view. The ids are deep-link targets. */
const CREDENTIALS: { id: string; icon: LucideIcon; term: string; text: ReactNode }[] = [
  {
    id: "cred-registered",
    icon: BadgeCheck,
    term: "Registered, and trained by us",
    text: "Every Nivar nurse is registered with the Karnataka State Nursing Council and trained on our devices before the first visit.",
  },
  {
    id: "cred-doctor",
    icon: Stethoscope,
    term: "A doctor, a call away",
    // Phones keep to the two facts; from 640px the row has room to say when the doctor joins.
    text: (
      <>
        <span className="sm:hidden">MBBS or higher, registered with the Karnataka Medical Council.</span>
        <span className="max-sm:hidden">
          Our doctors are MBBS or higher and registered with the Karnataka Medical Council. One is reachable during
          every visit and joins on video when you need one.
        </span>{" "}
        Their name and registration number are on your report.
      </>
    ),
  },
  {
    id: "cred-kit",
    icon: PackageCheck,
    term: "Sealed kit, prescribed medicines",
    text: "A new sealed, single-use kit every visit. Medicines only as a doctor has prescribed.",
  },
  {
    id: "cred-plan",
    icon: ShieldPlus,
    term: "A plan if something's wrong",
    // The refund is the promise the payment answer makes (SITE.payment.faq), in the same words.
    text: "If a reading needs urgent attention, the doctor tells you on the call and explains the next step, including a hospital referral. If the nurse does not arrive, we refund you in full.",
  },
];

type Tint = "aqua" | "rose" | "marigold" | "sky";

/** The icon's colour, and from sm its tile (phones list the tools with plain icons). */
const TINT: Record<Tint, string> = {
  aqua: "sm:bg-aqua text-primary",
  rose: "sm:bg-rose-tint text-rose-ink",
  marigold: "sm:bg-marigold-tint text-marigold-ink",
  sky: "sm:bg-sky-tint text-sky-ink",
};

const BAG: { icon: LucideIcon; name: string; caption: string; tint: Tint }[] = [
  { icon: Activity, name: "Smart ECG", caption: "Streams to your doctor as it records", tint: "aqua" },
  { icon: Stethoscope, name: "Digital stethoscope", caption: "Your doctor hears heart and lungs live", tint: "aqua" },
  { icon: Gauge, name: "BP monitor", caption: "Two readings, averaged", tint: "rose" },
  { icon: Droplet, name: "Glucometer", caption: "Fasting, random or after a meal", tint: "marigold" },
  { icon: Wind, name: "Pulse oximeter", caption: "Oxygen and pulse", tint: "sky" },
  { icon: PackageCheck, name: "Sealed kit", caption: "Single-use, for every visit", tint: "aqua" },
];

const KIT_ALT =
  "A nurse's kit laid out on a wooden table: a blood pressure monitor and cuff, pulse oximeter, thermometer, glucometer, handheld ECG, stethoscope, gloves and sealed dressings";

// Like Step 1 and the FAQ, the first point names only a channel that exists: WhatsApp, or the callback.
const PARENT_POINTS: { icon: LucideIcon; text: string }[] = [
  SITE.whatsapp
    ? { icon: MessageCircle, text: `Message us from wherever you live. We visit their home in ${SITE.area}.` }
    : { icon: PhoneCall, text: `Ask us to call you, wherever you live. We visit their home in ${SITE.area}.` },
  { icon: Bell, text: "We update you when the nurse is on the way, arrives and finishes." },
  { icon: FileText, text: "The visit report comes to you on WhatsApp, as well as to them." },
];

const ALSO_FOR: { icon: LucideIcon; text: ReactNode }[] = [
  { icon: Bandage, text: "Recovering from an injury or surgery" },
  {
    icon: Briefcase,
    // The hours wrap as one piece, so "PM" is never left alone on a line.
    text: (
      <>
        Care before or after work, <span className="whitespace-nowrap">{SITE.hours.short}</span>
      </>
    ),
  },
  { icon: Baby, text: "Vaccines and check-ups for children" },
];

type MedicalLead = NonNullable<(typeof SITE)["medicalLead"]>;

/**
 * "Who comes to your home": the nurse at the door (sticky beside the copy on large screens), what
 * stands behind every visit, what is in the nurse's bag, then the panel for families booking for a
 * parent. Aliases: #team at the top; #for-parents and #who-its-for at the parents panel.
 */
export function YourNurse() {
  return (
    <Section id="nurses" titleId="nurses-title">
      <span id="team" aria-hidden className="block scroll-mt-24" />
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-x-12">
          <SectionTitle
            id="nurses-title"
            title="Who comes to your home."
            lede="A registered nurse, and a Nivar doctor behind every visit."
            className="lg:col-span-7 lg:col-start-6 lg:row-start-1"
          />

          <div className="mt-7 sm:mt-10 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-0">
            {/* The cell spans the copy's full height, so the photo stays in view beside it on large screens.
                Its height is capped by the viewport there, so the pinned frame never runs off a short laptop screen.
                On tablets it is a 2:1 band, so the facts under it start on the same screen. */}
            <div className="lg:sticky lg:top-28">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-aqua sm:aspect-[2/1] lg:aspect-[4/5] lg:max-h-[calc(100svh-8.5rem)] lg:w-full lg:rounded-[2rem]">
                <Image
                  src="/img/nurse-arrival.jpg"
                  alt="A Nivar nurse with a teal kit bag is welcomed at an apartment door by an older man"
                  fill
                  sizes="(min-width: 1024px) 480px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 40px)"
                  className="object-cover object-[50%_20%] lg:object-[50%_40%]"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
            <NurseCredentials lead={SITE.medicalLead} className="mt-5 sm:mt-10 lg:mt-12" />

            <div className="mt-6 sm:mt-10 lg:mt-14">
              <h3 id="nurses-bag" className="text-h4 text-ink">
                In the nurse&apos;s bag
              </h3>
              <div className="nv-nurse-kit mt-3 sm:mt-4">
                {/* Below lg only: beside the copy on a desktop the door photo is the picture. */}
                <div className="relative aspect-[3/2] overflow-hidden rounded-[1.25rem] bg-aqua md:max-lg:aspect-auto lg:hidden">
                  <Image
                    src="/img/kit-flatlay.jpg"
                    alt={KIT_ALT}
                    fill
                    sizes="(min-width: 768px) 58vw, (min-width: 640px) calc(100vw - 48px), calc(100vw - 40px)"
                    className="object-cover"
                  />
                </div>
                <ul
                  role="list"
                  aria-labelledby="nurses-bag"
                  {...revealProps(0)}
                  className="nv-nurse-bag mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:mt-4 sm:gap-3 md:mt-0 md:max-lg:grid-cols-1 md:max-lg:content-between md:max-lg:gap-4 xl:grid-cols-3 xl:gap-2.5"
                >
                  {BAG.map(({ icon: Icon, name, caption, tint }) => (
                    <li key={name} className="nv-nurse-tool">
                      <span aria-hidden className={cn("nv-nurse-tool-icon", TINT[tint])}>
                        <Icon strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="nv-nurse-tool-name block text-small leading-snug font-semibold text-ink">{name}</span>
                        {/* From 640px only: on phones the single checks, two sections on, say the same. */}
                        <span className="mt-0.5 block text-[0.875rem] leading-[1.4] text-pretty text-ink-3 max-sm:hidden">
                          {caption}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <HealthWords className="mt-7 sm:mt-10 sm:border-t sm:border-border sm:pt-8 lg:mt-14" />
          </div>
        </div>

        {/* The footer links here (/#for-parents): the margin above is part of the landing position. */}
        <div id="for-parents" className="nv-nurse-parents mt-9 sm:mt-16 lg:mt-24">
          <span id="who-its-for" aria-hidden className="block scroll-mt-24" />
          <ParentsPanel />
        </div>

        {/* One term, three descriptions. Plain words with icons: none of them is a control. */}
        <dl className="nv-nurse-also mt-4 sm:mt-6 lg:mt-8">
          <dt className="nv-nurse-also-term">Also for:</dt>
          {ALSO_FOR.map(({ icon: Icon, text }, i) => (
            <dd key={i} className="nv-nurse-tag">
              <Icon aria-hidden strokeWidth={2} />
              <span>{text}</span>
            </dd>
          ))}
        </dl>
      </Container>
    </Section>
  );
}

/** One row of the list: a heading with its icon, and the text under it (beside it from 640px). */
function Credential({
  id,
  icon: Icon,
  term,
  children,
}: {
  id: string;
  icon: LucideIcon;
  term: string;
  children: ReactNode;
}) {
  return (
    <li id={id} className="nv-nurse-cred">
      <h3 className="nv-nurse-term">
        <Icon aria-hidden strokeWidth={2} />
        {term}
      </h3>
      <div className="nv-nurse-desc">{children}</div>
    </li>
  );
}

/**
 * What stands behind every visit, as hairline rows that read without a tap at every width. The Medical
 * Lead comes first, as the one named person, and only while `SITE.medicalLead` is set.
 * Exported so the Medical Lead row can be checked with sample data.
 */
export function NurseCredentials({ lead, className }: { lead: MedicalLead | null; className?: string }) {
  return (
    <ul role="list" {...revealProps(0)} className={cn("nv-nurse-creds", className)}>
      {lead && (
        <Credential id="cred-lead" icon={UserRound} term="Medical Lead">
          <span className="flex items-center gap-3.5">
            {lead.photo && (
              <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-aqua">
                <Image src={lead.photo} alt="" fill sizes="56px" className="object-cover" />
              </span>
            )}
            <span>
              <span className="block font-semibold text-ink">{lead.name}</span>
              <span className="block text-small text-ink-2">
                {lead.credentials}
                {lead.registration && `. ${lead.registration}`}
              </span>
            </span>
          </span>
          <span className="mt-3 block">{lead.background}</span>
        </Credential>
      )}
      {CREDENTIALS.map(({ id, icon, term, text }) => (
        <Credential key={id} id={id} icon={icon} term={term}>
          {text}
        </Credential>
      ))}
    </ul>
  );
}

/** For families booking from another city. The callback button preselects "A parent" in the form. */
function ParentsPanel() {
  return (
    <article
      id="parents"
      aria-labelledby="parents-title"
      {...revealProps(0)}
      className="grid scroll-mt-24 grid-cols-1 overflow-hidden rounded-[2rem] bg-aqua p-3 sm:p-6 md:grid-cols-12 md:gap-8 lg:gap-12 lg:p-10"
    >
      {/* 4:3 on phones, the whole frame with all three faces. From md the photo sits beside the copy: a
          centred square up to 1099px, which keeps the nurse's face whole, then the full height of the copy.
          The 1100px step is in rem so it sorts after lg: in the built CSS (a px step lands before it). */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-aqua-2 sm:aspect-[16/10] md:col-span-6 md:aspect-square md:self-center lg:min-h-[22rem] lg:rounded-[1.5rem] min-[68.75rem]:aspect-auto min-[68.75rem]:self-stretch xl:col-span-7">
        <Image
          src="/img/nurse-family-call.jpg"
          alt="A Nivar nurse takes notes while an older couple on their sofa video-call their son"
          fill
          sizes="(min-width: 1024px) 680px, (min-width: 768px) 46vw, (min-width: 640px) calc(100vw - 96px), calc(100vw - 64px)"
          className="object-cover object-[67%_50%] sm:object-[60%_45%] md:object-[67%_50%]"
        />
      </div>

      <div className="px-2 pt-3.5 pb-1 sm:pt-8 sm:pb-2 md:col-span-6 md:self-center md:p-0 xl:col-span-5">
        <h3
          id="parents-title"
          className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-ink sm:text-[2rem] sm:leading-[1.15] md:max-lg:text-[1.625rem] md:max-lg:leading-[1.2]"
        >
          Booking for your parents from another city?
        </h3>
        <p className="mt-2 text-small text-ink-2 sm:mt-3 sm:text-body">For the days you can&apos;t be there yourself.</p>
        <ul className="mt-3 flex flex-col gap-2 sm:mt-6 sm:max-w-[36rem] sm:gap-4 md:max-lg:mt-5 md:max-lg:gap-3">
          {PARENT_POINTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 text-small leading-[1.4] text-ink sm:gap-3.5 sm:text-body md:max-lg:text-[1rem] md:max-lg:leading-[1.5]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-xs sm:size-10">
                <Icon aria-hidden className="size-4 sm:size-[1.0625rem]" strokeWidth={2} />
              </span>
              <span className="pt-1.5 text-pretty md:max-lg:pt-2">{text}</span>
            </li>
          ))}
        </ul>
        <ContactCtas
          quiet
          className="mt-4 sm:mt-8 md:max-lg:mt-6"
          buttonClassName="w-full sm:w-auto"
          message="Hi Nivar, I'd like to book a home visit for my parent."
          forWho="A parent"
          need="I'd like to book a home visit for my parent."
          needLabel="A visit for a parent"
        />
      </div>
    </article>
  );
}
