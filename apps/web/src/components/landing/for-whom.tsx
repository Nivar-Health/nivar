import { Bell, Briefcase, Droplet, HeartPulse, Users, type LucideIcon } from "lucide-react";
import { Container, CtaLink, SectionHeading } from "./primitives";

const AUDIENCES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Droplet,
    title: "Living with diabetes",
    body: "Monthly sugar and BP at home, and a doctor who adjusts your medicines instead of just noting the numbers.",
  },
  {
    icon: HeartPulse,
    title: "Heart patients",
    body: "A regular ECG without the hospital queue, read live by a cardiologist who can compare it with your last one.",
  },
  {
    icon: Briefcase,
    title: "Busy professionals",
    body: "An early morning or evening slot, a 20 minute visit, and a prescription before your first meeting.",
  },
  {
    icon: Users,
    title: "Whole families",
    body: "Check everyone in one visit. Each person gets their own report, all in one app.",
  },
];

const NOTIFICATIONS = [
  { time: "8:12 am", text: "Priya is on her way to Amma's home in Jayanagar." },
  { time: "8:31 am", text: "Priya has arrived. Vitals are being recorded." },
  { time: "8:44 am", text: "Dr. Shetty is on video with Amma. Join the call?" },
  { time: "9:05 am", text: "Amma's report and prescription are ready." },
];

export function ForWhom() {
  return (
    <section aria-labelledby="for-whom-title" className="bg-mint/55 py-20 sm:py-24 lg:py-32">
      <Container>
        <SectionHeading
          id="for-whom-title"
          title="Made for the people you worry about."
          lede="Home check-ups are most useful when getting to a clinic is the hard part."
        />

        <div className="mt-12 grid grid-cols-1 gap-5 lg:mt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-6">
          <article className="relative flex flex-col overflow-hidden rounded-[22px] bg-teal-deep p-6 text-ivory sm:p-9">
            <h3 className="max-w-md font-display text-[1.75rem] leading-[1.12] font-medium tracking-[-0.02em] text-white sm:text-[2.1rem]">
              Book for your parents, from anywhere.
            </h3>
            <p className="mt-4 max-w-md leading-relaxed text-ivory/75">
              In Pune, Dubai or just stuck at work? Book and pay from your phone, follow the nurse on the map, join the
              doctor&apos;s video call and read the report the moment it is signed.
            </p>

            <ol className="mt-8 space-y-2" aria-label="Example updates you receive">
              {NOTIFICATIONS.map((n, i) => (
                <li
                  key={n.time}
                  className="flex items-start gap-3 rounded-xl bg-white/[0.07] px-3.5 py-3 text-sm ring-1 ring-white/10"
                  style={{ opacity: 1 - (NOTIFICATIONS.length - 1 - i) * 0.12 }}
                >
                  <Bell className="mt-0.5 size-4 shrink-0 text-saffron" aria-hidden />
                  <span className="min-w-0 flex-1 text-white/90">{n.text}</span>
                  <span className="shrink-0 text-xs text-ivory/55 tabular-nums">{n.time}</span>
                </li>
              ))}
            </ol>

            <div className="mt-8">
              <CtaLink href="/app/book" variant="saffron" size="lg">
                Book for a parent
              </CtaLink>
            </div>
          </article>

          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-[22px] border border-ink/8 bg-ink/8 sm:grid-cols-2 lg:grid-cols-1">
            {AUDIENCES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 bg-ivory p-6 sm:p-7">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary ring-1 ring-ink/8">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
