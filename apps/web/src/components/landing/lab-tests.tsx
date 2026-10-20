import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Droplet,
  Gauge,
  HeartPulse,
  Stethoscope,
  TestTubeDiagonal,
  Video,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CALLBACK_HREF, Container, Section, SectionTitle, inr, revealProps } from "./primitives";
import { EnquireButton, WhatsAppLink, whatsappHref } from "./whatsapp";

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

/** Services page: blood tests through a partner lab, then the checks a nurse does on the spot (live catalogue). */
export function LabTests({ services }: { services: Service[] }) {
  // The video consult is its own category on this page, not a test.
  const checks = services.filter((s) => s.code !== "CONSULT");
  return (
    <Section id="lab-tests" tone="aqua" titleId="lab-tests-title">
      <Container>
        <SectionTitle
          id="lab-tests-title"
          title="Lab tests"
          lede="Blood samples collected at home for a partner lab, and quick checks the nurse does on the spot."
        />

        <article
          {...revealProps(0)}
          className="mt-12 flex flex-col gap-6 rounded-[1.75rem] bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 lg:mt-14"
        >
          <div className="flex items-start gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-aqua text-primary">
              <TestTubeDiagonal className="size-6" strokeWidth={1.9} />
            </span>
            <div>
              <h3 className="text-h4 text-ink">Blood tests with a partner lab</h3>
              <p className="mt-1.5 max-w-[56ch] text-small text-pretty text-ink-2">
                A nurse collects the sample at home for our partner lab. Tell us the tests on your prescription and we
                tell you the price before the visit.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-small font-semibold text-ink-2">Price on request</span>
            <EnquireButton service="a blood test" label="blood tests" />
          </div>
        </article>

        <h3 className="mt-14 text-h4 text-ink">Checks done at home</h3>
        <p className="mt-1.5 text-small text-ink-2">Results on the spot, recorded in your visit report.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((s, i) => (
            <li key={s.code} {...revealProps(Math.min(i, 4))}>
              <CheckCard service={s} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

function CheckCard({ service: s }: { service: Service }) {
  const look = TEST_LOOK[s.icon] ?? DEFAULT_LOOK;
  const wa = whatsappHref(`Hi Nivar, I'd like to book this check at home: ${s.name}.`);
  const className =
    "group flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-border transition-[transform,box-shadow] duration-300 ease-calm focus-ring hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-24px_rgb(1_43_54/0.45)] motion-reduce:hover:translate-y-0";
  const body = (
    <>
      <span className={cn("flex size-11 items-center justify-center rounded-xl", look.tone)}>
        <look.icon aria-hidden className="size-5" strokeWidth={1.9} />
      </span>
      <span className="mt-5 text-[1.0625rem] leading-snug font-semibold text-ink">{s.name}</span>
      <span className="mt-1 text-small text-pretty text-ink-2">{s.description}</span>
      <span className="mt-auto flex items-center justify-between pt-4">
        <span className="text-[1.125rem] font-semibold tracking-tight text-ink tabular-nums">{inr(s.price)}</span>
        <span className="flex items-center gap-1 text-small font-semibold text-primary">
          {wa ? "WhatsApp" : "Enquire"}
          <ArrowUpRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-px group-hover:-translate-y-px" />
        </span>
      </span>
    </>
  );
  return wa ? (
    <WhatsAppLink href={wa} className={className}>
      {body}
    </WhatsAppLink>
  ) : (
    <Link href={CALLBACK_HREF} className={className}>
      {body}
    </Link>
  );
}
