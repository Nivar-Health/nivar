"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The dashboard and its monitors and simulators: a client-only chunk, fetched only near the panel. A failed
 * load renders nothing and the skeleton stays: no error boundary sits above the slot, so a ChunkLoadError
 * would replace the whole page.
 */
const LiveDashboard = dynamic(() => import("./live-dashboard").then((m) => m.LiveDashboard).catch(() => () => null), {
  ssr: false,
  loading: () => null,
});

/** The phone breakpoint in range syntax, exactly as the CSS writes it, so the two never disagree at fractional widths. */
const PHONE_QUERY = "(width < 40rem)";

function subscribePhone(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Below sm. Behaviour only: the dashboard is client-only, so no server markup depends on it. */
function usePhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/**
 * The live dashboard's reserved box (live-panel.tsx sets its min-heights). `children` is the
 * server-rendered skeleton, which holds the box from the first paint. Once the box is within 600px of
 * the viewport the dashboard chunk loads, mounts in the compact layout on phones, and fades in over
 * the skeleton; `data-ready` then retires the skeleton (check-ups.css).
 */
export function LiveDashboardSlot({
  ecgPhone,
  ecg,
  steth,
  className,
  children,
}: {
  ecgPhone: number;
  ecg: number;
  steth: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const phone = usePhone();
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setNear(true);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-busy={!ready}
      data-ready={ready ? "" : undefined}
      className={cn("nv-chk-frame relative grid", className)}
    >
      {children}
      {near && (
        <LiveDashboard
          compact={phone}
          ecgHeight={phone ? ecgPhone : ecg}
          stethHeight={steth}
          onReady={markReady}
          className="nv-chk-dash relative"
        />
      )}
    </div>
  );
}
