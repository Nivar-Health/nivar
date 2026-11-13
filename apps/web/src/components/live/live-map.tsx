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
  /**
   * On touch screens, let a finger on the map scroll the page instead of panning the map, so the map
   * never traps a page it sits in the middle of. The map already refits itself to keep the nurse and
   * the home in view; the zoom buttons stay, at a size a thumb can hit. Default false.
   */
  touchScrollsPage?: boolean;
  className?: string;
};

/** Touches pass through the map surface and its markers; Leaflet's controls keep their own taps. */
const TOUCH_SCROLLS_PAGE =
  "pointer-coarse:[&_.leaflet-container]:pointer-events-none! pointer-coarse:[&_.leaflet-container]:touch-auto! pointer-coarse:[&_.leaflet-marker-icon]:pointer-events-none! pointer-coarse:[&_.leaflet-bar_a]:size-11! pointer-coarse:[&_.leaflet-bar_a]:leading-[2.75rem]!";

function MapSkeleton({ height }: { height: number | string }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-wash" style={{ height }} aria-busy="true">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/0 via-white/40 to-white/0" />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-muted-foreground">
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
export function LiveMap({
  home,
  nurse,
  nurseName,
  height = 320,
  showEta = true,
  touchScrollsPage = false,
  className,
}: LiveMapProps) {
  const km = nurse ? haversineKm(nurse, home) : null;
  const first = nurseName?.trim().split(/\s+/)[0];
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-border bg-muted",
        touchScrollsPage && TOUCH_SCROLLS_PAGE,
        className,
      )}
      style={{ height }}
    >
      <LiveMapInner home={home} nurse={nurse} nurseName={nurseName} height="100%" />
      {showEta && km !== null && (
        <div className="pointer-events-none absolute top-3 left-3 z-[500] flex items-center gap-2.5 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-soft backdrop-blur">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Navigation className="size-3.5" />
          </span>
          <div className="leading-tight">
            {km < 0.08 ? (
              <div className="text-sm font-semibold text-foreground">{first ?? "Nurse"} has arrived</div>
            ) : (
              <>
                <div className="text-sm font-semibold text-foreground tabular-nums">
                  {etaMinutes(km)} min away
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
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
