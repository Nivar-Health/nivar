"use client";

import { useCallback, useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, CircleAlert, Gauge, Droplet, HeartPulse, LoaderCircle, RotateCw, Scale, Thermometer, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import {
  SUGAR_TYPE_LABEL,
  VITAL_INFO,
  sugarNormalRange,
  vitalAssessment,
  vitalToneClass,
  type VitalAssessment,
} from "@/lib/format";
import { useOnReconnect } from "@/lib/socket";
import type { Booking, ServiceCode, SugarType, Vitals } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The same sign the doctor's views use for "not recorded", so an empty field never looks like a reading. */
const EMPTY = "--";

type NumKey = Exclude<keyof Vitals, "sugarType" | "recordedAt">;

interface FieldDef {
  key: NumKey;
  label: string;
  min: number;
  max: number;
  decimals?: boolean;
  /** Shown with the range when a value is out of it. */
  example?: string;
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
      },
      {
        key: "bpDiastolic",
        label: "Diastolic",
        min: 30,
        max: 180,
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
    fields: [{ key: "sugar", label: "Glucose", min: 20, max: 700 }],
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
    fields: [{ key: "spo2", label: "SpO2", min: 50, max: 100 }],
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
        example: "98.6",
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
      },
    ],
  },
];

const SUGAR_TYPES: SugarType[] = ["fasting", "random", "pp"];
const AUTOSAVE_MS = 900;
/** After a failed save: try again after 5 s, 15 s, then every 30 s (and at once when the network returns). */
const RETRY_MS = [5000, 15000, 30000];

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function toDraft(n: number | undefined | null): string {
  return n == null ? "" : String(n);
}

function rangeError(f: FieldDef, unit: string): string {
  const range = unit === "%" ? `${f.min} and ${f.max}%` : `${f.min} and ${f.max} ${unit}`;
  return `Should be between ${range}${f.example ? ` (for example ${f.example})` : ""}`;
}

function parseField(raw: string, f: FieldDef, unit: string): { value: number | null; error: string | null } {
  const t = raw.trim();
  if (!t) return { value: null, error: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: "Enter a number" };
  if (n < f.min || n > f.max) return { value: null, error: rangeError(f, unit) };
  return {
    value: f.decimals ? Math.round(n * 10) / 10 : Math.round(n),
    error: null,
  };
}

function SaveIndicator({ state }: { state: SaveState }) {
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
      <span className="flex items-center gap-1 text-xs font-medium text-danger">
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
  onFailedChange,
}: {
  def: CardDef;
  booked: boolean;
  booking: Booking;
  onSaved: (b: Booking) => void;
  onFailedChange?: (title: string, failed: boolean) => void;
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
  // A range error waits until the nurse leaves the field (or pauses on a wrong value), so a
  // half-typed "1" on the way to "138" is never called wrong.
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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
    ...parseField(drafts[f.key] ?? "", f, def.unit),
  }));
  const values: Partial<Record<NumKey, number>> = {};
  for (const p of parsed) if (p.value != null) values[p.f.key] = p.value;
  const assessment = def.assess?.(values, sugarType) ?? null;

  const save = useCallback(async () => {
    timer.current = null;
    const { drafts: d, sugarType: st } = latest.current;
    const patch: Record<string, number | string | null> = {};
    const wrong: string[] = [];
    for (const f of def.fields) {
      const { value, error } = parseField(d[f.key] ?? "", f, def.unit);
      if (error) wrong.push(f.key);
      else if (value !== savedRef.current[f.key]) patch[f.key] = value;
    }
    if (wrong.length) {
      setChecked((prev) => ({ ...prev, ...Object.fromEntries(wrong.map((k) => [k, true])) }));
      setState("idle");
      return;
    }
    const sugarValue = def.id === "sugar" ? parseField(d.sugar ?? "", def.fields[0], def.unit).value : null;
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

  // A failed save is retried on its own: on a timer, when the phone is back online and when the
  // live connection returns. The reading stays in the field the whole time.
  const attempts = useRef(0);
  useEffect(() => {
    if (state !== "error") {
      if (state === "saved") attempts.current = 0;
      return;
    }
    const delay = RETRY_MS[Math.min(attempts.current, RETRY_MS.length - 1)];
    const t = window.setTimeout(() => {
      attempts.current += 1;
      void save();
    }, delay);
    const onOnline = () => void save();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", onOnline);
    };
  }, [state, save]);
  useOnReconnect(() => {
    if (state === "error") void save();
  });

  const reportFailed = useEffectEvent((failed: boolean) => onFailedChange?.(def.title, failed));
  const failed = state === "error";
  useEffect(() => {
    reportFailed(failed);
  }, [failed]);
  useEffect(() => () => reportFailed(false), []);

  const shownErrors = parsed.map((p) => (p.error && checked[p.f.key] ? p.error : null));
  const hasError = parsed.some((p) => p.error);
  const showState: SaveState = hasError ? "idle" : state;

  const pickSugarType = (t: SugarType) => {
    setSugarType(t);
    latest.current = { drafts, sugarType: t };
    schedule(300);
  };

  // Radio group keys: arrows move the choice, as in a native radio group.
  const onSugarKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + SUGAR_TYPES.length) % SUGAR_TYPES.length;
    pickSugarType(SUGAR_TYPES[next]);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };

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
        <span role="status">
          <SaveIndicator state={showState} />
        </span>
      </div>

      <div className="flex items-start gap-2">
        {parsed.map(({ f }, i) => {
          const error = shownErrors[i];
          return (
            <div key={f.key} className="flex min-w-0 flex-1 items-start gap-2">
              {i > 0 && (
                <span
                  className={cn("text-2xl font-light text-muted-foreground", def.fields.length > 1 ? "pt-8" : "pt-3")}
                >
                  /
                </span>
              )}
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
                    aria-describedby={error ? `${uid}-${f.key}-e` : undefined}
                    placeholder={EMPTY}
                    value={drafts[f.key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(f.decimals ? /[^\d.]/g : /\D/g, "");
                      setDrafts((prev) => ({ ...prev, [f.key]: v }));
                      // A wrong value stays flagged until it is right, then the flag clears at once.
                      if (!parseField(v, f, def.unit).error) setChecked((prev) => ({ ...prev, [f.key]: false }));
                      schedule();
                    }}
                    onBlur={() => {
                      if (drafts[f.key]) setChecked((prev) => ({ ...prev, [f.key]: true }));
                      if (timer.current) schedule(0);
                    }}
                    className={cn(
                      "h-14 w-full min-w-0 scroll-mb-40 rounded-xl border bg-background pr-14 pl-3.5 text-2xl font-semibold tabular-nums transition-colors outline-none placeholder:font-normal placeholder:text-muted-foreground/60 focus-visible:border-ring focus-ring",
                      error ? "border-danger ring-3 ring-danger/15" : "border-input",
                    )}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">
                    {def.unit}
                  </span>
                </span>
                {error && (
                  <span id={`${uid}-${f.key}-e`} className="text-[13px] leading-snug font-medium text-danger">
                    {error}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>

      {showState === "error" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-danger/5 px-3 py-2.5 ring-1 ring-danger/25 ring-inset">
          <CircleAlert className="size-4 shrink-0 self-start text-danger mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1 basis-40 text-sm">
            <p>
              <span className="font-semibold text-danger">Not saved.</span> {saveError}
            </p>
            <p className="text-muted-foreground">We keep trying while this page is open.</p>
          </div>
          <Button
            variant="outline"
            className="ml-auto h-11 shrink-0 rounded-xl px-4 text-sm font-semibold"
            onClick={() => void save()}
          >
            <RotateCw /> Try again
          </Button>
        </div>
      )}

      {def.id === "sugar" && (
        <div role="radiogroup" aria-label="Sugar test type" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {SUGAR_TYPES.map((t, i) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={sugarType === t}
              tabIndex={sugarType === t ? 0 : -1}
              onClick={() => pickSugarType(t)}
              onKeyDown={(e) => onSugarKey(e, i)}
              className={cn(
                "h-11 rounded-lg text-sm font-medium transition-colors outline-none focus-ring",
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

function isBooked(c: CardDef, booking: Booking): boolean {
  return Boolean(c.code && booking.serviceCodes.includes(c.code));
}

/** Titles of the vitals that were not booked, for the "Add another reading" row. */
export function optionalVitalNames(booking: Booking): string[] {
  return CARDS.filter((c) => !isBooked(c, booking)).map((c) => c.title);
}

/** Whether any vital that was not booked already has a value (so its cards start open). */
export function hasOptionalVitals(booking: Booking): boolean {
  const v = booking.vitals ?? {};
  return CARDS.some((c) => !isBooked(c, booking) && c.fields.some((f) => v[f.key] != null));
}

/**
 * Vitals capture: one card per vital, autosaved to PUT /vitals. `group` picks the booked vitals or
 * the optional ones, so the screen can put booked devices between them.
 */
export function VitalsPanel({
  booking,
  onSaved,
  group,
  onFailedChange,
}: {
  booking: Booking;
  onSaved: (b: Booking) => void;
  group: "booked" | "optional";
  /** Told when a card's save fails or recovers, by card title. */
  onFailedChange?: (title: string, failed: boolean) => void;
}) {
  const booked = group === "booked";
  const cards = CARDS.filter((c) => isBooked(c, booking) === booked);
  if (cards.length === 0) return null;
  return (
    <div className={cn("grid grid-cols-1 gap-3", !booked && "min-[480px]:grid-cols-2")}>
      {cards.map((c) => (
        <VitalCard
          key={c.id}
          def={c}
          booked={booked}
          booking={booking}
          onSaved={onSaved}
          onFailedChange={onFailedChange}
        />
      ))}
    </div>
  );
}
