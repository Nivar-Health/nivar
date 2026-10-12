"use client";

import dynamic from "next/dynamic";
import { Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { etaMinutes, formatDistance, haversineKm, type LatLng } from "./geo";

export { buildRoute, etaMinutes, formatDistance, haversineKm, simulateDrive } from "./geo";
export type { DriveOptions, LatLng } from "./geo";

export type LiveMapProps = {
  home: LatLng & { label?: string };
  nurse?: LatLng | null;
  nurseName?: string;
  /** Map height (px or CSS length). Default 320. */
  height?: number | string;
  /** Show the distance / ETA chip when the nurse position is known. Default true. */
  showEta?: boolean;
  className?: string;
};

function MapSkeleton({ height }: { height: number | string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E9EEE9]" style={{ height }} aria-busy="true">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(#DCE4DE 1px, transparent 1px), linear-gradient(90deg, #DCE4DE 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/0 via-white/40 to-white/0" />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#5B6B67]">
        Loading map...
      </div>
    </div>
  );
}

const LiveMapInner = dynamic(() => import("./live-map-inner"), {
  ssr: false,
  loading: () => <MapSkeleton height="100%" />,
});

/**
 * Live tracking map: patient home pin, nurse avatar that glides between
 * position updates, dashed connector and ETA. Client-only (Leaflet).
 */
export function LiveMap({ home, nurse, nurseName, height = 320, showEta = true, className }: LiveMapProps) {
  const km = nurse ? haversineKm(nurse, home) : null;
  const first = nurseName?.trim().split(/\s+/)[0];
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-2xl border border-border bg-[#E9EEE9]", className)}
      style={{ height }}
    >
      <LiveMapInner home={home} nurse={nurse} nurseName={nurseName} height="100%" />
      {showEta && km !== null && (
        <div className="pointer-events-none absolute top-3 left-3 z-[500] flex items-center gap-2.5 rounded-xl border border-[#E5E0D6] bg-[#FFFDF9]/95 px-3 py-2 shadow-[0_8px_20px_-10px_rgba(19,35,33,0.45)] backdrop-blur">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#F2A33A]/20 text-[#B86E0B]">
            <Navigation className="size-3.5" />
          </span>
          <div className="leading-tight">
            {km < 0.08 ? (
              <div className="text-sm font-semibold text-[#132321]">{first ?? "Nurse"} has arrived</div>
            ) : (
              <>
                <div className="text-sm font-semibold text-[#132321] tabular-nums">
                  {etaMinutes(km)} min away
                </div>
                <div className="text-[11px] text-[#5B6B67] tabular-nums">
                  {first ? `${first} is ` : ""}
                  {formatDistance(km)} from home
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
