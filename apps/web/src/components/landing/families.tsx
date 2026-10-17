import Image from "next/image";
import type { CSSProperties } from "react";
import { Bell, Check, FileText, MapPin, UserPlus, Users, Video } from "lucide-react";
import { bookingEnabled } from "@/lib/features";
import { cn } from "@/lib/utils";
import { ButtonLink, Container, Section, SectionTitle, bookHref, revealProps } from "./primitives";

const EVENTS = [
  { icon: MapPin, text: "Priya is on her way", time: "4:12 PM", dateTime: "16:12" },
  { icon: Check, text: "Priya has arrived", time: "4:41 PM", dateTime: "16:41" },
  { icon: Video, text: "Dr. Rao is on video", time: "5:03 PM", dateTime: "17:03" },
  { icon: FileText, text: "Report is ready", time: "5:27 PM", dateTime: "17:27" },
];

const POINTS = [
  { icon: UserPlus, text: "Add a parent once, then book in their name whenever they need a check-up." },
  { icon: Bell, text: "Follow the visit from your own phone: you get every update they do." },
  { icon: Users, text: "The report and prescription land in both apps." },
];

export function Families() {
  return (
    <Section id="for-families" tone="warm" titleId="for-families-title">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="lg:order-2 lg:col-span-5">
            <SectionTitle
              id="for-families-title"
              title={"Book for your parents, from anywhere."}
              lede="For the days you can't be there yourself. A Nivar nurse goes to their home, and you watch every step from wherever you are."
            />
            <ul className="mt-8 flex flex-col gap-4">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3.5 text-body text-ink">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-marigold-ink shadow-xs">
                    <Icon aria-hidden className="size-[1.125rem]" strokeWidth={2} />
                  </span>
                  <span className="pt-1.5 text-pretty">{text}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href={bookHref()} size="lg" className="mt-9">
              {bookingEnabled ? "Book for a family member" : "Request a callback"}
            </ButtonLink>
          </div>

          <div className="relative lg:order-1 lg:col-span-7">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-muted shadow-[0_40px_80px_-48px_rgb(6_47_45/0.55)] sm:aspect-[4/3] lg:aspect-[5/4]">
              <Image
                src="/img/bp-cuff.jpg"
                alt="A nurse's hands fitting a blood pressure cuff on an older patient's arm"
                fill
                sizes="(min-width: 1024px) 700px, 100vw"
                className="object-cover"
              />
            </div>

            <div
              {...revealProps(1)}
              className="relative mx-3 -mt-24 rounded-[1.75rem] bg-white p-5 shadow-[0_30px_60px_-30px_rgb(6_47_45/0.5)] ring-1 ring-ink/5 sm:absolute sm:right-6 sm:bottom-6 sm:mx-0 sm:mt-0 sm:w-[340px]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-marigold text-sm font-semibold text-ink">
                    KI
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-ink">Kamala Iyer, 67</p>
                    <p className="text-caption text-ink-3">Booked by her son, in Pune</p>
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
        </div>
      </Container>
    </Section>
  );
}
