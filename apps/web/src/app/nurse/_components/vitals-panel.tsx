"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, CircleAlert, Gauge, Droplet, HeartPulse, LoaderCircle, Scale, Thermometer, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  SUGAR_TYPE_LABEL,
  VITAL_INFO,
  sugarNormalRange,
  vitalAssessment,
  vitalToneClass,
  type VitalAssessment,
} from "@/lib/format";
import type { Booking, ServiceCode, SugarType, Vitals } from "@/lib/types";
import { cn } from "@/lib/utils";

type NumKey = Exclude<keyof Vitals, "sugarType" | "recordedAt">;

interface FieldDef {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  decimals?: boolean;
  placeholder: string;
}

type CardId = "bp" | "sugar" | "heartRate" | "spo2" | "temperature" | "weight";

interface CardDef {
  id: CardId;
  title: string;
  unit: string;
  icon: LucideIcon;
  code?: ServiceCode;
  fields: FieldDef[];
  normal?: (sugarType: SugarType) => string;
  assess?: (v: Partial<Record<NumKey, number>>, sugarType: SugarType) => VitalAssessment | null;
}

const CARDS: CardDef[] = [
  {
    id: "bp",
    title: "Blood pressure",
    unit: "mmHg",
    icon: Gauge,
    code: "BP",
    fields: [
      {
        key: "bpSystolic",
        label: "Systolic",
        min: 50,
        max: 260,
        placeholder: "120",
      },
      {
        key: "bpDiastolic",
        label: "Diastolic",
        min: 30,
        max: 180,
        placeholder: "80",
      },
    ],
    normal: () => VITAL_INFO.bp.normalRange,
    assess: (v) =>
      v.bpSystolic != null && v.bpDiastolic != null
        ? vitalAssessment("bp", {
            systolic: v.bpSystolic,
            diastolic: v.bpDiastolic,
          })
        : null,
  },
  {
    id: "sugar",
    title: "Blood sugar",
    unit: "mg/dL",
    icon: Droplet,
    code: "SUGAR",
    fields: [{ key: "sugar", label: "Glucose", min: 20, max: 700, placeholder: "95" }],
    normal: (t) => sugarNormalRange(t),
    assess: (v, t) => (v.sugar != null ? vitalAssessment("sugar", v.sugar, { sugarType: t }) : null),
  },
  {
    id: "heartRate",
    title: "Heart rate",
    unit: "bpm",
    icon: HeartPulse,
    code: "HR",
    fields: [
      {
        key: "heartRate",
        label: "Heart rate",
        min: 20,
        max: 250,
        placeholder: "72",
      },
    ],
    normal: () => VITAL_INFO.heartRate.normalRange,
    assess: (v) => (v.heartRate != null ? vitalAssessment("heartRate", v.heartRate) : null),
  },
  {
    id: "spo2",
    title: "SpO2",
    unit: "%",
    icon: Wind,
    code: "SPO2",
    fields: [{ key: "spo2", label: "SpO2", min: 50, max: 100, placeholder: "98" }],
    normal: () => VITAL_INFO.spo2.normalRange,
    assess: (v) => (v.spo2 != null ? vitalAssessment("spo2", v.spo2) : null),
  },
  {
    id: "temperature",
    title: "Temperature",
    unit: "°F",
    icon: Thermometer,
    fields: [
      {
        key: "temperatureF",
        label: "Temperature",
        min: 90,
        max: 110,
        decimals: true,
        placeholder: "98.6",
      },
    ],
    normal: () => VITAL_INFO.temperature.normalRange,
    assess: (v) => (v.temperatureF != null ? vitalAssessment("temperature", v.temperatureF) : null),
  },
  {
    id: "weight",
    title: "Weight",
    unit: "kg",
    icon: Scale,
    fields: [
      {
        key: "weightKg",
        label: "Weight",
        min: 1,
        max: 300,
        decimals: true,
        placeholder: "70",
      },
    ],
  },
];

const SUGAR_TYPES: SugarType[] = ["fasting", "random", "pp"];
const AUTOSAVE_MS = 900;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function toDraft(n: number | undefined | null): string {
  return n == null ? "" : String(n);
}

function parseField(raw: string, f: FieldDef): { value: number | null; error: string | null } {
  const t = raw.trim();
  if (!t) return { value: null, error: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: "Enter a number" };
  if (n < f.min || n > f.max) return { value: null, error: `Enter ${f.min} to ${f.max}` };
  return {
    value: f.decimals ? Math.round(n * 10) / 10 : Math.round(n),
    error: null,
  };
}

function SaveIndicator({ state, error }: { state: SaveState; error: string | null }) {
  if (state === "saving" || state === "pending")
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        Saving
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <span className="flex size-4 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
        </span>
        Saved
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-danger" title={error ?? undefined}>
        <CircleAlert className="size-3.5" aria-hidden />
        Not saved
      </span>
    );
  return null;
}

function VitalCard({
  def,
  booked,
  booking,
  onSaved,
}: {
  def: CardDef;
  booked: boolean;
  booking: Booking;
  onSaved: (b: Booking) => void;
}) {
  const uid = useId();
  const Icon = def.icon;
  const initialVitals = booking.vitals ?? {};
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.key, toDraft(initialVitals[f.key])])),
  );
  const [sugarType, setSugarType] = useState<SugarType>(initialVitals.sugarType ?? "random");
  const [state, setState] = useState<SaveState>(() =>
    def.fields.every((f) => initialVitals[f.key] != null) ? "saved" : "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  // Last values the server has, to send only what changed.
  const savedRef = useRef<Record<string, number | string | null>>({
    ...Object.fromEntries(def.fields.map((f) => [f.key, initialVitals[f.key] ?? null])),
    sugarType: initialVitals.sugarType ?? null,
  });
  const timer = useRef<number | null>(null);
  const latest = useRef({ drafts, sugarType });
  useEffect(() => {
    latest.current = { drafts, sugarType };
  });

  const parsed = def.fields.map((f) => ({
    f,
    ...parseField(drafts[f.key] ?? "", f),
  }));
  const values: Partial<Record<NumKey, number>> = {};
  for (const p of parsed) if (p.value != null) values[p.f.key] = p.value;
  const assessment = def.assess?.(values, sugarType) ?? null;

  const save = useCallback(async () => {
    timer.current = null;
    const { drafts: d, sugarType: st } = latest.current;
    const patch: Record<string, number | string | null> = {};
    for (const f of def.fields) {
      const { value, error } = parseField(d[f.key] ?? "", f);
      if (error) {
        setState("idle");
        return;
      }
      if (value !== savedRef.current[f.key]) patch[f.key] = value;
    }
    const sugarValue = def.id === "sugar" ? parseField(d.sugar ?? "", def.fields[0]).value : null;
    if (sugarValue != null && st !== savedRef.current.sugarType) {
      patch.sugarType = st;
    }
    // Clearing a never-saved field is a no-op.
    for (const k of Object.keys(patch)) if (patch[k] === null && savedRef.current[k] == null) delete patch[k];
    if (Object.keys(patch).length === 0) {
      setState(def.fields.some((f) => savedRef.current[f.key] != null) ? "saved" : "idle");
      return;
    }
    setState("saving");
    try {
      const res = await api.put<{ booking: Booking }>(`/bookings/${booking.id}/vitals`, patch);
      Object.assign(savedRef.current, patch);
      setSaveError(null);
      // A newer edit may have been scheduled while saving.
      if (!timer.current) setState("saved");
      onSaved(res.booking);
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save."));
      setState("error");
    }
  }, [booking.id, def, onSaved]);

  const schedule = (delay = AUTOSAVE_MS) => {
    if (timer.current) window.clearTimeout(timer.current);
    setState("pending");
    timer.current = window.setTimeout(() => void save(), delay);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const hasError = parsed.some((p) => p.error);
  const showState: SaveState = hasError ? "idle" : state;

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
      aria-labelledby={`${uid}-t`}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 id={`${uid}-t`} className="truncate font-semibold">
            {def.title}
          </h3>
          {!booked && (
            <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
              Optional
            </span>
          )}
        </div>
        <SaveIndicator state={showState} error={saveError} />
      </div>

      <div className="flex items-end gap-2">
        {parsed.map(({ f, error }, i) => (
          <div key={f.key} className="flex min-w-0 flex-1 items-end gap-2">
            {i > 0 && <span className="pb-3 text-2xl font-light text-muted-foreground">/</span>}
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              {def.fields.length > 1 && <span className="text-xs font-medium text-muted-foreground">{f.label}</span>}
              <span className="relative block">
                <input
                  type="text"
                  inputMode={f.decimals ? "decimal" : "numeric"}
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-label={def.fields.length > 1 ? `${def.title} ${f.label}` : def.title}
                  aria-invalid={error ? true : undefined}
                  placeholder={f.placeholder}
                  value={drafts[f.key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(f.decimals ? /[^\d.]/g : /\D/g, "");
                    setDrafts((prev) => ({ ...prev, [f.key]: v }));
                    schedule();
                  }}
                  onBlur={() => {
                    if (timer.current) schedule(0);
                  }}
                  className={cn(
                    "h-14 w-full min-w-0 rounded-xl border bg-background pr-14 pl-3.5 text-2xl font-semibold tabular-nums transition-colors outline-none placeholder:font-normal placeholder:text-muted-foreground/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                    error ? "border-danger ring-3 ring-danger/15" : "border-input",
                  )}
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">
                  {def.unit}
                </span>
              </span>
              {error && <span className="text-xs font-medium text-danger">{error}</span>}
            </label>
          </div>
        ))}
      </div>

      {def.id === "sugar" && (
        <div role="radiogroup" aria-label="Sugar test type" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {SUGAR_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={sugarType === t}
              onClick={() => {
                setSugarType(t);
                latest.current = { drafts, sugarType: t };
                schedule(300);
              }}
              className={cn(
                "h-10 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                sugarType === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SUGAR_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {def.normal && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            Normal: {def.normal(sugarType).replace(/^Below/, "below")}
            {def.unit === "%" ? "%" : ` ${def.unit}`}
          </span>
          {assessment && (
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 font-semibold ring-1 ring-inset",
                vitalToneClass(assessment),
              )}
            >
              {assessment.label}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/** Vitals capture: one card per vital, booked tests first, autosaved to PUT /vitals. */
export function VitalsPanel({ booking, onSaved }: { booking: Booking; onSaved: (b: Booking) => void }) {
  const booked = (c: CardDef) => Boolean(c.code && booking.serviceCodes.includes(c.code));
  const primary = CARDS.filter(booked);
  const optional = CARDS.filter((c) => !booked(c));
  return (
    <div className="flex flex-col gap-3">
      {primary.map((c) => (
        <VitalCard key={c.id} def={c} booked booking={booking} onSaved={onSaved} />
      ))}
      {optional.length > 0 && (
        <>
          <p className="pt-2 text-[13px] font-medium text-muted-foreground">
            Also record if needed
          </p>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            {optional.map((c) => (
              <VitalCard key={c.id} def={c} booked={false} booking={booking} onSaved={onSaved} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
