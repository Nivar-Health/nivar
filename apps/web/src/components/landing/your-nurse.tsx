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
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { HealthWords } from "./health-words";
import { Container, Section, SectionTitle, revealProps } from "./primitives";
import { SnapRow } from "./snap-row";
import { ContactCtas } from "./whatsapp";
import "./your-nurse.css";

const CREDENTIALS: { icon: LucideIcon; term: string; text: string }[] = [
  {
    icon: BadgeCheck,
    term: "Registered, and trained by us",
    text: "Every Nivar nurse is registered with the Karnataka State Nursing Council and trained on our devices and protocols before the first visit.",
  },
  {
    icon: Stethoscope,
    term: "A doctor, a call away",
    text: "Our doctors are MBBS or higher and registered with the Karnataka Medical Council. One is reachable during every visit and joins on video when you need one. Their name and registration number are on your report.",
  },
  {
    icon: PackageCheck,
    term: "Sealed kit, prescribed medicines",
    text: "Every visit uses a sealed, single-use kit, and the nurse gives medicines only as a doctor has prescribed them.",
  },
  {
    icon: ShieldPlus,
    term: "A plan if something's wrong",
    text: "If a reading needs urgent attention, the doctor tells you on the call and explains the next step, including a hospital referral.",
  },
];

type Tint = "aqua" | "rose" | "marigold" | "sky";

const TINT: Record<Tint, string> = {
  aqua: "bg-aqua text-primary",
  rose: "bg-rose-tint text-rose-ink",
  marigold: "bg-marigold-tint text-marigold-ink",
  sky: "bg-sky-tint text-sky-ink",
};

const BAG: { icon: LucideIcon; name: string; caption: string; tint: Tint }[] = [
  { icon: Activity, name: "Smart ECG", caption: "Streams to your doctor as it records", tint: "aqua" },
  { icon: Stethoscope, name: "Digital stethoscope", caption: "Your doctor hears heart and lungs live", tint: "aqua" },
  { icon: Gauge, name: "BP monitor", caption: "Two readings, averaged", tint: "rose" },
  { icon: Droplet, name: "Glucometer", caption: "Fasting, random or after a meal", tint: "marigold" },
  { icon: Wind, name: "Pulse oximeter", caption: "Oxygen and pulse", tint: "sky" },
  { icon: PackageCheck, name: "Sealed kit", caption: "Single-use, for every visit", tint: "aqua" },
];

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
 * stands behind every visit, what is in her bag, then the panel for families booking for a parent.
 * Aliases: #team at the top, #who-its-for at the parents panel.
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
            lede="A registered nurse, trained on our devices and protocols before the first visit, with a Nivar doctor reachable throughout."
            className="lg:col-span-7 lg:col-start-6 lg:row-start-1"
          />

          <div className="mt-5 sm:mt-10 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-0">
            {/* The cell spans the copy's full height, so the photo stays in view beside it on large screens. */}
            <div className="lg:sticky lg:top-28">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-aqua lg:aspect-[4/5] lg:rounded-[2rem]">
                <Image
                  src="/img/nurse-arrival.jpg"
                  alt="A Nivar nurse with a teal kit bag is welcomed at an apartment door by an older man"
                  fill
                  sizes="(min-width: 1024px) 480px, 100vw"
                  className="object-cover object-[50%_20%] lg:object-[50%_40%]"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
            <NurseCredentials lead={SITE.medicalLead} className="mt-5 sm:mt-10 lg:mt-12" />

            <div className="mt-6 sm:mt-10 lg:mt-14">
              <h3 className="text-h4 text-ink">In the nurse&apos;s bag</h3>
              <SnapRow
                label="In the nurse's bag"
                gridFrom="sm"
                gridClassName="sm:grid-cols-2 xl:grid-cols-3 xl:gap-2.5"
                itemClassName="basis-[70%]"
                snapStop="normal"
                className="mt-3 sm:mt-4"
              >
                {BAG.map(({ icon: Icon, name, caption, tint }) => (
                  <div key={name} className="nv-nurse-tool">
                    <span aria-hidden className={cn("nv-nurse-tool-icon", TINT[tint])}>
                      <Icon strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="nv-nurse-tool-name block text-[0.9375rem] leading-snug font-semibold text-ink">
                        {name}
                      </span>
                      <span className="mt-0.5 block text-caption text-pretty text-ink-3">{caption}</span>
                    </span>
                  </div>
                ))}
              </SnapRow>
            </div>

            <HealthWords className="mt-6 sm:mt-10 sm:border-t sm:border-border sm:pt-8 lg:mt-14" />
          </div>
        </div>

        <div className="mt-9 sm:mt-16 lg:mt-24">
          <span id="who-its-for" aria-hidden className="block scroll-mt-24" />
          <ParentsPanel />
        </div>

        {/* One term, three descriptions: the label shares a row with the first tag whenever it fits. */}
        <dl className="mt-4 flex flex-wrap items-center gap-2 sm:mt-6 lg:mt-8">
          <dt className="text-[0.875rem] font-semibold text-ink sm:mr-1 sm:text-small">Also for:</dt>
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

/**
 * What stands behind every visit, as a definition list with hairlines. The Medical Lead row shows only
 * while `SITE.medicalLead` is set. Exported so the row can be checked with sample data.
 */
export function NurseCredentials({ lead, className }: { lead: MedicalLead | null; className?: string }) {
  return (
    <dl {...revealProps(0)} className={className}>
      {CREDENTIALS.map(({ icon: Icon, term, text }) => (
        <div key={term} className="nv-nurse-cred">
          <dt className="nv-nurse-term">
            <Icon aria-hidden strokeWidth={2} />
            {term}
          </dt>
          <dd className="nv-nurse-desc">{text}</dd>
        </div>
      ))}
      {lead && (
        <div className="nv-nurse-cred">
          <dt className="nv-nurse-term">
            <UserRound aria-hidden strokeWidth={2} />
            Medical Lead
          </dt>
          <dd className="nv-nurse-desc">
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
          </dd>
        </div>
      )}
    </dl>
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
      {/* From lg the photo fills the height of the copy beside it (about 4:3 from xl). */}
      <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-aqua-2 sm:aspect-[16/10] lg:col-span-6 lg:aspect-auto lg:min-h-[22rem] lg:rounded-[1.5rem] xl:col-span-7">
        <Image
          src="/img/nurse-family-call.jpg"
          alt="A Nivar nurse takes notes while an older couple on their sofa video-call their son"
          fill
          sizes="(min-width: 1024px) 680px, 100vw"
          className="object-cover object-[67%_50%] sm:object-[60%_45%] lg:object-[67%_50%]"
        />
      </div>

      <div className="px-2 pt-4 pb-1 sm:pt-8 sm:pb-2 lg:col-span-6 lg:self-center lg:p-0 xl:col-span-5">
        <h3
          id="parents-title"
          className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-ink sm:text-[2rem] sm:leading-[1.15]"
        >
          Booking for your parents from another city?
        </h3>
        <p className="mt-2 text-small text-pretty text-ink-2 sm:mt-3 sm:text-body">
          For the days you can&apos;t be there yourself. A Nivar nurse goes to their home, and you follow the visit live
          from wherever you are.
        </p>
        <ul className="mt-3.5 flex flex-col gap-2.5 sm:mt-6 sm:gap-4">
          {PARENT_POINTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 text-[0.875rem] leading-[1.45] text-ink sm:gap-3.5 sm:text-body"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-xs sm:size-10">
                <Icon aria-hidden className="size-4 sm:size-[1.0625rem]" strokeWidth={2} />
              </span>
              <span className="pt-1.5 text-pretty sm:pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
        <ContactCtas
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
