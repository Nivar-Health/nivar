import Image from "next/image";
import { Container, Section, SectionTitle } from "./primitives";

const DEVICES = [
  {
    src: "/img/device-ecg.jpg",
    alt: "A white handheld smart ECG device resting on linen",
    title: "Smart ECG",
    lines: [
      "A resting ECG from a device the size of a phone.",
      "Sampled 250 times a second and streamed to your doctor as it records.",
    ],
  },
  {
    src: "/img/device-steth.jpg",
    alt: "A digital stethoscope lying on a stone surface",
    title: "Digital stethoscope",
    lines: [
      "The nurse places it; the doctor hears heart and lung sounds live.",
      "Every recording is saved to your report so it can be compared next time.",
    ],
  },
];

export function Devices() {
  return (
    <Section id="devices">
      <Container>
        <SectionTitle title="Clinic-grade devices," grey="carried in a small bag." />

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:mt-16 lg:gap-8">
          {DEVICES.map((d) => (
            <figure key={d.title} className="flex flex-col">
              <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
                <Image src={d.src} alt={d.alt} fill sizes="(min-width: 1024px) 588px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <figcaption className="mt-6">
                <h3 className="text-[1.25rem] leading-snug font-medium tracking-[-0.02em]">{d.title}</h3>
                <p className="mt-2.5 max-w-[44ch] text-[15px] leading-[1.6] text-muted-foreground">
                  {d.lines[0]} {d.lines[1]}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
