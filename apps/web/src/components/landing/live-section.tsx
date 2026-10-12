import Image from "next/image";
import { Container, GlassCard, LiveDot, Section } from "./primitives";
import { LiveDashboard } from "./live-dashboard";

export function LiveSection() {
  return (
    <Section dark id="live">
      <Container>
        <div className="max-w-[720px]">
          <h2 className="font-display text-[2.25rem] leading-[1.05] font-medium tracking-[-0.03em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]">
            Readings that reach your doctor <span className="text-[#8a8a85]">while you&apos;re still on the sofa.</span>
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-[1.6] text-[#a3a39e]">
            The nurse&apos;s devices stream straight to a Nivar doctor&apos;s console. If a reading looks off, the doctor
            asks for a repeat on the spot instead of calling you back next week.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:mt-16 lg:grid-cols-2 lg:gap-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#1a1a19] lg:aspect-auto">
            <Image
              src="/img/doctor.jpg"
              alt="A Nivar doctor at her desk reviewing a patient's live readings on a monitor"
              fill
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-cover"
            />
            <GlassCard className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-4 sm:right-auto sm:w-[280px]">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <LiveDot className="size-1.5" />
                  Live now
                </p>
                <p className="mt-1 text-muted-foreground">Rahul Mehta, BP 138/88</p>
              </div>
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-white">Elevated</span>
            </GlassCard>
          </div>

          <LiveDashboard />
        </div>
      </Container>
    </Section>
  );
}
