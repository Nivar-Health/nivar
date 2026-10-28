import type { Package, Service } from "@/lib/types";
import { LivePanel } from "./live-panel";
import { Container, Section, SectionTitle } from "./primitives";
import { Programmes } from "./programmes";
import { SingleChecks } from "./single-checks";
import "./check-ups.css";

/**
 * Check-ups, the second act (spec U6): the packages and the single checks in one list, then the live
 * readings panel. Nothing invites a booking in or after the panel, so the habits section that follows
 * sits more than a screen away from the last call to action.
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
            lede={
              <>
                Your nurse checks blood pressure, sugar, oxygen and the heart at home, and every{" "}
                {/* Never break "check-up" at its hyphen. */}
                <span className="whitespace-nowrap">check-up</span> comes with a Nivar doctor&apos;s written report.
              </>
            }
          />
          <p className="mt-5 max-w-[46ch] text-small text-pretty text-ink-2 lg:col-span-5 lg:mt-0 lg:justify-self-end lg:pb-[3px] lg:text-right">
            <span className="font-semibold text-ink lg:block">Prices include the home visit and the report.</span> No surge
            pricing, no hidden consultation fee.
          </p>
        </div>

        <Programmes packages={packages} after={<SingleChecks services={services} />} />
        <LivePanel className="mt-7 sm:mt-14 lg:mt-16" />
      </Container>
    </Section>
  );
}
