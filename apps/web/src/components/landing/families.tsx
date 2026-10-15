import Image from "next/image";
import { Check, FileText, MapPin, Video } from "lucide-react";
import { bookingEnabled } from "@/lib/features";
import { ButtonLink, Container, IconTile, Section, SectionTitle, bookHref } from "./primitives";

const EVENTS = [
  { icon: MapPin, text: "Priya is on her way", time: "4:12 PM" },
  { icon: Check, text: "Priya has arrived", time: "4:41 PM" },
  { icon: Video, text: "Dr. Rao is on video", time: "5:03 PM" },
  { icon: FileText, text: "Report is ready", time: "5:27 PM" },
];

export function Families() {
  return (
    <Section id="for-families">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-5 lg:order-2">
            <SectionTitle
              title="Book for your parents,"
              grey="from anywhere."
              lede="Add a family member, book in their name and follow the visit from your own phone. You get every update they do, and the report lands in both apps."
            />
            <ButtonLink href={bookHref()} className="mt-8">
              {bookingEnabled ? "Book for a family member" : "Request a callback"}
            </ButtonLink>
          </div>

          <div className="relative lg:col-span-7 lg:order-1">
            <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-muted sm:aspect-[4/3] lg:aspect-[5/4]">
              <Image
                src="/img/bp-cuff.jpg"
                alt="A nurse's hands fitting a blood pressure cuff on an older patient's arm"
                fill
                sizes="(min-width: 1024px) 700px, 100vw"
                className="object-cover"
              />
            </div>
            <ol className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background shadow-[0_18px_50px_-24px_rgb(0_0_0/0.3)] sm:absolute sm:right-6 sm:bottom-6 sm:mt-0 sm:w-[320px]">
              {EVENTS.map((e) => (
                <li key={e.text} className="flex items-center gap-3.5 px-4 py-3">
                  <IconTile className="size-8 rounded-[8px]">
                    <e.icon strokeWidth={2} />
                  </IconTile>
                  <span className="flex-1 text-sm font-medium">{e.text}</span>
                  <time className="text-xs text-muted-foreground tabular-nums">{e.time}</time>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </Section>
  );
}
