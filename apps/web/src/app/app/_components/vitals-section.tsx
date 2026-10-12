"use client";

import { Activity, Droplet, Gauge, HeartPulse, Stethoscope, Thermometer, Wind, type LucideIcon } from "lucide-react";
import { EcgStrip } from "@/components/live/ecg-strip";
import {
  SUGAR_TYPE_LABEL,
  VITAL_INFO,
  formatTime,
  sugarNormalRange,
  vitalAssessment,
  vitalToneClass,
  type VitalAssessment,
} from "@/lib/format";
import { useDeviceStatus } from "@/lib/socket";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionTitle, Surface } from "./shared";

interface VitalCardModel {
  key: string;
  label: string;
  short: string;
  icon: LucideIcon;
  value: string | null;
  unit: string;
  range: string;
  assessment: VitalAssessment | null;
  sub?: string;
}

export function buildVitalCards(booking: Booking): VitalCardModel[] {
  const v = booking.vitals ?? {};
  const codes = booking.serviceCodes;
  const cards: VitalCardModel[] = [];
  const hasBp = v.bpSystolic != null && v.bpDiastolic != null;
  if (codes.includes("BP") || hasBp) {
    cards.push({
      key: "bp",
      short: "BP",
      label: VITAL_INFO.bp.label,
      icon: Gauge,
      value: hasBp ? `${v.bpSystolic}/${v.bpDiastolic}` : null,
      unit: VITAL_INFO.bp.unit,
      range: VITAL_INFO.bp.normalRange,
      assessment: hasBp ? vitalAssessment("bp", { systolic: v.bpSystolic!, diastolic: v.bpDiastolic! }) : null,
    });
  }
  if (codes.includes("SUGAR") || v.sugar != null) {
    cards.push({
      key: "sugar",
      short: "Sugar",
      label: VITAL_INFO.sugar.label,
      icon: Droplet,
      value: v.sugar != null ? String(v.sugar) : null,
      unit: VITAL_INFO.sugar.unit,
      range: sugarNormalRange(v.sugarType),
      sub: v.sugarType ? SUGAR_TYPE_LABEL[v.sugarType] : undefined,
      assessment: v.sugar != null ? vitalAssessment("sugar", v.sugar, { sugarType: v.sugarType }) : null,
    });
  }
  if (codes.includes("HR") || v.heartRate != null) {
    cards.push({
      key: "hr",
      short: "Heart rate",
      label: VITAL_INFO.heartRate.label,
      icon: HeartPulse,
      value: v.heartRate != null ? String(v.heartRate) : null,
      unit: VITAL_INFO.heartRate.unit,
      range: VITAL_INFO.heartRate.normalRange,
      assessment: v.heartRate != null ? vitalAssessment("heartRate", v.heartRate) : null,
    });
  }
  if (codes.includes("SPO2") || v.spo2 != null) {
    cards.push({
      key: "spo2",
      short: "SpO2",
      label: VITAL_INFO.spo2.label,
      icon: Wind,
      value: v.spo2 != null ? String(v.spo2) : null,
      unit: VITAL_INFO.spo2.unit,
      range: VITAL_INFO.spo2.normalRange,
      assessment: v.spo2 != null ? vitalAssessment("spo2", v.spo2) : null,
    });
  }
  if (v.temperatureF != null) {
    cards.push({
      key: "temp",
      short: "Temp",
      label: VITAL_INFO.temperature.label,
      icon: Thermometer,
      value: String(v.temperatureF),
      unit: VITAL_INFO.temperature.unit,
      range: VITAL_INFO.temperature.normalRange,
      assessment: vitalAssessment("temperature", v.temperatureF),
    });
  }
  return cards;
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

function VitalCard({ card, waiting }: { card: VitalCardModel; waiting: boolean }) {
  const Icon = card.icon;
  return (
    <div
      className={cn(
        "flex min-h-[7.25rem] flex-col rounded-2xl border p-3.5 transition-colors",
        card.value ? "border-border bg-card shadow-soft" : "border-dashed border-border bg-background/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{card.short}</span>
        </span>
        {card.assessment && (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold ring-1 ring-inset",
              vitalToneClass(card.assessment),
            )}
          >
            {card.assessment.label}
          </span>
        )}
      </div>
      {card.value ? (
        <div key={card.value} className="mt-auto animate-fade-up pt-2">
          <p className="flex items-baseline gap-1">
            <span className="tabular font-display text-[1.7rem] leading-none font-medium tracking-tight">{card.value}</span>
            <span className="text-xs text-muted-foreground">{card.unit}</span>
          </p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {card.sub ? `${card.sub} · ` : ""}Normal {lowerFirst(card.range)}
          </p>
        </div>
      ) : (
        <div className="mt-auto pt-2">
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {waiting ? (
              <>
                <span className="flex gap-0.5" aria-hidden>
                  <span className="size-1 animate-pulse rounded-full bg-current" />
                  <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
                  <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
                </span>
                Waiting
              </>
            ) : (
              "Not recorded"
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">Normal {lowerFirst(card.range)}</p>
        </div>
      )}
    </div>
  );
}

/** Live vitals, ECG and stethoscope for a booking, updating as the nurse saves readings. */
export function VitalsSection({ booking }: { booking: Booking }) {
  const devices = useDeviceStatus(booking.id);
  const cards = buildVitalCards(booking);
  const capturing = booking.status === "arrived" || booking.status === "testing";
  const wantsEcg = booking.serviceCodes.includes("ECG");
  const wantsSteth = booking.serviceCodes.includes("STETH");
  const ecgLive = devices.ecg === "streaming" || devices.ecg === "connecting";
  const stethLive = devices.stethoscope === "streaming" || devices.stethoscope === "connecting";
  const recorded = cards.filter((c) => c.value).length;

  if (!cards.length && !wantsEcg && !wantsSteth && !booking.ecg && !booking.stethoscope) return null;

  return (
    <section aria-label="Your readings">
      <SectionTitle
        action={
          capturing ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <span className="live-dot size-1.5" /> Live
            </span>
          ) : booking.vitals?.recordedAt ? (
            <span className="text-xs text-muted-foreground">Recorded {formatTime(booking.vitals.recordedAt)}</span>
          ) : null
        }
      >
        Your readings
        {cards.length > 0 && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {recorded} of {cards.length}
          </span>
        )}
      </SectionTitle>

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {cards.map((c) => (
            <VitalCard key={c.key} card={c} waiting={capturing} />
          ))}
        </div>
      )}

      {(wantsEcg || booking.ecg) && (
        <Surface className="mt-2.5 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" aria-hidden /> Smart ECG
            </span>
            {ecgLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 ring-inset">
                <span className="live-dot size-1.5" /> {devices.ecg === "connecting" ? "Pairing..." : "Recording..."}
              </span>
            ) : booking.ecg ? (
              <span className="tabular text-xs text-muted-foreground">
                {booking.ecg.heartRate ? `${Math.round(booking.ecg.heartRate)} bpm · ` : ""}
                {booking.ecg.rhythm}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{capturing ? "Not started yet" : "Not captured"}</span>
            )}
          </div>
          {booking.ecg?.samples?.length ? (
            <div className="px-3 pb-3.5">
              <EcgStrip
                samples={booking.ecg.samples}
                sampleRate={booking.ecg.sampleRate}
                heartRate={booking.ecg.heartRate}
                variant="brand"
                secondsPerRow={5}
                caption={booking.ecg.capturedAt ? `Captured ${formatTime(booking.ecg.capturedAt)}` : undefined}
              />
              {booking.ecg.interpretation && (
                <p className="mt-2.5 px-1 text-[13px] leading-relaxed text-muted-foreground">{booking.ecg.interpretation}</p>
              )}
            </div>
          ) : ecgLive ? (
            <p className="px-4 pb-4 text-[13px] text-muted-foreground">
              Your nurse is recording a 10 second ECG. Your doctor is watching it live.
            </p>
          ) : null}
        </Surface>
      )}

      {(wantsSteth || booking.stethoscope) && (
        <Surface className="mt-2.5 flex items-start gap-3 px-4 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <Stethoscope className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Smart stethoscope</p>
              {stethLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 ring-inset">
                  <span className="live-dot size-1.5" /> {devices.stethoscope === "connecting" ? "Pairing..." : "Listening..."}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              {booking.stethoscope
                ? `${booking.stethoscope.findings}${booking.stethoscope.heartRate ? ` · ${Math.round(booking.stethoscope.heartRate)} bpm` : ""}`
                : stethLive
                  ? "Heart and lung sounds are streaming to your doctor."
                  : capturing
                    ? "Not started yet"
                    : "Not captured"}
            </p>
          </div>
        </Surface>
      )}
    </section>
  );
}
