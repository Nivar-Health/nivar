import { Check, Minus } from "lucide-react";
import { Container, SectionHeading } from "./primitives";

const ROWS: { topic: string; gig: string; nivar: string }[] = [
  {
    topic: "Accountability",
    gig: "Freelancers paid per visit, with little reason to follow up once they leave.",
    nivar: "Salaried doctors and nurses who answer to our medical lead for every report they sign.",
  },
  {
    topic: "Training",
    gig: "Varies from person to person, and is rarely checked.",
    nivar: "Every nurse is trained on our clinical protocols and our devices before her first visit.",
  },
  {
    topic: "Consistency",
    gig: "A different stranger at the door each time.",
    nivar: "The same small team for your family, with your past readings in front of them.",
  },
  {
    topic: "Review",
    gig: "Readings handed to you to interpret, or to take to a clinic.",
    nivar: "A doctor reviews them live during the visit and writes your prescription.",
  },
];

const TEAM = [
  { initials: "AR", name: "Dr. Ananya Rao", role: "Cardiologist", detail: "MBBS, MD, DM (Cardiology)", years: 14, tone: "bg-primary text-primary-foreground" },
  { initials: "VS", name: "Dr. Vikram Shetty", role: "General Physician", detail: "MBBS, MD (General Medicine)", years: 9, tone: "bg-saffron text-saffron-foreground" },
  { initials: "PN", name: "Priya Nair", role: "Senior Nurse", detail: "B.Sc Nursing, BLS certified", years: 7, tone: "bg-mint text-teal-deep" },
];

export function Doctors() {
  return (
    <section id="doctors" aria-labelledby="doctors-title" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              id="doctors-title"
              title="Doctors on payroll, not on call."
              lede="Every Nivar doctor and nurse is a full-time employee. Not a gig worker, not a referral. That one decision changes how care feels at your door."
            />
            <ul className="mt-10 grid grid-cols-1 gap-3">
              {TEAM.map((m) => (
                <li key={m.name} className="flex items-center gap-4 rounded-2xl border border-ink/8 bg-white p-4">
                  <span
                    aria-hidden
                    className={`flex size-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold ${m.tone}`}
                  >
                    {m.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{m.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {m.role}, {m.detail}
                    </p>
                  </div>
                  <p className="hidden shrink-0 text-right text-sm text-muted-foreground min-[420px]:block">
                    <span className="block font-display text-xl leading-none font-medium text-ink">{m.years}</span>
                    years
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-ink/10 bg-white sm:bg-[linear-gradient(to_right,white_50%,color-mix(in_oklab,var(--mint)_60%,white)_50%)]">
            <div className="hidden grid-cols-2 border-b border-ink/10 text-sm sm:grid">
              <p className="px-7 py-4 font-medium text-muted-foreground">Typical gig model</p>
              <p className="px-7 py-4 font-semibold text-teal-deep">Nivar</p>
            </div>
            <dl>
              {ROWS.map((r) => (
                <div key={r.topic} className="border-b border-ink/8 px-5 pt-6 pb-6 last:border-b-0 sm:px-0 sm:pt-7 sm:pb-7">
                  <dt className="font-display text-[1.35rem] font-medium tracking-[-0.015em] text-ink sm:px-7">
                    {r.topic}
                  </dt>
                  <dd className="mt-3 grid gap-3 sm:mt-2 sm:grid-cols-2 sm:gap-0">
                    <p className="flex gap-2.5 text-[0.92rem] leading-relaxed text-muted-foreground sm:px-7">
                      <Minus className="mt-1 size-4 shrink-0 text-ink/30" aria-hidden />
                      <span>
                        <span className="sr-only">Typical gig model: </span>
                        {r.gig}
                      </span>
                    </p>
                    <p className="flex gap-2.5 rounded-xl bg-mint/70 p-3.5 text-[0.92rem] leading-relaxed text-ink sm:rounded-none sm:bg-transparent sm:px-7 sm:py-0">
                      <Check className="mt-1 size-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                      <span>
                        <span className="sr-only">Nivar: </span>
                        {r.nivar}
                      </span>
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Container>
    </section>
  );
}
