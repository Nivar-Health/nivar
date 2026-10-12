import { MapPin } from "lucide-react";
import { Container, SectionHeading } from "./primitives";

type Area = { name: string; label?: string; pincode: string; lat: number; lng: number; dx: number; dy: number; anchor?: "start" | "end" | "middle"; hub?: boolean };

// Real neighbourhood centroids. dx/dy nudge labels so neighbours don't collide.
const AREAS: Area[] = [
  { name: "Hebbal", pincode: "560024", lat: 13.0358, lng: 77.597, dx: 10, dy: 4 },
  { name: "Malleshwaram", pincode: "560003", lat: 13.0035, lng: 77.571, dx: 10, dy: 4 },
  { name: "Indiranagar", pincode: "560038", lat: 12.9719, lng: 77.6412, dx: 10, dy: 4, hub: true },
  { name: "Whitefield", pincode: "560066", lat: 12.9698, lng: 77.75, dx: 0, dy: -14, anchor: "middle" },
  { name: "Koramangala", pincode: "560034", lat: 12.9352, lng: 77.6245, dx: -10, dy: -6, anchor: "end", hub: true },
  { name: "Jayanagar", pincode: "560041", lat: 12.9308, lng: 77.5838, dx: -10, dy: 4, anchor: "end" },
  { name: "Bellandur", pincode: "560103", lat: 12.9257, lng: 77.6764, dx: 10, dy: 4 },
  { name: "BTM Layout", label: "BTM", pincode: "560076", lat: 12.9166, lng: 77.6101, dx: 8, dy: 5 },
  { name: "HSR Layout", pincode: "560102", lat: 12.9116, lng: 77.6474, dx: 10, dy: 12, hub: true },
  { name: "JP Nagar", pincode: "560078", lat: 12.9063, lng: 77.5857, dx: -10, dy: 12, anchor: "end" },
];

const W = 480;
const H = 400;
const PAD_X = 96;
const PAD_Y = 56;
// Equirectangular projection, longitude scaled by cos(latitude), fitted to the areas.
const K = Math.cos((12.97 * Math.PI) / 180);
const LNG0 = Math.min(...AREAS.map((a) => a.lng));
const LNG1 = Math.max(...AREAS.map((a) => a.lng));
const LAT0 = Math.min(...AREAS.map((a) => a.lat));
const LAT1 = Math.max(...AREAS.map((a) => a.lat));
const SCALE = Math.min((W - 2 * PAD_X) / ((LNG1 - LNG0) * K), (H - 2 * PAD_Y) / (LAT1 - LAT0));
const OX = (W - (LNG1 - LNG0) * K * SCALE) / 2;
const OY = (H - (LAT1 - LAT0) * SCALE) / 2;
const px = (lng: number) => OX + (lng - LNG0) * K * SCALE;
const py = (lat: number) => OY + (LAT1 - lat) * SCALE;

const SOON = ["Mysuru", "Hyderabad", "Pune", "Chennai"];

export function Coverage() {
  const cx = W / 2;
  const cy = H / 2;
  return (
    <section aria-labelledby="coverage-title" className="py-20 sm:py-24 lg:py-32">
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            id="coverage-title"
            title="Across Bangalore, from three nurse hubs."
            lede="Our nurses start from hubs in Indiranagar, Koramangala and HSR Layout, which is how we keep express visits under an hour."
          />
          <ul className="mt-10 grid grid-cols-2 gap-x-6 border-t border-ink/8 sm:grid-cols-2">
            {[...AREAS].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
              <li key={a.name} className="flex items-baseline justify-between gap-3 border-b border-ink/8 py-3">
                <span className="truncate text-[0.95rem] font-medium text-ink">{a.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.pincode}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-muted-foreground">
            <span className="font-medium text-ink">More cities soon:</span> {SOON.join(", ")}.{" "}
            <a
              href="#callback"
              className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              Ask us about your area
            </a>
          </p>
        </div>

        <figure className="relative overflow-hidden rounded-[22px] border border-ink/8 bg-white">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby="coverage-map-title">
            <title id="coverage-map-title">Map of Nivar service areas in Bangalore</title>
            <defs>
              <pattern id="cov-dots" width="12" height="12" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.1" fill="#0E5E52" opacity="0.13" />
              </pattern>
              <radialGradient id="cov-glow">
                <stop offset="0" stopColor="#0E5E52" stopOpacity="0.14" />
                <stop offset="1" stopColor="#0E5E52" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="url(#cov-dots)" />
            <circle cx={cx} cy={cy} r={200} fill="url(#cov-glow)" />
            {/* Outer Ring Road, roughly */}
            <ellipse
              cx={cx}
              cy={cy}
              rx={W / 2 - PAD_X + 34}
              ry={H / 2 - PAD_Y + 26}
              fill="none"
              stroke="#0E5E52"
              strokeOpacity="0.28"
              strokeWidth="1.5"
              strokeDasharray="5 6"
            />
            {AREAS.map((a) => {
              const x = px(a.lng);
              const y = py(a.lat);
              return (
                <g key={a.name}>
                  {a.hub && <circle cx={x} cy={y} r={15} fill="#F2A33A" opacity="0.22" />}
                  <circle cx={x} cy={y} r={a.hub ? 6.5 : 5} fill={a.hub ? "#F2A33A" : "#0E5E52"} stroke="#fff" strokeWidth="2" />
                  <text
                    x={x + a.dx}
                    y={y + a.dy}
                    textAnchor={a.anchor ?? "start"}
                    className="fill-ink text-[16px] font-semibold sm:text-[13px]"
                    style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 4, strokeLinejoin: "round" }}
                  >
                    {a.label ?? a.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink/8 px-5 py-3.5 text-[0.82rem] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-saffron" aria-hidden />
              Nurse hub
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-primary" aria-hidden />
              Served area
            </span>
            <span className="flex items-center gap-1.5 sm:ml-auto">
              <MapPin className="size-3.5" aria-hidden />
              Bangalore, Karnataka
            </span>
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
