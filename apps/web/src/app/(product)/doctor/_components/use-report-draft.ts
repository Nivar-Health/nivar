"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Booking, BookingStatus, Report } from "@/lib/types";

export interface RxRow {
  key: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
}

export interface Draft {
  diagnosis: string;
  summary: string;
  prescription: RxRow[];
  advice: string[];
  followUp: string;
}

export type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const DRAFT_STATUSES: BookingStatus[] = ["testing", "consult", "reporting"];
const PUBLISH_STATUSES: BookingStatus[] = ["consult", "reporting"];
const AUTOSAVE_MS = 1200;

let rowSeq = 0;
export function newRow(partial: Partial<RxRow> = {}): RxRow {
  rowSeq += 1;
  return { key: `rx-${rowSeq}`, medicine: "", dosage: "", frequency: "OD", duration: "", notes: "", ...partial };
}

function fromReport(report: Report | null | undefined): Draft {
  return {
    diagnosis: report?.diagnosis ?? "",
    summary: report?.summary ?? "",
    prescription: (report?.prescription ?? []).map((p) =>
      newRow({
        medicine: p.medicine ?? "",
        dosage: p.dosage ?? "",
        frequency: p.frequency ?? "",
        duration: p.duration ?? "",
        notes: p.notes ?? "",
      }),
    ),
    advice: report?.advice ?? [],
    followUp: report?.followUp ?? "",
  };
}

function toPayload(d: Draft) {
  return {
    diagnosis: d.diagnosis.trim(),
    summary: d.summary.trim(),
    prescription: d.prescription
      .filter((r) => r.medicine.trim())
      .map((r) => ({
        medicine: r.medicine.trim(),
        dosage: r.dosage.trim(),
        frequency: r.frequency.trim(),
        duration: r.duration.trim(),
        notes: r.notes.trim(),
      })),
    advice: d.advice.map((a) => a.trim()).filter(Boolean),
    followUp: d.followUp.trim(),
  };
}

export interface ReportDraft {
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  saveState: SaveState;
  canDraft: boolean;
  canPublish: boolean;
  /** Save now if there are unsaved changes. Resolves false on failure. */
  flush: () => Promise<boolean>;
  publish: () => Promise<boolean>;
  endCall: () => Promise<boolean>;
  busy: "publishing" | "ending" | null;
}

/**
 * Local report draft for a booking with debounced autosave (PUT /report).
 * Initialised once from the booking; later socket updates never clobber typing.
 */
export function useReportDraft(booking: Booking, setBooking: (b: Booking) => void): ReportDraft {
  const [draft, setDraftState] = useState<Draft>(() => fromReport(booking.report));
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [busy, setBusy] = useState<ReportDraft["busy"]>(null);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  const statusRef = useRef(booking.status);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    statusRef.current = booking.status;
  }, [booking.status]);

  const canDraft = DRAFT_STATUSES.includes(booking.status);
  const canPublish = PUBLISH_STATUSES.includes(booking.status);

  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (version.current === savedVersion.current) return true;
    if (!DRAFT_STATUSES.includes(statusRef.current)) return false;
    const target = version.current;
    setSaveState({ kind: "saving" });
    const run = api
      .put<{ booking: Booking }>(`/bookings/${booking.id}/report`, toPayload(draftRef.current))
      .then(({ booking: next }) => {
        savedVersion.current = Math.max(savedVersion.current, target);
        setBooking(next);
        setSaveState(version.current === savedVersion.current ? { kind: "saved", at: Date.now() } : { kind: "dirty" });
        return true;
      })
      .catch((err) => {
        setSaveState({ kind: "error", message: errorMessage(err, "Couldn't save the draft.") });
        return false;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = run;
    return run;
  }, [booking.id, setBooking]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, AUTOSAVE_MS);
  }, [save]);

  const setDraft = useCallback(
    (update: (d: Draft) => Draft) => {
      setDraftState((d) => update(d));
      version.current += 1;
      setSaveState({ kind: "dirty" });
      if (DRAFT_STATUSES.includes(statusRef.current)) schedule();
    },
    [schedule],
  );

  // A booking that becomes draftable (e.g. testing starts) saves pending edits.
  useEffect(() => {
    if (canDraft && version.current !== savedVersion.current && !timer.current) schedule();
  }, [canDraft, schedule]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return save();
  }, [save]);

  const publish = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    setBusy("publishing");
    try {
      const { booking: next } = await api.put<{ booking: Booking }>(`/bookings/${booking.id}/report`, {
        ...toPayload(draftRef.current),
        publish: true,
      });
      savedVersion.current = version.current;
      setSaveState({ kind: "saved", at: Date.now() });
      setBooking(next);
      return true;
    } catch (err) {
      setSaveState({ kind: "error", message: errorMessage(err, "Couldn't publish the report.") });
      return false;
    } finally {
      setBusy(null);
    }
  }, [booking.id, setBooking]);

  const endCall = useCallback(async () => {
    setBusy("ending");
    try {
      await flush();
      const { booking: next } = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/status`, {
        status: "reporting",
      });
      setBooking(next);
      return true;
    } catch (err) {
      setSaveState({ kind: "error", message: errorMessage(err, "Couldn't end the consult.") });
      return false;
    } finally {
      setBusy(null);
    }
  }, [booking.id, flush, setBooking]);

  return { draft, setDraft, saveState, canDraft, canPublish, flush, publish, endCall, busy };
}
