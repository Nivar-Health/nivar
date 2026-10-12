"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Camera,
  FilePenLine,
  FlaskConical,
  House,
  Navigation,
  PhoneOff,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { VideoCall } from "@/components/live/video-call";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-menu";
import { useAuth } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { useSocket, useSocketConnected } from "@/lib/socket";
import { populated, type Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

function Participant({ name, role, tone }: { name: string; role: string; tone: "patient" | "nurse" }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <span
        className={cn(
          "grid size-16 place-items-center rounded-full text-lg font-semibold ring-4",
          tone === "patient"
            ? "bg-[#E6F2EE] text-[#0E5E52] ring-white/10"
            : "bg-[#F2A33A] text-[#132321] ring-white/10",
        )}
      >
        {name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col items-center">
        <span className="max-w-[140px] truncate text-sm font-semibold text-white">{name}</span>
        <span className="text-[11px] text-white/55">{role}</span>
      </div>
    </div>
  );
}

function Stage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex min-h-[340px] flex-1 flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_50%_0%,#17423B,#0B1513_70%)] px-6 py-8 text-center text-white",
        className,
      )}
    >
      <div className="absolute inset-0 bg-ecg-grid-dark opacity-60" aria-hidden />
      <div className="relative flex w-full flex-col items-center gap-6">{children}</div>
    </div>
  );
}

const WAITING_STATES: Record<string, { icon: React.ReactNode; title: (nurse: string) => string; body: string }> = {
  assigned: {
    icon: <UserRoundCheck />,
    title: (n) => `${n} is assigned to this visit`,
    body: "The consult opens once the nurse has finished the tests at home.",
  },
  en_route: {
    icon: <Navigation />,
    title: (n) => `${n} is on the way`,
    body: "You will be notified as soon as the patient is ready for the video consult.",
  },
  arrived: {
    icon: <House />,
    title: (n) => `${n} has arrived`,
    body: "The nurse is setting up the devices. Live readings will appear here shortly.",
  },
  testing: {
    icon: <FlaskConical />,
    title: () => "Tests in progress",
    body: "Watch the vitals and live signals. The nurse will start the video consult when ready.",
  },
  reporting: {
    icon: <FilePenLine />,
    title: () => "Consult ended",
    body: "Finish the report below and publish it to the patient.",
  },
  completed: {
    icon: <BadgeCheck />,
    title: () => "Report published",
    body: "This visit is complete. The patient has the report in the Nivar app.",
  },
  cancelled: {
    icon: <PhoneOff />,
    title: () => "Visit cancelled",
    body: "This booking was cancelled.",
  },
};

export function ConsultPanel({
  booking,
  onEndCall,
  ending,
}: {
  booking: Booking;
  /** Ends the consult (status reporting). */
  onEndCall: () => void;
  ending: boolean;
}) {
  const { user } = useAuth();
  const socket = useSocket();
  const connected = useSocketConnected();
  const [joined, setJoined] = useState(false);
  const nurse = populated(booking.nurse);
  const nurseName = nurse ? firstName(nurse.name) : "The nurse";
  const inConsult = booking.status === "consult";
  const showCall = inConsult && joined && socket;
  const waiting = WAITING_STATES[booking.status];

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft transition-shadow",
        inConsult && !showCall && "border-saffron/60 ring-4 ring-saffron/20",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4",
              inConsult ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
            )}
          >
            <Video />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm leading-tight font-semibold">Video consult</h3>
            <p className="truncate text-xs text-muted-foreground">
              {booking.patient.name}
              {nurse ? ` with ${nurse.name}` : ""}
            </p>
          </div>
        </div>
        {inConsult ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground">
            <span className="live-dot size-1.5 text-saffron" />
            {showCall ? "On call" : "Waiting for you"}
          </span>
        ) : (
          <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
            {booking.status === "reporting" || booking.status === "completed"
              ? "Ended"
              : booking.status === "cancelled"
                ? "Cancelled"
                : "Not started"}
          </span>
        )}
      </div>

      {showCall ? (
        <VideoCall
          socket={socket}
          bookingId={booking.id}
          self={{ name: user?.name ?? "Doctor", role: "doctor" }}
          compact
          onLeave={() => setJoined(false)}
          className="h-auto min-h-[420px] flex-1"
        />
      ) : inConsult ? (
        <Stage>
          <div className="flex items-start justify-center gap-8">
            <Participant name={booking.patient.name} role="Patient" tone="patient" />
            {nurse && <Participant name={nurse.name} role="Nivar nurse" tone="nurse" />}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-base font-semibold">
              {firstName(booking.patient.name)} and {nurseName} are ready
            </p>
            <p className="max-w-[300px] text-xs text-white/60">
              Join from here. Your camera and microphone are requested when you join.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => setJoined(true)}
            disabled={!socket || !connected}
            className="h-11 gap-2 rounded-full bg-saffron px-6 text-[15px] font-semibold text-ink hover:bg-[#F5B456]"
          >
            <Camera className="size-[18px]" />
            {connected ? "Join consult" : "Connecting"}
          </Button>
        </Stage>
      ) : waiting ? (
        <Stage className="min-h-[300px]">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/8 text-[#3BE3B4] ring-1 ring-white/10 [&_svg]:size-6">
            {waiting.icon}
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-base font-semibold">{waiting.title(nurseName)}</p>
            <p className="max-w-[300px] text-xs leading-relaxed text-white/60">{waiting.body}</p>
          </div>
          {nurse && booking.status !== "completed" && booking.status !== "cancelled" && (
            <div className="flex items-center gap-2 rounded-full bg-white/6 py-1 pr-3 pl-1 ring-1 ring-white/10">
              <UserAvatar name={nurse.name} size="sm" />
              <span className="text-xs text-white/80">{nurse.name}</span>
            </div>
          )}
        </Stage>
      ) : null}

      {inConsult && (
        <Button variant="outline" size="lg" onClick={onEndCall} disabled={ending} className="w-full">
          <PhoneOff /> {ending ? "Ending consult" : "End call, write report later"}
        </Button>
      )}
    </section>
  );
}
