"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ChevronLeft, LayoutDashboard, RotateCw, ShieldAlert, Timer, Video } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
    // On narrow screens the video sits below other panels: the clock jumps to it.
    return (
      <a
        href="#video-consult"
        aria-label={`In consult, ${formatElapsed(now - start)}. Go to the video consult`}
        className="inline-flex h-8 items-center gap-2 rounded-full bg-primary pr-3 pl-2.5 text-[13px] font-medium text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Video className="size-3.5" aria-hidden />
        <span className="hidden sm:inline" aria-hidden>
          In consult
        </span>
        <span className="font-mono font-semibold tabular-nums" aria-hidden>
          {formatElapsed(now - start)}
        </span>
      </a>
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
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-background px-2.5 text-[11px] font-medium text-foreground ring-1 ring-border ring-inset">
      <span className="live-dot size-1.5 text-signal" />
      Live
    </span>
  );
}

function WorkspaceHeader({ booking, live, loading }: { booking: Booking | null; live: boolean; loading: boolean }) {
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
          <div className="flex flex-1 items-center gap-3">{loading && <Skeleton className="h-8 w-40" />}</div>
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
  const inConsult = booking.status === "consult";
  // Bring the success state into view when the report is published in this session.
  const [openedAs] = useState(booking.status);
  // Opened to write the report ("Write report" on the dashboard): start at the editor, once.
  const editorShown = useRef(false);
  const editorRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || editorShown.current || openedAs !== "reporting") return;
      editorShown.current = true;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    [openedAs],
  );
  const publishedRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || openedAs === "completed") return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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

      {/* Right: video. On one column, first while the patient is waiting on the call. */}
      <div className={cn("flex min-w-0 flex-col", inConsult && "order-first lg:order-none")}>
        <ConsultPanel booking={booking} onEndConsult={report.endCall} ending={report.busy === "ending"} />
      </div>

      {/* Report */}
      <div className="min-w-0 scroll-mt-20 xl:col-span-2" ref={editorRef}>
        {completed && booking.report ? (
          <div className="flex scroll-mt-24 flex-col gap-4" ref={publishedRef}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-foreground text-background">
                  <BadgeCheck className="size-5 text-signal" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-foreground">Report published</p>
                  <p className="text-[13px] text-muted-foreground">
                    {booking.patient.name} can view and download it in the Nivar app
                    {booking.report.publishedAt ? `, sent ${formatDateTime(booking.report.publishedAt)}` : ""}.
                  </p>
                </div>
              </div>
              <Link href="/doctor" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-card px-3")}>
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
  const { booking, setBooking, loading, error, errorStatus, reload } = useBooking(bookingId);
  const ecg = useLiveFeed(bookingId, "ecg");
  const steth = useLiveFeed(bookingId, "steth");
  const devices = useDeviceStatus(bookingId);
  const visitOpen = booking ? STATUS_META[booking.status].live : false;
  const live = visitOpen && (ecg.live || steth.live || booking?.status === "consult");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <WorkspaceHeader booking={booking} live={live} loading={loading} />
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
            <span className="grid size-12 place-items-center rounded-full border border-border bg-card text-destructive">
              <ShieldAlert className="size-6" />
            </span>
            <h1 className="font-display text-2xl">
              {errorStatus === 403
                ? "Not your consult"
                : errorStatus === 404
                  ? "We couldn't find this consult"
                  : "Couldn't open consult"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {errorStatus === 403
                ? "This visit is assigned to another doctor."
                : errorStatus === 404
                  ? "It may have been cancelled or reassigned."
                  : (error ?? "Please try again in a moment.")}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {errorStatus !== 403 && errorStatus !== 404 && (
                <Button size="lg" className="px-4" onClick={reload}>
                  <RotateCw /> Try again
                </Button>
              )}
              <Link
                href="/doctor"
                className={cn(
                  buttonVariants({ variant: errorStatus === 403 || errorStatus === 404 ? "default" : "outline", size: "lg" }),
                  "px-4",
                )}
              >
                <ArrowLeft /> Back to consults
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
