"use client";

import { useRef } from "react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { StethMonitor } from "@/components/live/steth-monitor";
import { useEcgFeed, useInView, usePrefersReducedMotion, useStethFeed } from "./live-feeds";
import { StaticEcgPanel } from "./static-trace";

const HR = 76;

/** The doctor's view: live ECG and heart sounds from simulated devices. */
export function LiveDevices() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = usePrefersReducedMotion();
  const ecg = useEcgFeed(HR);
  const steth = useStethFeed(HR);
  const live = inView && !reduced;

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {reduced ? (
        <StaticEcgPanel height={210} heartRate={HR} />
      ) : (
        <EcgMonitor feed={live ? ecg : null} status={live ? "streaming" : "connecting"} height={210} className="sm:h-[232px]!" />
      )}
      <StethMonitor
        feed={inView ? steth : null}
        status={inView ? "streaming" : "connecting"}
        height={176}
        site="Mitral area"
        className="sm:h-[188px]!"
      />
    </div>
  );
}
