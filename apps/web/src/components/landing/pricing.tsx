import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Car,
  Droplet,
  FileText,
  Gauge,
  HeartPulse,
  PhoneCall,
  Stethoscope,
  Undo2,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { SITE } from "@/lib/site-facts";
import type { Package, Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BOOK_LABEL, ButtonLink, Container, ROW_CTA_LABEL, Section, SectionTitle, bookHref, inr, revealProps } from "./primitives";

const INCLUDED: { icon: LucideIcon; text: string }[] = [
  { icon: Car, text: "No travel charge" },
  { icon: Video, text: "No separate consultation fee" },
  { icon: FileText, text: "A signed report and prescription" },
  { icon: Undo2, text: SITE.cancellation },
];

/** Catalog `icon` names mapped to an icon and a tint. Unknown names fall back to a pulse on aqua. */
const TEST_LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  gauge: { icon: Gauge, tone: "bg-rose-tint text-rose-ink" },
  activity: { icon: Activity, tone: "bg-aqua text-primary" },
  droplet: { icon: Droplet, tone: "bg-marigold-tint text-marigold-ink" },
  "heart-pulse": { icon: HeartPulse, tone: "bg-rose-tint text-rose-ink" },
  wind: { icon: Wind, tone: "bg-sky-tint text-sky-ink" },
  stethoscope: { icon: Stethoscope, tone: "bg-aqua text-primary" },
  video: { icon: Video, tone: "bg-sky-tint text-sky-ink" },
};
const DEFAULT_LOOK = { icon: Activity, tone: "bg-aqua text-primary" };

/** `packages` stays in the signature (page.tsx passes it); the programme cards above already price them. */
export function Pricing({ services }: { packages: Package[]; services: Service[] }) {
  return (
    <Section id="pricing" tone="aqua" titleId="pricing-title">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <SectionTitle
              id="pricing-title"
              title={
                <>
                  Premium care. <span className="whitespace-nowrap">No premium price.</span>
                </>
              }
              lede={`One price covers the nurse visit, the devices, the doctor's time and the report. ${SITE.payment.line}`}
            />
            <ButtonLink href={bookHref()} size="lg" className="mt-8">
              {BOOK_LABEL}
            </ButtonLink>
          </div>
          <ul {...revealProps(1)} className="grid gap-3 rounded-[1.75rem] bg-white p-5 shadow-soft sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:p-6">
            {INCLUDED.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5 text-[0.9375rem] font-medium text-ink">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-aqua text-primary">
                  <Icon aria-hidden className="size-[1.125rem]" strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <h3 className="mt-16 text-h4 text-ink lg:mt-20">Or pick individual tests</h3>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s, i) => {
            const look = TEST_LOOK[s.icon] ?? DEFAULT_LOOK;
            return (
              <li key={s.code} {...revealProps(Math.min(i, 4))}>
                <Link
                  href={bookHref(`test=${s.code}`)}
                  aria-label={`${ROW_CTA_LABEL} ${s.name}, ${inr(s.price)}`}
                  className="group flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-border transition-[transform,box-shadow] duration-300 ease-calm focus-ring hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgb(6_47_45/0.45)] motion-reduce:hover:translate-y-0"
                >
                  <span className={cn("flex size-11 items-center justify-center rounded-xl", look.tone)}>
                    <look.icon aria-hidden className="size-5" strokeWidth={1.9} />
                  </span>
                  <span className="mt-5 text-[1.0625rem] leading-snug font-semibold text-ink">{s.name}</span>
                  <span className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-[1.125rem] font-semibold tracking-tight text-ink tabular-nums">{inr(s.price)}</span>
                    <span className="flex items-center gap-1 text-small font-semibold text-primary">
                      {ROW_CTA_LABEL}
                      <ArrowUpRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li className={cn(services.length % 4 === 0 && "sm:col-span-2 lg:col-span-4")}>
            <a
              href="#callback"
              className="group flex h-full min-h-40 flex-col justify-between rounded-2xl bg-primary p-5 text-white transition-colors duration-200 focus-ring hover:bg-primary-hover"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
                <PhoneCall aria-hidden className="size-5" />
              </span>
              <span className="mt-5">
                <span className="block text-[1.0625rem] font-semibold">Not sure what you need?</span>
                <span className="mt-1 flex items-center gap-1 text-small text-white/85">
                  Ask us to call you
                  <ArrowUpRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
                </span>
              </span>
            </a>
          </li>
        </ul>
      </Container>
    </Section>
  );
}
