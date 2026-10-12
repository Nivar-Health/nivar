"use client";

import { useRef } from "react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { cn } from "@/lib/utils";
import { useEcgFeed, useInView, usePairing } from "./live-feeds";
import { LiveDot } from "./primitives";

const VITALS = [
  { label: "Blood pressure", value: "138/88", unit: "mmHg", flag: "Elevated" },
  { label: "Oxygen saturation", value: "98", unit: "%", flag: "Normal" },
  { label: "Blood sugar", value: "112", unit: "mg/dL", flag: "Normal" },
  { label: "Heart rate", value: "76", unit: "bpm", flag: "Normal" },
] as const;

/**
 * The doctor's view, built from the same monitor component the real console uses
 * and fed by the local device simulator, so the trace is genuinely live.
 */
export function LiveDashboard({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const paired = usePairing(inView, 1200);
  const feed = useEcgFeed(76);

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-3xl border border-white/10 bg-[#111110] p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 px-1 pb-4">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-white">Rahul Mehta, 58</p>
          <p className="mt-0.5 text-[13px] text-[#8a8a85]">Heart Check, Indiranagar</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium whitespace-nowrap text-white">
          <LiveDot className="size-1.5" />
          <span>
            Dr. Rao<span className="hidden sm:inline"> reviewing</span>
          </span>
        </span>
      </div>

      <EcgMonitor
        feed={inView ? feed : null}
        heartRate={76}
        status={paired ? "streaming" : "connecting"}
        height={200}
        className="rounded-2xl"
      />

      <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-white/10 min-[420px]:grid-cols-2">
        {VITALS.map((v) => (
          <div key={v.label} className="flex flex-col gap-3 bg-[#111110] p-4">
            <dt className="flex items-center justify-between gap-2 text-xs text-[#8a8a85]">
              <span>{v.label}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  v.flag === "Normal" ? "bg-white/10 text-[#c9c9c4]" : "bg-white text-[#0a0a0a]",
                )}
              >
                {v.flag}
              </span>
            </dt>
            <dd className="text-[1.5rem] leading-none font-medium tracking-[-0.02em] text-white tabular-nums">
              {v.value} <span className="text-xs font-normal tracking-normal text-[#8a8a85]">{v.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
