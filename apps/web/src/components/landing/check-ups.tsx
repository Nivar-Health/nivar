import type { Package, Service } from "@/lib/types";
import { LivePanel } from "./live-panel";
import { Container, Section, SectionTitle } from "./primitives";
import { Programmes } from "./programmes";
import { SingleChecks } from "./single-checks";
import "./check-ups.css";

/**
 * Check-ups, the second act (spec §3.6, §4.6): the packages, the single checks in a closed table,
 * then the live readings panel. Nothing invites a booking in or after the panel, so the habits section
 * that follows sits more than a screen away from the last call to action.
 */
export function CheckUps({ packages, services }: { packages: Package[]; services: Service[] }) {
  return (
    <Section id="check-ups" tone="white" titleId="check-ups-title">
      <Container>
        <div className="lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-8">
          <SectionTitle
            id="check-ups-title"
            className="lg:col-span-7"
            title="Check-ups at home, reviewed by a doctor."
            lede="Your nurse checks blood pressure, sugar, oxygen and the heart at home. The smart ECG and digital stethoscope stream to a Nivar doctor as the nurse records, and every check-up comes with the doctor's written report."
          />
          <p className="mt-5 max-w-[46ch] text-small text-pretty text-ink-2 lg:col-span-5 lg:mt-0 lg:justify-self-end lg:pb-[3px] lg:text-right">
            <span className="font-semibold text-ink lg:block">Prices include the home visit and the report.</span> No surge
            pricing, no hidden consultation fee.
          </p>
        </div>

        <Programmes packages={packages} />
        <SingleChecks services={services} className="mt-5 sm:mt-9 lg:max-w-[37rem]" />
        <LivePanel className="mt-7 sm:mt-14 lg:mt-16" />
      </Container>
    </Section>
  );
}
