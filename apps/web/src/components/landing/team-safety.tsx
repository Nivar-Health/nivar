import Image from "next/image";
import { BadgeCheck, PackageCheck, Phone, Stethoscope, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site-facts";
import { Container, Section, SectionTitle, revealProps } from "./primitives";

const TEAM: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Stethoscope,
    title: "Doctors",
    text: "MBBS or higher and registered with the Karnataka Medical Council. One is reachable during every visit.",
  },
  {
    icon: BadgeCheck,
    title: "Nurses",
    text: "Registered with the Karnataka State Nursing Council and trained on our protocols.",
  },
  {
    icon: PackageCheck,
    title: "Safety",
    text: "Sealed, single-use kits, a doctor reachable during every visit, and a clear hospital-referral protocol.",
  },
];

const ROWS = [
  { label: "Doctor", typical: "Whoever is free", nivar: "Doctors trained on our protocols" },
  { label: "Training", typical: "Varies by person", nivar: "Trained on our devices and SOPs before the first visit" },
  { label: "Continuity", typical: "A different person each time", nivar: "The same small team knows your history" },
  { label: "Report", typical: "Decode it yourself", nivar: "Reviewed and explained on video" },
];

/** "Team and safety": who comes to the home, how we keep it safe, and how that differs from a typical app. */
export function TeamSafety() {
  const lead = SITE.medicalLead;
  return (
    <Section id="team" tone="aqua" titleId="team-title">
      <Container>
        <SectionTitle
          id="team-title"
          title="Safe hands, at home."
          lede="A small team that follows the same protocols on every visit, with a doctor a call away."
        />

        <div className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-12">
          {lead && (
            <figure
              {...revealProps(0)}
              className="flex flex-col gap-5 rounded-[1.75rem] bg-white p-5 ring-1 ring-border sm:flex-row sm:p-6 lg:col-span-12"
            >
              {lead.photo && (
                <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden rounded-[1.25rem] bg-muted sm:w-48">
                  <Image src={lead.photo} alt={lead.name} fill sizes="(min-width: 640px) 192px, 100vw" className="object-cover" />
                </div>
              )}
              <figcaption className="flex flex-col justify-center">
                <p className="text-small font-semibold text-primary">Medical Lead</p>
                <p className="mt-1 text-h3 text-ink">{lead.name}</p>
                <p className="mt-1 text-small text-ink-3">
                  {lead.credentials}
                  {lead.registration && `. ${lead.registration}`}
                </p>
                <p className="mt-4 max-w-[62ch] text-body text-pretty text-ink-2">{lead.background}</p>
              </figcaption>
            </figure>
          )}

          <ul className="grid gap-5 md:grid-cols-3 lg:col-span-12">
            {TEAM.map(({ icon: Icon, title, text }, i) => (
              <li key={title} {...revealProps(i)} className="flex flex-col rounded-[1.75rem] bg-white p-6 sm:p-7">
                <div className="flex items-center gap-4 md:block">
                  <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
                    <Icon className="size-6" strokeWidth={1.9} />
                  </span>
                  <h3 className="text-h4 text-ink md:mt-5">{title}</h3>
                </div>
                <p className="mt-1.5 text-body text-pretty text-ink-2">{text}</p>
              </li>
            ))}
          </ul>

          <div {...revealProps(1)} className="overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-border lg:col-span-12">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">A typical home-care app compared with Nivar</caption>
              <thead>
                <tr className="border-b border-border">
                  <td className="w-[22%] px-4 py-4 sm:px-6" />
                  <th scope="col" className="w-[34%] px-3 py-4 text-small font-semibold text-ink-3 sm:px-4">
                    Typical home-care app
                  </th>
                  <th scope="col" className="bg-aqua px-3 py-4 text-small font-semibold text-primary sm:px-4">
                    <span className="inline-flex items-center gap-2">
                      <LogoMark className="size-5" />
                      Nivar
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="px-4 py-4 align-top text-small font-semibold text-ink sm:px-6">
                      {r.label}
                    </th>
                    <td className="px-3 py-4 align-top text-small text-pretty text-ink-2 sm:px-4 sm:text-body">{r.typical}</td>
                    <td className="bg-aqua px-3 py-4 align-top text-small font-medium text-pretty text-ink sm:px-4 sm:text-body">
                      {r.nivar}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-8 flex w-fit items-start gap-3 rounded-2xl border border-danger/20 bg-danger-bg px-5 py-4 text-small text-pretty text-ink">
          <Phone aria-hidden className="mt-0.5 size-4.5 shrink-0 text-danger" />
          <span>
            Nivar is not an emergency service. In an emergency, call{" "}
            <a href="tel:112" className="rounded-sm font-semibold text-danger underline underline-offset-2 focus-ring">
              112
            </a>{" "}
            (or{" "}
            <a href="tel:108" className="rounded-sm font-semibold text-danger underline underline-offset-2 focus-ring">
              108
            </a>{" "}
            for an ambulance).
          </span>
        </p>
      </Container>
    </Section>
  );
}
