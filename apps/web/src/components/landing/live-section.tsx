import Image from "next/image";
import { Container, GlassCard, LiveDot, Pill, Section, SectionTitle } from "./primitives";
import { LiveDashboard } from "./live-dashboard";
import { ContactCtas } from "./whatsapp";

export function LiveSection() {
  return (
    <Section id="live" tone="deep" titleId="live-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-ecg-grid-dark" />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 -z-10 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--teal)_28%,transparent),transparent)]"
      />

      <Container>
        <SectionTitle
          id="live-title"
          title="Readings that reach your doctor while you're still on the sofa."
          lede="The smart ECG and digital stethoscope stream straight to a Nivar doctor's console, so the doctor sees the heart's rhythm and hears the heart and lungs as the nurse records them. If something looks or sounds off, the doctor asks for a repeat on the spot."
        />

        <div className="mt-12 grid gap-6 lg:mt-14 lg:grid-cols-2 lg:gap-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-pine-raised ring-1 ring-white/10 lg:aspect-auto">
            <Image
              src="/img/doctor.jpg"
              alt="A doctor at a desk reviewing a patient's live readings on a monitor"
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
            <GlassCard className="absolute right-4 bottom-4 left-4 flex items-center justify-between gap-4 sm:right-auto sm:w-[300px]">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <LiveDot className="size-1.5" />
                  Live now
                </p>
                <p className="mt-1 text-muted-foreground">Sample patient, BP 126/78</p>
              </div>
              <Pill tone="warning">Elevated</Pill>
            </GlassCard>
          </div>

          <LiveDashboard />
        </div>

        <p className="mt-4 text-caption text-pretty text-muted-foreground">Demo with simulated readings and an illustrative patient.</p>

        <div className="mt-12 flex flex-col items-start gap-4 border-t border-border-strong pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-body text-pretty text-foreground-2">See your own readings reach a Nivar doctor, live.</p>
          <ContactCtas tone="dark" message="Hi Nivar, I'd like to book a health check-up at home." />
        </div>
      </Container>
    </Section>
  );
}
