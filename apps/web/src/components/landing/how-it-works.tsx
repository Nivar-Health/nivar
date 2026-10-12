import { CalendarCheck, FileText, HeartPulse, MonitorPlay, type LucideIcon } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { Container, SectionHeading } from "./primitives";

const STEPS: { icon: LucideIcon; title: string; body: string; when: string }[] = [
  {
    icon: CalendarCheck,
    title: "Book in two minutes",
    body: "Pick a package or single tests, add who it is for and choose a slot. Express visits reach you within 60 minutes.",
    when: "From 7 am to 8 pm, every day",
  },
  {
    icon: HeartPulse,
    title: "A Nivar nurse arrives",
    body: "She records BP, sugar, SpO2 and heart rate, then places the smart ECG and smart stethoscope. You can track her on the way.",
    when: "About 20 minutes at home",
  },
  {
    icon: MonitorPlay,
    title: "Your doctor joins live",
    body: "A Nivar doctor in our clinic watches your ECG and listens to your heart as it streams, then talks to you on video.",
    when: "During the visit",
  },
  {
    icon: FileText,
    title: "Report in your app",
    body: "Diagnosis, prescription and advice, signed by the doctor, with your ECG strip attached. Share it or download a PDF.",
    when: "Usually within the hour",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <Container>
        <SectionHeading
          id="how-title"
          title="One visit. Nurse at your side, doctor on screen."
          lede="Most home check-ups end with a lab report you have to take to a doctor. With Nivar, the doctor is part of the visit."
        />

        <div className="relative mt-14 lg:mt-20">
          <EcgLine
            beats={8}
            amplitude={0.5}
            className="pointer-events-none absolute top-0 left-0 hidden h-11 lg:block"
            strokeClassName="stroke-primary"
          />
          <ol className="grid grid-cols-1 gap-x-8 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body, when }, i) => (
              <li
                key={title}
                className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0 lg:block lg:pb-0"
              >
                {/* vertical connector on mobile */}
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="absolute top-12 bottom-1 left-[21px] w-px bg-primary/20 lg:hidden" />
                )}
                <span className="relative z-10 flex size-11 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground ring-6 ring-ivory">
                  {i + 1}
                </span>
                <div className="lg:mt-7">
                  <Icon className="mb-3 hidden size-6 text-primary lg:block" aria-hidden strokeWidth={1.75} />
                  <h3 className="pt-2 text-lg font-semibold text-ink lg:pt-0">{title}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{body}</p>
                  <p className="mt-4 inline-flex rounded-full bg-mint px-3 py-1 text-[0.8rem] font-medium text-teal-deep">
                    {when}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
