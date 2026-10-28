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
import { Disclosure } from "./disclosure";
import { HealthWords } from "./health-words";
import { Container, Section, SectionTitle, revealProps } from "./primitives";
import { ContactCtas } from "./whatsapp";
import "./your-nurse.css";

/** What stands behind every visit. The proof line is what a closed row says on phones. */
const CREDENTIALS: { id: string; icon: LucideIcon; term: string; proof: ReactNode; text: string }[] = [
  {
    id: "cred-registered",
    icon: BadgeCheck,
    term: "Registered, and trained by us",
    proof: "Karnataka State Nursing Council",
    text: "Every Nivar nurse is registered with the Karnataka State Nursing Council and trained on our devices and protocols before the first visit.",
  },
  {
    id: "cred-doctor",
    icon: Stethoscope,
    term: "A doctor, a call away",
    // Where it wraps (360px and below), the council's name stays whole on the second line.
    proof: (
      <>
        MBBS or higher, <span className="whitespace-nowrap">Karnataka Medical Council</span>
      </>
    ),
    text: "Our doctors are MBBS or higher and registered with the Karnataka Medical Council. One is reachable during every visit and joins on video when you need one. Their name and registration number are on your report.",
  },
  {
    id: "cred-kit",
    icon: PackageCheck,
    term: "Sealed kit, prescribed medicines",
    // The prescription rule stays in view while the row is closed (D7).
    proof: "Medicines only as a doctor has prescribed",
    text: "Every visit uses a sealed, single-use kit, and the nurse gives medicines only as a doctor has prescribed them.",
  },
];

/** Never collapsed: what happens when something is wrong. */
const PLAN = {
  icon: ShieldPlus,
  term: "A plan if something's wrong",
  text: "If a reading needs urgent attention, the doctor tells you on the call and explains the next step, including a hospital referral.",
};

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
  { icon: Bell, text: "Follow the visit live: an update when the nurse sets off, arrives and finishes." },
  { icon: FileText, text: "The visit report comes to you on WhatsApp, as well as to them." },
];

const ALSO_FOR: { icon: LucideIcon; text: string }[] = [
  { icon: Bandage, text: "Recovering from an injury or surgery" },
  { icon: Briefcase, text: `Care before or after work, ${SITE.hours.short}` },
  { icon: Baby, text: "Vaccines and check-ups for children" },
];

type MedicalLead = NonNullable<(typeof SITE)["medicalLead"]>;

/**
 * "Who comes to your home": the nurse at the door (sticky beside the copy on large screens), what
 * stands behind every visit, what is in the nurse's bag, then the panel for families booking for a
 * parent. Aliases: #team at the top, #who-its-for at the parents panel.
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

          <div className="mt-5 sm:mt-10 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-0">
            {/* The cell spans the copy's full height, so the photo stays in view beside it on large screens.
                Its height is capped by the viewport there, so the pinned frame never runs off a short laptop screen. */}
            <div className="lg:sticky lg:top-28">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-aqua lg:aspect-[4/5] lg:max-h-[calc(100svh-8.5rem)] lg:w-full lg:rounded-[2rem]">
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
              {/* Below lg only: the 1440 page has no room for it (spec §6). */}
              <div className="relative mt-3 aspect-[3/2] overflow-hidden rounded-[1.25rem] bg-aqua sm:mt-4 lg:hidden">
                <Image
                  src="/img/kit-flatlay.jpg"
                  alt={KIT_ALT}
                  fill
                  sizes="(min-width: 640px) calc(100vw - 48px), calc(100vw - 40px)"
                  className="object-cover"
                />
              </div>
              <ul
                role="list"
                aria-labelledby="nurses-bag"
                {...revealProps(0)}
                className="nv-nurse-bag mt-3.5 grid grid-cols-2 gap-x-3 gap-y-3 sm:mt-4 sm:gap-3 xl:grid-cols-3 xl:gap-2.5"
              >
                {BAG.map(({ icon: Icon, name, caption, tint }) => (
                  <li key={name} className="nv-nurse-tool">
                    <span aria-hidden className={cn("nv-nurse-tool-icon", TINT[tint])}>
                      <Icon strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="nv-nurse-tool-name block text-[0.9375rem] leading-snug font-semibold text-ink">
                        {name}
                      </span>
                      <span className="nv-nurse-tool-caption mt-0.5 block text-caption text-pretty text-ink-3">{caption}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <HealthWords className="nv-nurse-words mt-6 sm:mt-10 sm:border-t sm:border-border sm:pt-8 lg:mt-14" />
          </div>
        </div>

        <div className="mt-9 sm:mt-16 lg:mt-24">
          <span id="who-its-for" aria-hidden className="block scroll-mt-24" />
          <ParentsPanel />
        </div>

        {/* One term, three descriptions. Plain words with icons: none of them is a control. */}
        <dl className="nv-nurse-also mt-4 sm:mt-6 lg:mt-8">
          <dt className="nv-nurse-also-term">Also for:</dt>
          {ALSO_FOR.map(({ icon: Icon, text }) => (
            <dd key={text} className="nv-nurse-tag">
              <Icon aria-hidden strokeWidth={2} />
              {text}
            </dd>
          ))}
        </dl>
      </Container>
    </Section>
  );
}

/** A credential that never collapses (and the Medical Lead): the same row as a disclosure's, always open. */
function OpenCredential({ icon: Icon, term, children }: { icon: LucideIcon; term: string; children: ReactNode }) {
  return (
    <div className="nv-nurse-open">
      <h3 className="nv-nurse-term">
        <Icon aria-hidden strokeWidth={2} />
        {term}
      </h3>
      <div className="nv-nurse-desc">{children}</div>
    </div>
  );
}

/**
 * What stands behind every visit, as hairline rows. On phones the first three are drop-downs whose proof
 * line reads while closed; from 640px every row reads as a heading and its text (render-once heads, spec
 * §1.10). The plan and the Medical Lead row (only while `SITE.medicalLead` is set) never collapse.
 * Exported so the Medical Lead row can be checked with sample data.
 */
export function NurseCredentials({ lead, className }: { lead: MedicalLead | null; className?: string }) {
  return (
    <ul role="list" {...revealProps(0)} className={cn("nv-disc-group nv-nurse-creds", className)}>
      {CREDENTIALS.map(({ id, icon: Icon, term, proof, text }) => (
        <li key={id}>
          <Disclosure
            id={id}
            collapse="phone"
            leadSize="icon"
            lead={<Icon strokeWidth={2} />}
            title={term}
            meta={proof}
            head={
              <h3 className="nv-nurse-term">
                <Icon aria-hidden strokeWidth={2} />
                {term}
              </h3>
            }
            bodyClassName="nv-nurse-desc"
          >
            {text}
          </Disclosure>
        </li>
      ))}
      <li>
        <OpenCredential icon={PLAN.icon} term={PLAN.term}>
          {PLAN.text}
        </OpenCredential>
      </li>
      {lead && (
        <li>
          <OpenCredential icon={UserRound} term="Medical Lead">
            <span className="flex items-center gap-3.5">
              {lead.photo && (
                <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-aqua">
                  <Image src={lead.photo} alt="" fill sizes="56px" className="object-cover" />
                </span>
              )}
              <span>
                <span className="block font-semibold text-ink">{lead.name}</span>
                <span className="block text-caption text-ink-3">
                  {lead.credentials}
                  {lead.registration && `. ${lead.registration}`}
                </span>
              </span>
            </span>
            <span className="mt-3 block">{lead.background}</span>
          </OpenCredential>
        </li>
      )}
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
      className="grid scroll-mt-24 grid-cols-1 overflow-hidden rounded-[2rem] bg-aqua p-3 sm:p-6 lg:grid-cols-12 lg:gap-12 lg:p-10"
    >
      {/* 4:3 on phones, the whole frame with all three faces. From lg the photo fills the height of the copy
          beside it, except at 1024–1099, where a centred square keeps the nurse's face whole (desktop-03). The
          1100px step is in rem so it sorts after lg: in the built CSS (a px step lands before it). */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-aqua-2 sm:aspect-[16/10] lg:col-span-6 lg:aspect-square lg:min-h-[22rem] lg:self-center lg:rounded-[1.5rem] min-[68.75rem]:aspect-auto min-[68.75rem]:self-stretch xl:col-span-7">
        <Image
          src="/img/nurse-family-call.jpg"
          alt="A Nivar nurse takes notes while an older couple on their sofa video-call their son"
          fill
          sizes="(min-width: 1024px) 680px, (min-width: 640px) calc(100vw - 96px), calc(100vw - 64px)"
          className="object-cover object-[67%_50%] sm:object-[60%_45%] lg:object-[67%_50%]"
        />
      </div>

      <div className="px-2 pt-3.5 pb-1 sm:pt-8 sm:pb-2 lg:col-span-6 lg:self-center lg:p-0 xl:col-span-5">
        <h3
          id="parents-title"
          className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-ink sm:text-[2rem] sm:leading-[1.15]"
        >
          Booking for your parents from another city?
        </h3>
        {/* Balanced: on two lines it breaks between its sentences. */}
        <p className="mt-2 text-small text-balance text-ink-2 sm:mt-3 sm:max-w-[36rem] sm:text-body">
          For the days you can&apos;t be there yourself. A Nivar nurse goes to their home.
        </p>
        <ul className="mt-3 flex flex-col gap-2 sm:mt-6 sm:max-w-[36rem] sm:gap-4">
          {PARENT_POINTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 text-[0.9375rem] leading-[1.4] text-ink sm:gap-3.5 sm:text-body"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-xs sm:size-10">
                <Icon aria-hidden className="size-4 sm:size-[1.0625rem]" strokeWidth={2} />
              </span>
              <span className="pt-1.5 text-pretty sm:pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
        <ContactCtas
          quiet
          className="mt-4 sm:mt-8"
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
