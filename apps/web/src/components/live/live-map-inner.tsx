"use client";

import "leaflet/dist/leaflet.css";
import "./live-map.css";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { LatLng } from "./geo";

export type LiveMapInnerProps = {
  home: LatLng & { label?: string };
  nurse?: LatLng | null;
  nurseName?: string;
  height: number | string;
  className?: string;
};

/**
 * OpenStreetMap standard tiles (CARTO basemaps now require an API key and
 * serve an "API key required" placeholder without one). The tile pane is
 * softly desaturated in live-map.css for a calmer, on-brand look. Override
 * with NEXT_PUBLIC_MAP_TILE_URL (+ NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) if a
 * keyed provider is available.
 */
const TILES = {
  url: process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function initials(name?: string) {
  if (!name) return "RN";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "RN";
}

function homeIcon(label?: string) {
  return L.divIcon({
    className: "nivar-icon",
    iconSize: [38, 48],
    iconAnchor: [19, 46],
    html: `<div class="nivar-home">
      <svg width="38" height="48" viewBox="0 0 38 48" aria-hidden="true">
        <path d="M19 47c-1-1.6-15-17.4-15-28.2C4 9.9 10.7 3 19 3s15 6.9 15 15.8C34 29.6 20 45.4 19 47z" fill="#0a0a0a" stroke="#ffffff" stroke-width="2.5"/>
        <g transform="translate(10.5 10)" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 7.5 8.5 1.6l7 5.9"/>
          <path d="M3.4 6.2V15h10.2V6.2"/>
          <path d="M7 15v-4.2h3V15"/>
        </g>
      </svg>
      ${label ? `<span class="nivar-home__label">${escapeHtml(label)}</span>` : ""}
    </div>`,
  });
}

function nurseIcon(name?: string) {
  return L.divIcon({
    className: "nivar-icon",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div class="nivar-nurse">
      <span class="nivar-nurse__ring"></span>
      <span class="nivar-nurse__ring nivar-nurse__ring--late"></span>
      <span class="nivar-nurse__dot">${escapeHtml(initials(name))}</span>
      ${name ? `<span class="nivar-nurse__name">${escapeHtml(name)}</span>` : ""}
    </div>`,
  });
}

const FIT_PADDING: L.PointExpression = [56, 56];

/** Imperative nurse marker: animates between updates without React re-renders. */
function NurseLayer({ home, nurse, nurseName }: { home: LatLng; nurse: LatLng; nurseName?: string }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const animRef = useRef<number>(0);
  const fittedRef = useRef(false);
  const lastRefitRef = useRef(0);

  // Create layers once.
  useEffect(() => {
    const marker = L.marker([nurse.lat, nurse.lng], { icon: nurseIcon(nurseName), zIndexOffset: 1000, keyboard: false });
    const line = L.polyline(
      [
        [nurse.lat, nurse.lng],
        [home.lat, home.lng],
      ],
      { color: "#0a0a0a", weight: 3, opacity: 0.7, dashArray: "2 9", lineCap: "round", interactive: false },
    );
    line.addTo(map);
    marker.addTo(map);
    markerRef.current = marker;
    lineRef.current = line;
    return () => {
      cancelAnimationFrame(animRef.current);
      marker.remove();
      line.remove();
      markerRef.current = null;
      lineRef.current = null;
    };
    // Layers are created once; position/name updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setIcon(nurseIcon(nurseName));
  }, [nurseName]);

  // Animate to each new position and keep both points in view.
  useEffect(() => {
    const marker = markerRef.current;
    const line = lineRef.current;
    if (!marker || !line) return;
    const from = marker.getLatLng();
    const to = L.latLng(nurse.lat, nurse.lng);
    const homeLL = L.latLng(home.lat, home.lng);
    cancelAnimationFrame(animRef.current);

    const bounds = L.latLngBounds([to, homeLL]);
    if (!fittedRef.current) {
      fittedRef.current = true;
      map.invalidateSize({ pan: false });
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 16, animate: false });
    } else {
      const outOfView = !map.getBounds().pad(-0.08).contains(to) || !map.getBounds().contains(homeLL);
      // Zoom in step by step as the nurse closes in, at most every few seconds so the map stays calm.
      const canZoomIn =
        map.getBoundsZoom(bounds, false, L.point(FIT_PADDING as [number, number]).multiplyBy(2)) >= map.getZoom() + 1 &&
        performance.now() - lastRefitRef.current > 4000;
      if (outOfView || canZoomIn) {
        lastRefitRef.current = performance.now();
        map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 17, animate: true, duration: 0.8 });
      }
    }

    // Once the nurse is at the door, the markers overlap: hide the route line and the home label.
    const near = to.distanceTo(homeLL) < 150;
    map.getContainer().classList.toggle("nivar-map--near", near);

    const dist = from.distanceTo(to);
    // Jumps over ~5 km are teleports (e.g. first fix); don't animate across the city.
    if (dist < 1 || dist > 5000) {
      marker.setLatLng(to);
      line.setLatLngs([to, homeLL]);
      return;
    }
    const start = performance.now();
    const duration = 950;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const p = L.latLng(from.lat + (to.lat - from.lat) * e, from.lng + (to.lng - from.lng) * e);
      marker.setLatLng(p);
      line.setLatLngs([p, homeLL]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [nurse.lat, nurse.lng, home.lat, home.lng, map]);

  return null;
}

/** Keeps Leaflet's cached size in sync with the container (dynamic layouts, tabs, panels). */
function SizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Centres on home when there is no nurse position. */
function HomeOnlyView({ home, active }: { home: LatLng; active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (active) map.setView([home.lat, home.lng], 15, { animate: false });
  }, [active, home.lat, home.lng, map]);
  return null;
}

export default function LiveMapInner({ home, nurse, nurseName, height, className }: LiveMapInnerProps) {
  const icon = useMemo(() => homeIcon(home.label), [home.label]);
  const hasNurse = !!nurse && Number.isFinite(nurse.lat) && Number.isFinite(nurse.lng);

  return (
    <div className={className ? `nivar-map ${className}` : "nivar-map"} style={{ height }}>
      <MapContainer
        center={[home.lat, home.lng]}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl
        style={{ height: "100%", width: "100%", borderRadius: "inherit" }}
      >
        <TileLayer url={TILES.url} attribution={TILES.attribution} maxZoom={19} />
        <SizeWatcher />
        <ZoomControl position="bottomright" />
        <Marker position={[home.lat, home.lng]} icon={icon} keyboard={false} />
        {hasNurse && nurse ? (
          <NurseLayer home={home} nurse={nurse} nurseName={nurseName} />
        ) : null}
        <HomeOnlyView home={home} active={!hasNurse} />
      </MapContainer>
    </div>
  );
}
