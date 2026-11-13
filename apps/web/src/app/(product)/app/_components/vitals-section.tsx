"use client";

import { createElement } from "react";
import { Activity, Droplet, Gauge, HeartPulse, Stethoscope, Thermometer, Wind, type LucideIcon } from "lucide-react";
import { EcgStrip } from "@/components/live/ecg-strip";
import {
  SUGAR_TYPE_LABEL,
  VITAL_INFO,
  formatTime,
  sugarNormalRange,
  vitalAssessment,
  vitalShape,
  vitalToneClass,
  type VitalAssessment,
} from "@/lib/format";
import { useDeviceStatus } from "@/lib/socket";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionTitle, Surface } from "./shared";

interface VitalCardModel {
  key: string;
  /** The plain name ("Oxygen level (SpO2)"), as on the report. */
  label: string;
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

/** A reading's status as a word and a shape, never colour alone. */
function VitalFlag({ assessment }: { assessment: VitalAssessment }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit items-center gap-1 rounded-full px-2.5 text-sm font-semibold ring-1 ring-inset",
        vitalToneClass(assessment),
      )}
    >
      {createElement(vitalShape(assessment), { className: "size-3.5 shrink-0", strokeWidth: 2.5, "aria-hidden": true })}
      {assessment.label}
    </span>
  );
}

function VitalCard({ card, waiting }: { card: VitalCardModel; waiting: boolean }) {
  const Icon = card.icon;
  return (
    <div
      className={cn(
        "flex min-h-[8.5rem] flex-col rounded-2xl border p-3.5 transition-colors",
        card.value ? "border-border bg-card" : "border-dashed border-border bg-background",
      )}
    >
      {/* The name may take two lines on a narrow phone; it is never cut. */}
      <p className="flex items-start gap-1.5 text-sm leading-snug font-medium text-foreground-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
        <span className="min-w-0">{card.label}</span>
      </p>
      {card.value ? (
        <div key={card.value} className="mt-auto animate-fade-up pt-2">
          <p className="flex flex-wrap items-baseline gap-x-1">
            <span className="tabular font-display text-[1.7rem] leading-none font-medium tracking-tight">{card.value}</span>
            <span className="text-sm text-muted-foreground">{card.unit}</span>
          </p>
          {card.assessment && <div className="mt-2"><VitalFlag assessment={card.assessment} /></div>}
          <p className="tabular mt-1.5 text-sm leading-snug text-muted-foreground">
            {card.sub ? `${card.sub} · ` : ""}Normal {lowerFirst(card.range)}
          </p>
        </div>
      ) : (
        <div className="mt-auto pt-2">
          <div className="flex items-center gap-1.5 text-small text-foreground-2">
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
          <p className="tabular mt-1 text-sm leading-snug text-muted-foreground">Normal {lowerFirst(card.range)}</p>
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
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="live-dot size-1.5 text-signal" aria-hidden /> Live
            </span>
          ) : booking.vitals?.recordedAt ? (
            <span className="tabular text-sm text-muted-foreground">Recorded {formatTime(booking.vitals.recordedAt)}</span>
          ) : null
        }
      >
        Your readings
        {cards.length > 0 && (
          <span className="tabular ml-1.5 text-sm font-normal text-muted-foreground">
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
      {cards.length > 0 && (
        <p className="mt-2.5 px-1 text-small text-foreground-2">
          These are general adult ranges. Your doctor will explain your readings.
        </p>
      )}

      {(wantsEcg || booking.ecg) && (
        <Surface className="mt-2.5 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
            <span className="flex items-center gap-2 text-small font-semibold">
              <Activity className="size-4 text-primary" aria-hidden /> Heart tracing (ECG)
            </span>
            {ecgLive ? (
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-background px-2.5 text-sm font-medium text-foreground ring-1 ring-border ring-inset">
                <span className="live-dot size-1.5 text-signal" aria-hidden /> {devices.ecg === "connecting" ? "Pairing…" : "Recording…"}
              </span>
            ) : booking.ecg ? (
              <span className="tabular text-sm text-muted-foreground">
                {booking.ecg.heartRate ? `${Math.round(booking.ecg.heartRate)} bpm · ` : ""}
                {booking.ecg.rhythm}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{capturing ? "Not started yet" : "Not captured"}</span>
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
                <p className="mt-2.5 px-1 text-small leading-relaxed text-foreground-2">{booking.ecg.interpretation}</p>
              )}
            </div>
          ) : ecgLive ? (
            <p className="px-4 pb-4 text-small text-foreground-2">
              Your nurse is recording a 10-second ECG. Your doctor can see it as it is recorded.
            </p>
          ) : null}
        </Surface>
      )}

      {(wantsSteth || booking.stethoscope) && (
        <Surface className="mt-2.5 flex items-start gap-3 px-4 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground">
            <Stethoscope className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-small font-semibold">Heart and lung sounds</p>
              {stethLive && (
                <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-background px-2.5 text-sm font-medium text-foreground ring-1 ring-border ring-inset">
                  <span className="live-dot size-1.5 text-signal" aria-hidden /> {devices.stethoscope === "connecting" ? "Pairing…" : "Listening…"}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-small leading-snug text-foreground-2">
              {booking.stethoscope
                ? `${booking.stethoscope.findings}${booking.stethoscope.heartRate ? ` · ${Math.round(booking.stethoscope.heartRate)} bpm` : ""}`
                : stethLive
                  ? "Your doctor is listening to your heart and lungs."
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
