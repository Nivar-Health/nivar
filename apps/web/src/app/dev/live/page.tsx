"use client";

import { API_ORIGIN } from "@/lib/api";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { Car, Plug, PlugZap, RotateCcw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EcgMonitor,
  EcgStrip,
  LiveMap,
  StethMonitor,
  VideoCall,
  simulateDrive,
  type LatLng,
  type MonitorStatus,
} from "@/components/live";
import {
  createEcgSimulator,
  createStethSimulator,
  generateEcgSamples,
  simulatorFeed,
} from "@/lib/device-sim";

const INDIRANAGAR: LatLng = { lat: 12.9719, lng: 77.6412 };
const KORAMANGALA: LatLng & { label: string } = { lat: 12.9352, lng: 77.6245, label: "Patient home" };
const API_URL = API_ORIGIN;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function DevicesDemo() {
  const [ecgSim] = useState(() => createEcgSimulator({ heartRate: 74 }));
  const [stethSim] = useState(() => createStethSimulator({ heartRate: 74 }));
  const ecgFeed = useMemo(() => simulatorFeed(ecgSim), [ecgSim]);
  const stethFeed = useMemo(() => simulatorFeed(stethSim), [stethSim]);
  const [hr, setHr] = useState(74);
  const [status, setStatus] = useState<MonitorStatus>("stopped");
  const pairTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pairTimer.current) clearTimeout(pairTimer.current);
  }, []);

  const connect = () => {
    setStatus("connecting");
    pairTimer.current = setTimeout(() => setStatus("streaming"), 2000);
  };
  const disconnect = () => {
    if (pairTimer.current) clearTimeout(pairTimer.current);
    setStatus("stopped");
  };
  const onHr = (v: number) => {
    setHr(v);
    ecgSim.setHeartRate(v);
    stethSim.setHeartRate(v);
  };

  const streaming = status === "streaming";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        {status === "stopped" ? (
          <Button onClick={connect}>
            <PlugZap /> Connect devices
          </Button>
        ) : (
          <Button variant="outline" onClick={disconnect}>
            <Plug /> Disconnect
          </Button>
        )}
        <label className="flex w-full items-center gap-3 text-sm text-muted-foreground sm:w-auto sm:min-w-[280px] sm:flex-1">
          <span className="shrink-0">Heart rate</span>
          <input
            type="range"
            min={45}
            max={150}
            value={hr}
            onChange={(e) => onHr(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-[#0a0a0a]"
          />
          <span className="w-16 shrink-0 text-right font-medium text-foreground tabular-nums">{hr} bpm</span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EcgMonitor feed={streaming ? ecgFeed : null} status={status} />
        <StethMonitor feed={streaming ? stethFeed : null} status={status} height={240} />
      </div>
    </>
  );
}

function StripDemo() {
  const samples = useMemo(() => generateEcgSamples(10, 72), []);
  return <EcgStrip samples={samples} heartRate={72} caption="Captured 12 Oct 2026, 10:42" />;
}

function MapDemo() {
  const [nurse, setNurse] = useState<LatLng | null>(INDIRANAGAR);
  const [driving, setDriving] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  const drive = () => {
    stopRef.current?.();
    setDriving(true);
    stopRef.current = simulateDrive(INDIRANAGAR, KORAMANGALA, {
      durationMs: 45000,
      onPoint: (p, { done }) => {
        setNurse(p);
        if (done) setDriving(false);
      },
    });
  };
  const reset = () => {
    stopRef.current?.();
    setDriving(false);
    setNurse(INDIRANAGAR);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={drive} disabled={driving}>
          <Car /> {driving ? "Driving..." : "Simulate drive"}
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw /> Reset
        </Button>
        <Button variant="ghost" onClick={() => setNurse(null)}>
          Hide nurse
        </Button>
      </div>
      <LiveMap home={KORAMANGALA} nurse={nurse} nurseName="Priya Nair" height={380} />
    </>
  );
}

function CallDemo() {
  const params = useSearchParams();
  const token = params.get("token");
  const booking = params.get("booking");
  const name = params.get("name") ?? "Dev user";
  const role = params.get("role") ?? "doctor";
  const apiUrl = params.get("api") ?? API_URL;
  const compact = params.get("compact") === "1";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token || !booking) return;
    const s = io(apiUrl, { auth: { token }, transports: ["websocket"], reconnectionAttempts: 5 });
    s.on("connect", () => {
      setSocket(s);
      setError(null);
    });
    s.on("connect_error", (err) => setError(err.message || "Could not reach the realtime server"));
    return () => {
      s.disconnect();
    };
  }, [token, booking, apiUrl]);

  if (!token || !booking) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Video call needs the API.</p>
        <p className="mt-1">
          Open this page as{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/dev/live?token=JWT&amp;booking=BOOKING_ID</code>{" "}
          in two tabs (optionally <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&amp;name=&amp;role=</code>
          ). The socket connects to <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{apiUrl}</code>{" "}
          (override with <code className="rounded bg-muted px-1.5 py-0.5 text-xs">&amp;api=</code>).
        </p>
      </div>
    );
  }
  if (!socket) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        {error ? `Realtime server unavailable: ${error}` : "Connecting to the realtime server..."}
      </div>
    );
  }
  if (!joined) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Connected as <span className="font-medium text-foreground">{name}</span> for booking {booking}.
        </p>
        <Button onClick={() => setJoined(true)}>
          <Video /> Join call
        </Button>
      </div>
    );
  }
  return (
    <div className={compact ? "max-w-[360px]" : undefined}>
      <VideoCall
        socket={socket}
        bookingId={booking}
        self={{ name, role }}
        compact={compact}
        onLeave={() => setJoined(false)}
      />
    </div>
  );
}

export default function LiveDevPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted-foreground">Dev showcase</span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Live components</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Smart ECG and stethoscope monitors, report strip, live nurse tracking and the consult video call. Device
          signals here come from the local simulator, no backend needed.
        </p>
      </header>

      <Section title="Smart devices" hint="Bedside monitor style. Listen needs a click to start audio.">
        <DevicesDemo />
      </Section>

      <Section title="ECG strip" hint="Static 10 s capture as printed on the report.">
        <StripDemo />
      </Section>

      <Section title="Live tracking" hint="Indiranagar to Koramangala in about 45 s.">
        <MapDemo />
      </Section>

      <Section title="Video consult" hint="WebRTC mesh over the rtc:* socket events.">
        <Suspense fallback={null}>
          <CallDemo />
        </Suspense>
      </Section>
    </main>
  );
}
