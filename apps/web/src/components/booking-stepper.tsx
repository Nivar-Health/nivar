import { Check, X } from "lucide-react";
import { BOOKING_STEPS, STATUS_META, formatDateTime, formatTime } from "@/lib/format";
import type { Booking, BookingStatus, TimelineEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "upcoming" | "cancelled";

interface StepView {
  key: string;
  label: string;
  longLabel: string;
  icon: (typeof BOOKING_STEPS)[number]["icon"];
  state: StepState;
  at?: string;
  note?: string;
  by?: string;
  live: boolean;
}

function lastEntry(timeline: TimelineEntry[], status: BookingStatus) {
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].status === status) return timeline[i];
  }
  return undefined;
}

function buildSteps(booking: Pick<Booking, "status" | "timeline" | "createdAt">): StepView[] {
  const timeline = booking.timeline ?? [];
  const entryFor = (status: BookingStatus) =>
    lastEntry(timeline, status) ??
    (status === "pending_payment" && booking.createdAt
      ? { status, at: booking.createdAt }
      : undefined);

  if (booking.status === "cancelled") {
    // Show the journey up to the furthest step reached, then the cancellation.
    let reached = 0;
    for (const entry of timeline) {
      const idx = STATUS_META[entry.status]?.step ?? -1;
      if (idx > reached) reached = idx;
    }
    const steps: StepView[] = BOOKING_STEPS.slice(0, reached + 1).map((s) => {
      const e = entryFor(s.status);
      return { ...s, key: s.status, state: "done", at: e?.at, note: e?.note, by: e?.by, live: false };
    });
    const c = lastEntry(timeline, "cancelled");
    steps.push({
      key: "cancelled",
      label: "Cancelled",
      longLabel: "Booking cancelled",
      icon: X,
      state: "cancelled",
      at: c?.at,
      note: c?.note,
      by: c?.by,
      live: false,
    });
    return steps;
  }

  const currentIdx = STATUS_META[booking.status]?.step ?? 0;
  const isComplete = booking.status === "completed";
  return BOOKING_STEPS.map((s, idx) => {
    const e = idx <= currentIdx ? entryFor(s.status) : undefined;
    const state: StepState =
      idx < currentIdx || (isComplete && idx === currentIdx)
        ? "done"
        : idx === currentIdx
          ? "current"
          : "upcoming";
    return {
      ...s,
      key: s.status,
      state,
      at: e?.at,
      note: e?.note,
      by: e?.by,
      live: state === "current" && STATUS_META[booking.status].live,
    };
  });
}

function StepNode({ step, size }: { step: StepView; size: "sm" | "md" }) {
  const Icon = step.icon;
  const dims = size === "sm" ? "size-7" : "size-8";
  const iconSize = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span className={cn("relative z-10 grid shrink-0 place-items-center rounded-full", dims)}>
      {step.state === "current" && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full bg-primary/25",
            step.live ? "animate-pulse-ring" : "scale-125 opacity-60",
          )}
        />
      )}
      <span
        className={cn(
          "relative grid size-full place-items-center rounded-full transition-colors",
          step.state === "done" && "bg-primary text-primary-foreground",
          step.state === "current" &&
            "bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]",
          step.state === "upcoming" && "border border-border bg-card text-muted-foreground/70",
          step.state === "cancelled" && "bg-destructive text-white",
        )}
      >
        {step.state === "done" ? (
          <Check className={iconSize} strokeWidth={2.75} aria-hidden />
        ) : (
          <Icon className={iconSize} aria-hidden />
        )}
      </span>
    </span>
  );
}

/**
 * Journey of a booking from "Booked" to "Done", with timestamps from the
 * timeline. Horizontal when its container is wide (>= 36rem), vertical
 * otherwise; force either with `orientation`.
 */
export function BookingStepper({
  booking,
  orientation = "auto",
  className,
}: {
  booking: Pick<Booking, "status" | "timeline" | "createdAt">;
  orientation?: "auto" | "horizontal" | "vertical";
  className?: string;
}) {
  const steps = buildSteps(booking);
  const showHorizontal = orientation !== "vertical";
  const showVertical = orientation !== "horizontal";

  return (
    <div className={cn("@container w-full", className)}>
      {showHorizontal && (
        <ol
          aria-label="Booking progress"
          className={cn(
            "grid w-full",
            orientation === "auto" && "hidden @xl:grid",
          )}
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, idx) => {
            const prevReached = idx > 0 && step.state !== "upcoming";
            const nextReached =
              idx < steps.length - 1 && steps[idx + 1].state !== "upcoming";
            return (
              <li
                key={step.key}
                className="relative flex min-w-0 flex-col items-center px-0.5 text-center"
                aria-current={step.state === "current" ? "step" : undefined}
              >
                {idx > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-4 left-0 h-0.5 w-1/2 -translate-y-1/2",
                      prevReached ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                {idx < steps.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-4 right-0 h-0.5 w-1/2 -translate-y-1/2",
                      nextReached ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <StepNode step={step} size="md" />
                <span
                  className={cn(
                    "mt-2 text-[11px] leading-tight font-medium text-balance",
                    step.state === "upcoming" && "text-muted-foreground",
                    step.state === "current" && "text-primary",
                    step.state === "cancelled" && "text-destructive",
                  )}
                >
                  {step.label}
                </span>
                <span
                  className="tabular mt-0.5 min-h-[14px] text-[10.5px] leading-tight text-muted-foreground"
                  title={step.at ? formatDateTime(step.at) : undefined}
                >
                  {step.at ? formatTime(step.at) : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {showVertical && (
        <ol
          aria-label="Booking progress"
          className={cn("flex flex-col", orientation === "auto" && "@xl:hidden")}
        >
          {steps.map((step, idx) => {
            const last = idx === steps.length - 1;
            const nextReached = !last && steps[idx + 1].state !== "upcoming";
            return (
              <li
                key={step.key}
                className="relative flex gap-3.5"
                aria-current={step.state === "current" ? "step" : undefined}
              >
                {!last && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-7 bottom-0 left-[13px] w-0.5",
                      nextReached ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <StepNode step={step} size="sm" />
                <div className={cn("min-w-0 flex-1 pt-1", last ? "pb-0" : "pb-5")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span
                      className={cn(
                        "text-sm leading-5 font-medium",
                        step.state === "upcoming" && "text-muted-foreground",
                        step.state === "current" && "text-primary",
                        step.state === "cancelled" && "text-destructive",
                      )}
                    >
                      {step.longLabel}
                    </span>
                    {step.at && (
                      <span className="tabular text-xs text-muted-foreground">
                        {formatDateTime(step.at)}
                      </span>
                    )}
                  </div>
                  {(step.note || (step.by && step.state !== "upcoming")) && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {step.note}
                      {step.note && step.by ? " · " : ""}
                      {step.by ? `by ${step.by}` : ""}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
