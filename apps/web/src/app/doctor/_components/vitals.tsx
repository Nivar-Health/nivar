"use client";

import { useState, type ReactNode } from "react";
import { Activity, Droplet, Gauge, HeartPulse, Thermometer, Weight } from "lucide-react";
import {
  SUGAR_TYPE_LABEL,
  VITAL_INFO,
  sugarNormalRange,
  vitalAssessment,
  vitalToneClass,
  type VitalAssessment,
} from "@/lib/format";
import type { Vitals } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface VitalRow {
  key: string;
  label: string;
  value: string | null;
  unit: string;
  range: string;
  /** Extra context shown with the range, e.g. "Fasting". */
  qualifier?: string;
  assessment: VitalAssessment | null;
  icon: ReactNode;
}

/** Normalised rows for every vital, recorded or not. */
export function vitalRows(v: Vitals | null | undefined, liveHeartRate?: number | null): VitalRow[] {
  const bp =
    v?.bpSystolic && v?.bpDiastolic
      ? vitalAssessment("bp", { systolic: v.bpSystolic, diastolic: v.bpDiastolic })
      : null;
  const hr = v?.heartRate ?? liveHeartRate ?? null;
  return [
    {
      key: "bp",
      label: "Blood pressure",
      value: v?.bpSystolic && v?.bpDiastolic ? `${v.bpSystolic}/${v.bpDiastolic}` : null,
      unit: VITAL_INFO.bp.unit,
      range: "< 120/80",
      assessment: bp,
      icon: <Gauge />,
    },
    {
      key: "hr",
      label: "Heart rate",
      value: hr ? String(Math.round(hr)) : null,
      unit: VITAL_INFO.heartRate.unit,
      range: VITAL_INFO.heartRate.normalRange,
      assessment: hr ? vitalAssessment("heartRate", hr) : null,
      icon: <HeartPulse />,
    },
    {
      key: "spo2",
      label: "SpO2",
      value: v?.spo2 ? String(v.spo2) : null,
      unit: VITAL_INFO.spo2.unit,
      range: VITAL_INFO.spo2.normalRange,
      assessment: v?.spo2 ? vitalAssessment("spo2", v.spo2) : null,
      icon: <Activity />,
    },
    {
      key: "sugar",
      label: "Blood sugar",
      qualifier: v?.sugarType ? SUGAR_TYPE_LABEL[v.sugarType] : undefined,
      value: typeof v?.sugar === "number" ? String(v.sugar) : null,
      unit: VITAL_INFO.sugar.unit,
      range: sugarNormalRange(v?.sugarType),
      assessment: typeof v?.sugar === "number" ? vitalAssessment("sugar", v.sugar, { sugarType: v.sugarType }) : null,
      icon: <Droplet />,
    },
    {
      key: "temp",
      label: "Temperature",
      value: v?.temperatureF ? v.temperatureF.toFixed(1) : null,
      unit: VITAL_INFO.temperature.unit,
      range: VITAL_INFO.temperature.normalRange,
      assessment: v?.temperatureF ? vitalAssessment("temperature", v.temperatureF) : null,
      icon: <Thermometer />,
    },
    {
      key: "weight",
      label: "Weight",
      value: v?.weightKg ? String(v.weightKg) : null,
      unit: "kg",
      range: "",
      assessment: null,
      icon: <Weight />,
    },
  ];
}

export function FlagPill({ assessment, className }: { assessment: VitalAssessment; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center rounded-full px-1.5 text-[9.5px] font-semibold tracking-wide whitespace-nowrap uppercase ring-1 ring-inset",
        vitalToneClass(assessment),
        className,
      )}
    >
      {assessment.label}
    </span>
  );
}

/** Briefly tints its parent whenever `value` changes after mount. */
function ChangeFlash({ value }: { value: string | null }) {
  const [seen, setSeen] = useState(value);
  const [flashes, setFlashes] = useState(0);
  if (value !== seen) {
    setSeen(value);
    if (value !== null) setFlashes((n) => n + 1);
  }
  if (flashes === 0) return null;
  return (
    <span
      key={flashes}
      aria-hidden
      className="pointer-events-none absolute inset-0 animate-out rounded-[inherit] bg-saffron/25 ring-2 ring-saffron/60 duration-[2200ms] fade-out fill-mode-forwards ring-inset"
    />
  );
}

/** Compact clinical list of vitals: label and normal range left, value and flag right. */
export function VitalsList({ rows }: { rows: VitalRow[] }) {
  return (
    <dl className="-mx-1 flex flex-col">
      {rows.map((row) => {
        const recorded = row.value !== null;
        const abnormal = row.assessment && row.assessment.level !== "normal";
        return (
          <div
            key={row.key}
            className={cn("relative flex items-center gap-3 rounded-lg px-2 py-2", abnormal && "bg-red-50/70")}
          >
            <ChangeFlash value={row.value} />
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4",
                abnormal ? "bg-red-100 text-red-700" : "bg-secondary text-primary",
              )}
            >
              {row.icon}
            </span>
            <dt className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{row.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground tabular-nums">
                {row.range ? `${row.qualifier ? `${row.qualifier}, n` : "N"}ormal ${row.range}` : "Recorded at home"}
              </span>
            </dt>
            <dd className="flex shrink-0 flex-col items-end gap-0.5">
              {recorded ? (
                <span className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-[17px] leading-none font-semibold tracking-tight tabular-nums",
                      abnormal ? "text-red-700" : "text-foreground",
                    )}
                  >
                    {row.value}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{row.unit}</span>
                </span>
              ) : (
                <span className="text-[17px] leading-none font-medium text-muted-foreground/50">--</span>
              )}
              {row.assessment ? (
                <FlagPill assessment={row.assessment} />
              ) : (
                <span className="h-[18px] text-[10.5px] leading-[18px] text-muted-foreground">
                  {recorded ? "" : "Pending"}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
