import Image from "next/image";
import type { CSSProperties } from "react";
import { Baby, Bandage, Bell, Briefcase, Check, FileText, MapPin, MessageCircle, Video, type LucideIcon } from "lucide-react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { Container, Section, SectionTitle, revealProps } from "./primitives";
import { ContactCtas } from "./whatsapp";

const EVENTS = [
  { icon: MapPin, text: "Priya is on her way", time: "4:12 PM", dateTime: "16:12" },
  { icon: Check, text: "Priya has arrived", time: "4:41 PM", dateTime: "16:41" },
  { icon: Video, text: "Doctor joined on video", time: "5:03 PM", dateTime: "17:03" },
  { icon: FileText, text: "Report sent on WhatsApp", time: "5:27 PM", dateTime: "17:27" },
];

const PARENT_POINTS = [
  { icon: MessageCircle, text: `Message us from wherever you live. We visit their home in ${SITE.area}.` },
  { icon: Bell, text: "Follow the visit live: an update when the nurse sets off, arrives and finishes." },
  { icon: FileText, text: "The visit report comes to you on WhatsApp, as well as to them." },
];

const OTHERS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Bandage,
    title: "Recovering from an injury or surgery",
    text: "Dressings, injections and check-ins without the trip.",
  },
  { icon: Briefcase, title: "Busy professionals", text: `Care before or after work, ${SITE.hours.range}. No half-day off.` },
  { icon: Baby, title: "Families with young children", text: "Vaccines and check-ups at home." },
];

/** "Who it's for": elderly parents first (photo, sample timeline, booking from anywhere), then three more. */
export function WhoItsFor() {
  return (
    <Section id="who-its-for" titleId="who-its-for-title" divider="top">
      <Container>
        <SectionTitle
          id="who-its-for-title"
          title="Who we care for."
          lede="For anyone who would rather not travel, or wait in a queue, for care a nurse can give at home."
        />

        <article
          aria-labelledby="for-parents-title"
          className="mt-12 grid gap-10 overflow-hidden rounded-[2rem] bg-aqua p-5 sm:p-8 lg:mt-16 lg:grid-cols-12 lg:items-center lg:gap-12 lg:p-10"
        >
          <div className="lg:order-2 lg:col-span-5">
            <p className="text-small font-semibold text-primary">Elderly parents</p>
            <h3 id="for-parents-title" className="mt-2 text-h3 text-balance text-ink sm:text-[2rem] sm:leading-[1.15]">
              Book for your parents, from anywhere.
            </h3>
            <p className="mt-3 text-body text-pretty text-ink-2">
              For the days you can&apos;t be there yourself. A Nivar nurse goes to their home, and you follow the visit
              live from wherever you are.
            </p>
            <ul className="mt-7 flex flex-col gap-4">
              {PARENT_POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3.5 text-body text-ink">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-xs">
                    <Icon aria-hidden className="size-[1.125rem]" strokeWidth={2} />
                  </span>
                  <span className="pt-1.5 text-pretty">{text}</span>
                </li>
              ))}
            </ul>
            <ContactCtas
              className="mt-8"
              size="md"
              message="Hi Nivar, I'd like to book a home visit for my parent."
            />
          </div>

          <div className="relative lg:order-1 lg:col-span-7">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-muted shadow-[0_40px_80px_-48px_rgb(1_43_54/0.55)] sm:aspect-[4/3] lg:aspect-[5/4]">
              <Image
                src="/img/bp-cuff.jpg"
                alt="A nurse's hands fitting a blood pressure cuff on an older patient's arm"
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
              />
            </div>

            <div
              {...revealProps(1)}
              className="relative mx-3 -mt-24 rounded-[1.75rem] bg-white p-5 shadow-[0_30px_60px_-30px_rgb(1_43_54/0.5)] ring-1 ring-ink/5 sm:absolute sm:right-6 sm:bottom-6 sm:mx-0 sm:mt-0 sm:w-[340px]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-aqua-2 text-sm font-semibold text-primary">
                    KI
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-ink">Kamala Iyer, 67, HSR Layout</p>
                    <p className="text-caption text-ink-3">Booked by her son, from Pune</p>
                  </div>
                </div>
                <span className="rounded-full bg-aqua px-2.5 py-1 text-xs font-semibold text-primary">Sample</span>
              </div>
              <ol aria-label="Sample visit updates" className="relative mt-4 flex flex-col gap-4">
                <span aria-hidden className="absolute top-4 bottom-4 left-4 w-px bg-border-strong" />
                {EVENTS.map((e, i) => {
                  const last = i === EVENTS.length - 1;
                  return (
                    <li
                      key={e.text}
                      className="tl-step relative flex items-center gap-3.5"
                      style={{ "--step": i } as CSSProperties}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "relative flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                          last ? "bg-primary text-white" : "bg-aqua text-primary",
                        )}
                      >
                        <e.icon className="size-4" strokeWidth={2.25} />
                      </span>
                      <span className={cn("flex-1 text-small", last ? "font-semibold text-ink" : "font-medium text-ink-2")}>
                        {e.text}
                      </span>
                      <time dateTime={e.dateTime} className="text-caption text-ink-3 tabular-nums">
                        {e.time}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </article>

        <ul className="mt-5 grid gap-5 md:grid-cols-3">
          {OTHERS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} {...revealProps(i)} className="flex flex-col rounded-[1.75rem] bg-white p-6 ring-1 ring-border sm:p-7">
              <div className="flex items-center gap-4 md:block">
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-aqua text-primary">
                  <Icon className="size-6" strokeWidth={1.9} />
                </span>
                <h3 className="text-h4 text-balance text-ink md:mt-5">{title}</h3>
              </div>
              <p className="mt-1.5 text-body text-pretty text-ink-2">{text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
