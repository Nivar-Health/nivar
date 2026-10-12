"use client";

import { useMemo } from "react";
import { Activity, HeartPulse, Stethoscope } from "lucide-react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { EcgStrip } from "@/components/live/ecg-strip";
import { StethMonitor } from "@/components/live/steth-monitor";
import type { MonitorStatus } from "@/components/live/monitor-shared";
import { formatTime } from "@/lib/format";
import type { DeviceStatusMap } from "@/lib/socket";
import type { Booking, DeviceState } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { LiveFeed } from "./hooks";
import type { EcgChunk, StethChunk } from "@/lib/device-sim";

type DeviceView = "live" | "captured" | "absent";

function monitorStatus(state: DeviceState | "idle", live: boolean): MonitorStatus | undefined {
  if (state === "connecting") return "connecting";
  if (live) return "streaming";
  if (state === "stopped") return "stopped";
  return undefined;
}

function DeviceChip({
  view,
  state,
  live,
  capturedAt,
}: {
  view: DeviceView;
  state: DeviceState | "idle";
  live: boolean;
  capturedAt?: string;
}) {
  let tone = "bg-muted text-muted-foreground ring-border";
  let label = "Not connected";
  let dot: React.ReactNode = <span className="size-1.5 rounded-full bg-muted-foreground/50" />;
  if (live) {
    tone = "bg-background text-foreground ring-border";
    label = "Streaming live";
    dot = <span className="live-dot size-1.5 text-signal" />;
  } else if (state === "connecting") {
    tone = "bg-background text-foreground ring-border";
    label = "Pairing";
    dot = <span className="size-1.5 animate-pulse rounded-full bg-saffron" />;
  } else if (view === "captured") {
    tone = "bg-background text-foreground ring-border";
    label = capturedAt ? `Captured ${formatTime(capturedAt)}` : "Captured";
    dot = <span className="size-1.5 rounded-full bg-foreground" />;
  } else if (view === "absent") {
    label = "Not in this visit";
  }
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tone,
      )}
    >
      {dot}
      {label}
    </span>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
  chip,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  chip: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground [&_svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm leading-tight font-semibold">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {chip}
    </div>
  );
}

function Absent({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-[132px] place-items-center rounded-2xl border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ECG
// ---------------------------------------------------------------------------

export function EcgPanel({
  booking,
  feed,
  status,
}: {
  booking: Booking;
  feed: LiveFeed<EcgChunk>;
  status: DeviceStatusMap;
}) {
  const ecg = booking.ecg;
  const captured = Boolean(ecg?.samples?.length);
  const state = status.ecg;
  const view: DeviceView =
    feed.live || state === "connecting" || state === "streaming"
      ? "live"
      : captured
        ? "captured"
        : booking.serviceCodes.includes("ECG") || ["testing", "consult"].includes(booking.status)
          ? "live"
          : "absent";

  return (
    <div className="flex flex-col gap-3">
      <PanelHeader
        icon={<HeartPulse />}
        title="Smart ECG"
        subtitle={
          view === "captured" && ecg
            ? `${ecg.rhythm} · ${ecg.heartRate} bpm`
            : "Single lead, streamed from the patient's home"
        }
        chip={<DeviceChip view={view} state={state} live={feed.live} capturedAt={ecg?.capturedAt} />}
      />
      {view === "live" && (
        <EcgMonitor feed={feed.feed} heartRate={feed.heartRate} status={monitorStatus(state, feed.live)} height={232} />
      )}
      {view === "captured" && ecg && (
        <EcgStrip
          samples={ecg.samples}
          sampleRate={ecg.sampleRate}
          heartRate={ecg.heartRate}
          variant="brand"
          secondsPerRow={5}
          caption={ecg.capturedAt ? `Captured ${formatTime(ecg.capturedAt)}` : undefined}
        />
      )}
      {view === "absent" && <Absent>ECG is not part of this visit.</Absent>}
      {captured && ecg && (view === "captured" || ecg.interpretation) && (
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2 rounded-xl border bg-card px-3.5 py-2.5 text-[13px]">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-muted-foreground">Rhythm</span>
            <span className="font-semibold">{ecg.rhythm}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-muted-foreground">Heart rate</span>
            <span className="font-semibold tabular-nums">{ecg.heartRate} bpm</span>
          </div>
          {ecg.interpretation && (
            <div className="flex min-w-[200px] flex-1 flex-col">
              <span className="text-[11px] font-medium text-muted-foreground">
                {view === "live" ? "Last captured reading" : "Interpretation"}
              </span>
              <span className="text-foreground/90">{ecg.interpretation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stethoscope
// ---------------------------------------------------------------------------

/** Static phonocardiogram envelope, styled like the live monitor. */
function StethStrip({ samples, heartRate }: { samples: number[]; heartRate?: number }) {
  const W = 800;
  const H = 120;
  const path = useMemo(() => {
    if (!samples.length) return "";
    const cols = Math.min(W, samples.length);
    const per = samples.length / cols;
    let max = 0;
    for (const s of samples) if (Math.abs(s) > max) max = Math.abs(s);
    const scale = max > 0 ? (H / 2 - 8) / max : 0;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let c = 0; c < cols; c++) {
      let peak = 0;
      const from = Math.floor(c * per);
      const to = Math.max(from + 1, Math.floor((c + 1) * per));
      for (let i = from; i < to && i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
      const x = ((c / (cols - 1 || 1)) * W).toFixed(1);
      top.push(`${c === 0 ? "M" : "L"}${x} ${(H / 2 - peak * scale).toFixed(1)}`);
      bottom.unshift(`L${x} ${(H / 2 + peak * scale).toFixed(1)}`);
    }
    return `${top.join(" ")} ${bottom.join(" ")} Z`;
  }, [samples]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f]">
      <div className="absolute inset-0 bg-ecg-grid-dark" aria-hidden />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="relative block h-[120px] w-full"
        role="img"
        aria-label={`Captured heart sound envelope${heartRate ? `, ${heartRate} bpm` : ""}`}
      >
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="rgba(25,195,125,0.25)" strokeWidth="1" />
        <path
          d={path}
          fill="rgba(25,195,125,0.3)"
          stroke="#19c37d"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function StethPanel({
  booking,
  feed,
  status,
}: {
  booking: Booking;
  feed: LiveFeed<StethChunk>;
  status: DeviceStatusMap;
}) {
  const steth = booking.stethoscope;
  const captured = Boolean(steth?.samples?.length || steth?.findings);
  const state = status.stethoscope;
  const view: DeviceView =
    feed.live || state === "connecting" || state === "streaming"
      ? "live"
      : captured
        ? "captured"
        : booking.serviceCodes.includes("STETH") || ["testing", "consult"].includes(booking.status)
          ? "live"
          : "absent";

  return (
    <div className="flex flex-col gap-3">
      <PanelHeader
        icon={<Stethoscope />}
        title="Smart stethoscope"
        subtitle={
          view === "captured" && steth
            ? `Heart sounds · ${steth.heartRate} bpm`
            : "Tap Listen to hear the heart sounds live"
        }
        chip={<DeviceChip view={view} state={state} live={feed.live} capturedAt={steth?.capturedAt} />}
      />
      {view === "live" && (
        <StethMonitor
          feed={feed.feed}
          heartRate={feed.heartRate}
          status={monitorStatus(state, feed.live)}
          height={196}
        />
      )}
      {view === "captured" && steth && steth.samples?.length > 0 && (
        <StethStrip samples={steth.samples} heartRate={steth.heartRate} />
      )}
      {view === "absent" && <Absent>Stethoscope is not part of this visit.</Absent>}
      {steth?.findings && (
        <div className="flex items-start gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 text-[13px]">
          <Activity className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-muted-foreground">
              {view === "live" ? "Nurse's captured findings" : "Findings"}
            </span>
            <span className="text-foreground/90">{steth.findings}</span>
          </div>
        </div>
      )}
    </div>
  );
}
