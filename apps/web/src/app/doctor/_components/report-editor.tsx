"use client";

import { useId, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  Check,
  ChevronDown,
  CloudOff,
  FilePenLine,
  Loader2,
  PhoneOff,
  Pill,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { firstName, relative } from "@/lib/format";
import { populated, type Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ADVICE_TEMPLATES,
  DIAGNOSIS_PICKS,
  FOLLOW_UP_PICKS,
  FREQUENCIES,
  MEDICINES,
  suggestedDiagnoses,
} from "./clinical";
import { useNow } from "./hooks";
import { newRow, type ReportDraft, type RxRow, type SaveState } from "./use-report-draft";
import { vitalRows } from "./vitals";

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

function FieldLabel({
  htmlFor,
  children,
  action,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {children}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </label>
      {action}
    </div>
  );
}

function Chip({
  active,
  suggested,
  onClick,
  children,
}: {
  active?: boolean;
  suggested?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : suggested
            ? "border-saffron/60 bg-saffron/10 text-saffron-foreground hover:bg-saffron/20"
            : "border-border bg-background text-foreground/80 hover:border-primary/40 hover:bg-secondary hover:text-secondary-foreground",
      )}
    >
      {suggested && !active && <Sparkles className="size-3 text-warning" aria-label="Suggested from vitals" />}
      {active && <Check className="size-3" />}
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const now = useNow(15_000, state.kind === "saved");
  void now;
  switch (state.kind) {
    case "saving":
      return (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Saving draft
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Check className="size-3.5 text-success" /> Draft saved {relative(state.at)}
        </span>
      );
    case "dirty":
      return <span className="text-muted-foreground">Unsaved changes</span>;
    case "error":
      return (
        <span className="flex items-center gap-1.5 text-destructive">
          <CloudOff className="size-3.5" /> {state.message}
        </span>
      );
    default:
      return <span className="text-muted-foreground">Drafts save automatically</span>;
  }
}

const selectClass =
  "h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-card pr-7 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const inputClass = "h-9 bg-card";

// ---------------------------------------------------------------------------
// Prescription
// ---------------------------------------------------------------------------

const RX_GRID =
  "md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,0.9fr)_96px_minmax(0,0.9fr)_minmax(0,1.3fr)_36px] md:items-center md:gap-2";

function RxEditor({ rows, onChange, listId }: { rows: RxRow[]; onChange: (rows: RxRow[]) => void; listId: string }) {
  const update = (key: string, patch: Partial<RxRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r.key !== key));
  const add = () => onChange([...rows, newRow()]);

  return (
    <div>
      <datalist id={listId}>
        {MEDICINES.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      {rows.length > 0 && (
        <div className={cn("hidden px-1 pb-1.5 text-[11px] font-semibold text-muted-foreground", RX_GRID)}>
          <span>Medicine</span>
          <span>Dosage</span>
          <span>Frequency</span>
          <span>Duration</span>
          <span>Notes</span>
          <span />
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className={cn(
              "grid grid-cols-2 gap-2 rounded-xl border bg-muted/25 p-2.5 md:rounded-none md:border-0 md:bg-transparent md:p-0",
              RX_GRID,
            )}
          >
            <Input
              aria-label={`Medicine ${i + 1}`}
              list={listId}
              value={r.medicine}
              autoFocus={!r.medicine && i === rows.length - 1 && rows.length > 0}
              placeholder="Search medicine"
              onChange={(e) => update(r.key, { medicine: e.target.value })}
              className={cn(inputClass, "col-span-2 md:col-span-1")}
            />
            <Input
              aria-label="Dosage"
              value={r.dosage}
              placeholder="1 tab"
              onChange={(e) => update(r.key, { dosage: e.target.value })}
              className={inputClass}
            />
            <div className="relative min-w-0">
              <select
                aria-label="Frequency"
                value={r.frequency}
                onChange={(e) => update(r.key, { frequency: e.target.value })}
                className={selectClass}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value} title={f.hint}>
                    {f.label}
                  </option>
                ))}
                {r.frequency && !FREQUENCIES.some((f) => f.value === r.frequency) && (
                  <option value={r.frequency}>{r.frequency}</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Input
              aria-label="Duration"
              value={r.duration}
              placeholder="30 days"
              onChange={(e) => update(r.key, { duration: e.target.value })}
              className={inputClass}
            />
            <Input
              aria-label="Notes"
              value={r.notes}
              placeholder="After food"
              onChange={(e) => update(r.key, { notes: e.target.value })}
              className={cn(inputClass, "md:col-span-1")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${r.medicine || "medicine"}`}
              onClick={() => remove(r.key)}
              className="size-9 justify-self-end text-muted-foreground hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-secondary/50 hover:text-primary"
        >
          <Plus className="size-4" /> Add a medicine
        </button>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={add} className="mt-2 text-primary hover:text-primary">
          <Plus /> Add medicine
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advice
// ---------------------------------------------------------------------------

function AdviceEditor({ advice, onChange }: { advice: string[]; onChange: (a: string[]) => void }) {
  const [text, setText] = useState("");
  const id = useId();
  const add = (value: string) => {
    const v = value.trim();
    if (!v || advice.some((a) => a.toLowerCase() === v.toLowerCase())) return;
    onChange([...advice, v]);
  };
  const remaining = ADVICE_TEMPLATES.filter((t) => !advice.some((a) => a.toLowerCase() === t.toLowerCase()));
  return (
    <div>
      <FieldLabel htmlFor={id}>Advice</FieldLabel>
      {advice.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1.5">
          {advice.map((a, i) => (
            <li
              key={`${a}-${i}`}
              className="group/adv flex items-start gap-2 rounded-lg border bg-card py-1.5 pr-1.5 pl-3 text-sm"
            >
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="flex-1 leading-relaxed">{a}</span>
              <button
                type="button"
                aria-label={`Remove "${a}"`}
                onClick={() => onChange(advice.filter((_, j) => j !== i))}
                className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
          setText("");
        }}
        className="flex gap-2"
      >
        <Input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type advice and press Enter"
          className={inputClass}
        />
        <Button type="submit" variant="outline" size="lg" disabled={!text.trim()} className="h-9 shrink-0">
          <Plus /> Add
        </Button>
      </form>
      {remaining.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {remaining.map((t) => (
            <Chip key={t} onClick={() => add(t)}>
              <Plus className="-ml-0.5 size-3" />
              {t}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Findings text
// ---------------------------------------------------------------------------

function findingsText(booking: Booking): string {
  const parts: string[] = [];
  const rows = vitalRows(booking.vitals).filter((r) => r.value !== null);
  if (rows.length) {
    parts.push(
      `Vitals: ${rows
        .map(
          (r) =>
            `${r.label} ${r.value}${/^[%°]/.test(r.unit) ? "" : " "}${r.unit}${r.assessment && r.assessment.level !== "normal" ? ` (${r.assessment.label.toLowerCase()})` : ""}`,
        )
        .join(", ")}.`,
    );
  }
  if (booking.ecg) {
    parts.push(
      `ECG: ${booking.ecg.interpretation || `${booking.ecg.rhythm} at ${booking.ecg.heartRate} bpm.`}`.replace(
        /\.?$/,
        ".",
      ),
    );
  }
  if (booking.stethoscope?.findings) parts.push(`Auscultation: ${booking.stethoscope.findings}`.replace(/\.?$/, "."));
  if (booking.notes?.trim()) parts.push(`Presenting concern: ${booking.notes.trim()}`.replace(/\.?$/, "."));
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function ReportEditor({ booking, report }: { booking: Booking; report: ReportDraft }) {
  const { draft, setDraft, saveState, canDraft, canPublish, flush, publish, endCall, busy } = report;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState(false);
  const diagnosisRef = useRef<HTMLInputElement>(null);
  const ids = { diagnosis: useId(), summary: useId(), followUp: useId(), rx: useId() };
  const suggestions = suggestedDiagnoses(booking);
  const customer = populated(booking.customer);
  const inConsult = booking.status === "consult";
  const rxCount = draft.prescription.filter((r) => r.medicine.trim()).length;

  const requestPublish = () => {
    if (!draft.diagnosis.trim()) {
      setDiagnosisError(true);
      diagnosisRef.current?.focus();
      return;
    }
    setConfirmOpen(true);
  };

  const confirmPublish = async () => {
    const ok = await publish();
    if (ok) setConfirmOpen(false);
  };

  return (
    <section className="rounded-2xl border bg-card shadow-soft" aria-label="Report">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary">
            <FilePenLine className="size-4" />
          </span>
          <div>
            <h2 className="text-base leading-tight font-semibold">Consult report</h2>
            <p className="text-xs text-muted-foreground">
              Shared with {customer ? firstName(customer.name) : "the patient"} in the Nivar app when you publish.
            </p>
          </div>
        </div>
        {!canDraft && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 ring-inset">
            Drafts save once tests begin
          </span>
        )}
      </div>

      <div className="grid gap-x-8 gap-y-6 px-5 py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: diagnosis + summary */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <FieldLabel htmlFor={ids.diagnosis} hint="Required">
              Diagnosis
            </FieldLabel>
            <Input
              id={ids.diagnosis}
              ref={diagnosisRef}
              value={draft.diagnosis}
              aria-invalid={diagnosisError || undefined}
              placeholder="e.g. Stage 1 hypertension"
              onChange={(e) => {
                setDiagnosisError(false);
                const value = e.target.value;
                setDraft((d) => ({ ...d, diagnosis: value }));
              }}
              className="h-10 bg-card text-[15px] font-medium"
            />
            {diagnosisError && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" /> Add a diagnosis before publishing.
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {DIAGNOSIS_PICKS.map((d) => (
                <Chip
                  key={d}
                  active={draft.diagnosis === d}
                  suggested={suggestions.has(d)}
                  onClick={() => {
                    setDiagnosisError(false);
                    setDraft((x) => ({ ...x, diagnosis: x.diagnosis === d ? "" : d }));
                  }}
                >
                  {d}
                </Chip>
              ))}
            </div>
            {suggestions.size > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3 text-warning" /> Highlighted picks match the recorded vitals and ECG.
              </p>
            )}
          </div>

          <div>
            <FieldLabel
              htmlFor={ids.summary}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary"
                  onClick={() => {
                    const text = findingsText(booking);
                    if (!text) return;
                    setDraft((d) => ({ ...d, summary: d.summary.trim() ? `${d.summary.trim()}\n${text}` : text }));
                  }}
                >
                  <Wand2 /> Insert findings
                </Button>
              }
            >
              Clinical summary
            </FieldLabel>
            <Textarea
              id={ids.summary}
              value={draft.summary}
              placeholder="History, examination findings and your assessment"
              onChange={(e) => {
                const value = e.target.value;
                setDraft((d) => ({ ...d, summary: value }));
              }}
              className="min-h-[132px] bg-card leading-relaxed"
            />
          </div>
        </div>

        {/* Right: advice + follow-up */}
        <div className="flex min-w-0 flex-col gap-5">
          <AdviceEditor advice={draft.advice} onChange={(advice) => setDraft((d) => ({ ...d, advice }))} />
          <div>
            <FieldLabel htmlFor={ids.followUp}>
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="size-3.5 text-primary" /> Follow-up
              </span>
            </FieldLabel>
            <Input
              id={ids.followUp}
              value={draft.followUp}
              placeholder="e.g. Review in 2 weeks with home BP log"
              onChange={(e) => {
                const value = e.target.value;
                setDraft((d) => ({ ...d, followUp: value }));
              }}
              className={inputClass}
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {FOLLOW_UP_PICKS.map((f) => (
                <Chip key={f} active={draft.followUp === f} onClick={() => setDraft((d) => ({ ...d, followUp: f }))}>
                  {f}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Prescription, full width */}
        <div className="min-w-0 lg:col-span-2">
          <FieldLabel hint={rxCount ? `${rxCount} ${rxCount === 1 ? "medicine" : "medicines"}` : undefined}>
            <span className="inline-flex items-center gap-1.5">
              <Pill className="size-3.5 text-primary" /> Prescription
            </span>
          </FieldLabel>
          <RxEditor
            rows={draft.prescription}
            listId={ids.rx}
            onChange={(prescription) => setDraft((d) => ({ ...d, prescription }))}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t bg-card/95 px-5 py-3.5 backdrop-blur-md">
        <div className="min-w-0 text-xs">
          <SaveIndicator state={saveState} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {inConsult && (
            <Button variant="ghost" size="lg" onClick={() => void endCall()} disabled={busy !== null} className="px-3">
              {busy === "ending" ? <Loader2 className="animate-spin" /> : <PhoneOff />}
              End call, write report later
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={() => void flush()}
            disabled={!canDraft || busy !== null || saveState.kind === "saving"}
            className="px-3"
          >
            Save draft
          </Button>
          <Button
            size="lg"
            onClick={requestPublish}
            disabled={!canPublish || busy !== null}
            title={canPublish ? undefined : "You can publish once the video consult has started."}
            className="px-4"
          >
            <Send />
            {inConsult ? "End consult and publish report" : "Publish report"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => busy === null && setConfirmOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Publish report for {booking.patient.name}?</DialogTitle>
            <DialogDescription>
              {inConsult ? "This ends the consult and sends" : "This sends"} the report and prescription to{" "}
              {customer ? customer.name : "the patient"} in the Nivar app. It can&apos;t be edited after publishing.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl bg-muted/50 p-3.5 text-sm">
            <dt className="text-muted-foreground">Diagnosis</dt>
            <dd className="font-medium">{draft.diagnosis.trim()}</dd>
            <dt className="text-muted-foreground">Prescription</dt>
            <dd>{rxCount ? `${rxCount} ${rxCount === 1 ? "medicine" : "medicines"}` : "None"}</dd>
            <dt className="text-muted-foreground">Advice</dt>
            <dd>
              {draft.advice.length
                ? `${draft.advice.length} ${draft.advice.length === 1 ? "point" : "points"}`
                : "None"}
            </dd>
            <dt className="text-muted-foreground">Follow-up</dt>
            <dd>{draft.followUp.trim() || "None"}</dd>
          </dl>
          {saveState.kind === "error" && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" /> {saveState.message}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="lg" disabled={busy !== null} />}>
              Keep editing
            </DialogClose>
            <Button size="lg" onClick={() => void confirmPublish()} disabled={busy !== null} className="px-4">
              {busy === "publishing" ? <Loader2 className="animate-spin" /> : <Send />}
              {busy === "publishing" ? "Publishing" : "Publish report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
