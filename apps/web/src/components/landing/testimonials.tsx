import { Star } from "lucide-react";
import { Container, SectionHeading } from "./primitives";

const QUOTES = [
  {
    quote:
      "My father is 78 and refuses to sit in hospital queues. The nurse did his ECG in the living room, and Dr. Rao spoke to him on the tablet while I joined from Singapore. We had his revised prescription before lunch.",
    name: "Karthik Subramanian",
    meta: "Heart Check for his father, Jayanagar",
    initials: "KS",
  },
  {
    quote:
      "I check my sugar every month now without taking a half day off. The nurse is the same each time, so she already knows my readings.",
    name: "Deepa Menon",
    meta: "Diabetes Care, Malleshwaram",
    initials: "DM",
  },
  {
    quote:
      "Booked the express visit at 7 am after a night of palpitations. Nurse was home in 40 minutes and the doctor reassured me with the ECG on screen.",
    name: "Farhan Sheikh",
    meta: "Complete Home Check-up, HSR Layout",
    initials: "FS",
  },
];

export function Testimonials() {
  const [lead, ...rest] = QUOTES;
  return (
    <section aria-labelledby="stories-title" className="border-y border-ink/8 bg-white py-20 sm:py-24 lg:py-32">
      <Container>
        <SectionHeading id="stories-title" title="What families tell us after the first visit." />

        <div className="mt-12 grid grid-cols-1 gap-5 lg:mt-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-6">
          <figure className="flex flex-col justify-between rounded-[22px] bg-ivory p-7 ring-1 ring-ink/8 sm:p-10">
            <Stars />
            <blockquote className="mt-6 font-display text-[1.45rem] leading-[1.35] font-normal tracking-[-0.01em] text-pretty text-ink sm:text-[1.75rem]">
              &ldquo;{lead.quote}&rdquo;
            </blockquote>
            <Person {...lead} className="mt-8" />
          </figure>

          <div className="grid grid-cols-1 gap-5 lg:gap-6">
            {rest.map((q) => (
              <figure key={q.name} className="flex flex-col justify-between rounded-[22px] p-7 ring-1 ring-ink/8 sm:p-8">
                <blockquote className="text-[1.0625rem] leading-relaxed text-ink/90">&ldquo;{q.quote}&rdquo;</blockquote>
                <Person {...q} className="mt-6" />
              </figure>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Stars() {
  return (
    <div className="flex gap-0.5 text-saffron" role="img" aria-label="Rated 5 out of 5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="size-4 fill-current" aria-hidden />
      ))}
    </div>
  );
}

function Person({ name, meta, initials, className }: { name: string; meta: string; initials: string; className?: string }) {
  return (
    <figcaption className={`flex items-center gap-3 ${className ?? ""}`}>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint font-display text-sm font-semibold text-teal-deep"
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.95rem] font-semibold text-ink">{name}</span>
        <span className="block text-sm text-muted-foreground">{meta}</span>
      </span>
    </figcaption>
  );
}
