import { Container, Section, SectionTitle } from "./primitives";

const STEPS = [
  {
    title: "Book in two minutes",
    text: "Choose a programme or a few tests, pick a slot and an address. Same-day slots open every morning.",
    time: "2 min",
  },
  {
    title: "A nurse arrives with the devices",
    text: "A certified Nivar nurse comes with a smart ECG, a digital stethoscope, a BP monitor and a glucometer.",
    time: "~45 min",
  },
  {
    title: "Your doctor joins live",
    text: "Readings stream to a Nivar doctor as they are taken. She reviews them and speaks with you on video.",
    time: "15 min",
  },
  {
    title: "Report in your app",
    text: "A signed report and prescription, with every reading explained in plain words, lands in the app.",
    time: "Within the hour",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Container>
        <SectionTitle
          title="One visit."
          grey="The whole check-up."
          lede="Nothing to download before the nurse arrives, nothing to carry to a lab. Here is what happens, in order."
        />

        <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col border-t border-border pt-6">
              <span className="text-sm font-medium text-muted-foreground tabular-nums">0{i + 1}</span>
              <h3 className="mt-6 text-[1.125rem] leading-snug font-medium tracking-[-0.01em]">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{s.text}</p>
              <span className="mt-6 inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground tabular-nums">
                {s.time}
              </span>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
