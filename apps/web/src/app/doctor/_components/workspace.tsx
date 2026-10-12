"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronLeft, LayoutDashboard, Radio, ShieldAlert, Timer, Video } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { STATUS_META, formatDateTime } from "@/lib/format";
import { useBooking, useDeviceStatus, useNotifications, useSocketConnected, type DeviceStatusMap } from "@/lib/socket";
import type { Booking } from "@/lib/types";
import type { EcgChunk, StethChunk } from "@/lib/device-sim";
import { cn } from "@/lib/utils";
import { ConsultPanel } from "./consult-panel";
import { EcgPanel, StethPanel } from "./devices";
import { formatElapsed, statusAt, useLiveFeed, useNow, type LiveFeed } from "./hooks";
import { PatientColumn } from "./patient-panel";
import { ReportEditor } from "./report-editor";
import { ReportSummary } from "./report-summary";
import { useReportDraft } from "./use-report-draft";

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ConsultClock({ booking }: { booking: Booking }) {
  const inConsult = booking.status === "consult";
  const now = useNow(1000, inConsult);
  const start = statusAt(booking, "consult");
  if (!start) return null;
  if (inConsult) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-full bg-primary pr-3 pl-2.5 text-[13px] font-medium text-primary-foreground">
        <Video className="size-3.5" />
        <span className="hidden sm:inline">In consult</span>
        <span className="font-mono font-semibold tabular-nums">{formatElapsed(now - start)}</span>
      </span>
    );
  }
  const end = statusAt(booking, "reporting") ?? statusAt(booking, "completed");
  if (!end || end < start) return null;
  return (
    <span className="hidden h-8 items-center gap-2 rounded-full bg-muted px-3 text-[13px] font-medium text-muted-foreground md:inline-flex">
      <Timer className="size-3.5" />
      Consult {Math.max(1, Math.round((end - start) / 60000))} min
    </span>
  );
}

function LiveIndicator({ live }: { live: boolean }) {
  const connected = useSocketConnected();
  if (!connected) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
        <span className="size-1.5 rounded-full bg-muted-foreground/50" /> Reconnecting
      </span>
    );
  }
  if (!live) return null;
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-red-50 px-2.5 text-[11px] font-semibold tracking-[0.12em] text-red-700 ring-1 ring-red-200 ring-inset">
      <span className="live-dot size-1.5 text-danger" />
      LIVE
    </span>
  );
}

function WorkspaceHeader({ booking, live }: { booking: Booking | null; live: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <Link
          href="/doctor"
          className="flex shrink-0 items-center gap-2 rounded-lg py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" />
          <LogoMark className="size-7" />
          <span className="hidden md:inline">Consults</span>
        </Link>
        <span className="h-7 w-px shrink-0 bg-border" aria-hidden />
        {booking ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-tight font-semibold">{booking.patient.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">{booking.code}</p>
            </div>
            <StatusBadge status={booking.status} audience="staff" className="hidden sm:inline-flex" />
            <LiveIndicator live={live} />
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-8 w-40" />
          </div>
        )}
        {booking && <ConsultClock booking={booking} />}
        <UserMenu />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function WorkspaceBody({
  booking,
  setBooking,
  ecg,
  steth,
  devices,
}: {
  booking: Booking;
  setBooking: (b: Booking) => void;
  ecg: LiveFeed<EcgChunk>;
  steth: LiveFeed<StethChunk>;
  devices: DeviceStatusMap;
}) {
  const report = useReportDraft(booking, setBooking);
  const completed = booking.status === "completed";
  // Bring the success state into view when the report is published in this session.
  const [openedAs] = useState(booking.status);
  const publishedRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && openedAs !== "completed") el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [openedAs],
  );
  const cancelled = booking.status === "cancelled";

  return (
    <div className="mx-auto grid w-full max-w-[1760px] gap-5 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[300px_minmax(0,1fr)_360px] 2xl:grid-cols-[320px_minmax(0,1fr)_420px]">
      {/* Left: patient */}
      <aside className="flex min-w-0 flex-col gap-4 lg:row-span-3 xl:row-span-2" aria-label="Patient">
        <PatientColumn booking={booking} liveHeartRate={ecg.heartRate} />
      </aside>

      {/* Centre: live signals */}
      <section
        className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-4 shadow-soft"
        aria-label="Live signals"
      >
        <EcgPanel booking={booking} feed={ecg} status={devices} />
        <div className="h-px bg-border" />
        <StethPanel booking={booking} feed={steth} status={devices} />
      </section>

      {/* Right: video */}
      <div className="flex min-w-0 flex-col">
        <ConsultPanel booking={booking} onEndCall={() => void report.endCall()} ending={report.busy === "ending"} />
      </div>

      {/* Report */}
      <div className="min-w-0 xl:col-span-2">
        {completed && booking.report ? (
          <div className="flex scroll-mt-24 flex-col gap-4" ref={publishedRef}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-emerald-600 text-white">
                  <BadgeCheck className="size-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-emerald-950">Report published</p>
                  <p className="text-[13px] text-emerald-900/75">
                    {booking.patient.name} can view and download it in the Nivar app
                    {booking.report.publishedAt ? `, sent ${formatDateTime(booking.report.publishedAt)}` : ""}.
                  </p>
                </div>
              </div>
              <Link href="/doctor" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-white px-3")}>
                <LayoutDashboard /> Back to consults
              </Link>
            </div>
            <ReportSummary booking={booking} report={booking.report} />
          </div>
        ) : cancelled ? (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            This visit was cancelled, so no report is needed.
          </div>
        ) : (
          <ReportEditor booking={booking} report={report} />
        )}
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1760px] gap-5 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[260px] rounded-2xl" />
      </div>
      <Skeleton className="h-[560px] rounded-2xl" />
      <Skeleton className="h-[560px] rounded-2xl" />
    </div>
  );
}

export function ConsultWorkspace({ bookingId }: { bookingId: string }) {
  useNotifications();
  const { booking, setBooking, loading, error, errorStatus } = useBooking(bookingId);
  const ecg = useLiveFeed(bookingId, "ecg");
  const steth = useLiveFeed(bookingId, "steth");
  const devices = useDeviceStatus(bookingId);
  const visitOpen = booking ? STATUS_META[booking.status].live : false;
  const live = visitOpen && (ecg.live || steth.live || booking?.status === "consult");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <WorkspaceHeader booking={booking} live={live} />
      {booking ? (
        <WorkspaceBody
          key={booking.id}
          booking={booking}
          setBooking={setBooking}
          ecg={ecg}
          steth={steth}
          devices={devices}
        />
      ) : loading ? (
        <WorkspaceSkeleton />
      ) : (
        <div className="grid flex-1 place-items-center px-4 py-16">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-red-50 text-destructive">
              <ShieldAlert className="size-6" />
            </span>
            <h1 className="font-display text-2xl font-medium">
              {errorStatus === 403
                ? "Not your consult"
                : errorStatus === 404
                  ? "Consult not found"
                  : "Couldn't open consult"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorStatus === 403
                ? "This visit is assigned to another doctor."
                : (error ?? "Please try again in a moment.")}
            </p>
            <Link href="/doctor" className={cn(buttonVariants({ size: "lg" }), "mt-2 px-4")}>
              <Radio /> Back to consults
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
