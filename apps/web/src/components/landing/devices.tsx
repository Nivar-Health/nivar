import Image from "next/image";
import { Activity, Check, Droplet, FileText, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, Section, SectionTitle, revealProps } from "./primitives";

const DEVICES = [
  {
    src: "/img/device-ecg.jpg",
    alt: "A white handheld smart ECG device resting on linen",
    title: "Smart ECG",
    text: "A resting ECG from a device the size of a phone. Sampled 250 times a second and streamed to your doctor as it records.",
    points: ["250 samples a second", "Streams live to your doctor"],
  },
  {
    src: "/img/device-steth.jpg",
    alt: "A digital stethoscope lying on a stone surface",
    title: "Digital stethoscope",
    text: "The nurse places it; the doctor hears heart and lung sounds live. Every recording is saved to your report so it can be compared next time.",
    points: ["Heart and lung sounds", "Saved to your report"],
  },
];

const ALSO_IN_THE_BAG = [
  { icon: Gauge, label: "BP monitor", text: "Two readings, averaged", tone: "bg-rose-tint text-rose-ink" },
  { icon: Droplet, label: "Glucometer", text: "Fasting, random or after a meal", tone: "bg-marigold-tint text-marigold-ink" },
  { icon: Activity, label: "Pulse oximeter", text: "Oxygen and pulse", tone: "bg-sky-tint text-sky-ink" },
];

export function Devices() {
  return (
    <Section id="devices" titleId="devices-title">
      <Container>
        <SectionTitle
          id="devices-title"
          title="Clinic-grade devices, carried in a small bag."
          lede="Everything a clinic would use for these checks, brought to your sofa and connected to your doctor."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {DEVICES.map((d, i) => (
            <figure key={d.title} {...revealProps(i)} className="flex flex-col rounded-[1.75rem] bg-aqua p-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-muted">
                <Image
                  src={d.src}
                  alt={d.alt}
                  fill
                  sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="flex flex-1 flex-col px-3 pt-6 pb-4">
                <h3 className="text-h3 text-ink">{d.title}</h3>
                <p className="mt-2.5 text-small text-pretty text-ink-2">{d.text}</p>
                <ul className="mt-5 flex flex-col gap-2">
                  {d.points.map((c) => (
                    <li key={c} className="flex items-center gap-2.5 text-small font-medium text-ink">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
                        <Check aria-hidden className="size-3" strokeWidth={3} />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </figcaption>
            </figure>
          ))}

          <div
            {...revealProps(2)}
            className="flex flex-col rounded-[1.75rem] border border-border bg-white p-6 shadow-soft md:col-span-2 lg:col-span-1 lg:p-7"
          >
            <h3 className="text-h3 text-ink">Also in the bag</h3>
            <p className="mt-2.5 text-small text-ink-2">The everyday checks, done properly and recorded in your report.</p>
            <ul className="mt-6 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
              {ALSO_IN_THE_BAG.map(({ icon: Icon, label, text, tone }) => (
                <li key={label} className="flex items-center gap-4 rounded-2xl bg-background p-3 ring-1 ring-border">
                  <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", tone)}>
                    <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-[0.9375rem] font-semibold text-ink">{label}</span>
                    <span className="block text-caption text-ink-3">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-start gap-2.5 border-t border-border pt-5 text-caption text-ink-3 lg:mt-auto">
              <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              Every reading goes into your report, so you can compare one visit with the next.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
