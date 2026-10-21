import type { CSSProperties } from "react";
import type { Package } from "@/lib/types";
import { ProgrammeGlyph, programmeStyle } from "./programme-glyphs";
import { inr, revealProps } from "./primitives";
import { SnapRow } from "./snap-row";
import { CareCta } from "./whatsapp";

/** Plain names for the tests a programme includes. */
const TEST_NAMES: Record<string, string> = {
  BP: "Blood pressure",
  ECG: "Smart ECG",
  SUGAR: "Blood sugar",
  HR: "Heart rate",
  SPO2: "Oxygen",
  STETH: "Stethoscope",
  CONSULT: "Doctor consult",
};

/** "Most booked" stays off until the team confirms it from real bookings (spec §3.6). */
const SHOW_POPULAR_BADGE: boolean = false;

/** Desktop columns by card count, so admin deactivations never leave a ragged last row. */
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1 lg:max-w-md",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-2 xl:grid-cols-4",
};

/**
 * The check-up packages: a sideways row below lg, a grid from lg (spec §4.6). Catalogue-driven, so
 * admin edits and deactivations show up here; `packages` arrives sorted by sortOrder. One price per
 * check-up; no reference ("usual") price is shown.
 */
export function Programmes({ packages }: { packages: Package[] }) {
  if (packages.length === 0) return null;
  return (
    <>
      <SnapRow
        label="Health check-up packages"
        itemClassName="basis-[85%] sm:basis-[46%]"
        gridFrom="lg"
        gridClassName={`lg:gap-5 ${LG_COLS[packages.length] ?? "lg:grid-cols-3"}`}
        className="mt-8 sm:mt-12 lg:mt-14"
      >
        {packages.map((p) => (
          <PackageCard key={p.slug} pkg={p} />
        ))}
      </SnapRow>
      <p className="mt-4 text-caption text-pretty text-ink-3 sm:mt-5 lg:mt-6">
        Every check-up is carried out by a registered Nivar nurse and reviewed by a Nivar doctor.
      </p>
    </>
  );
}

function PackageCard({ pkg: p }: { pkg: Package }) {
  const price = inr(p.price);
  const titleId = `check-up-${p.slug}`;
  return (
    <article
      aria-labelledby={titleId}
      className="nv-chk-card"
      style={{ "--pg-tint": programmeStyle(p.slug).tint } as CSSProperties}
    >
      <div className="nv-chk-head">
        <span aria-hidden className="nv-chk-glyph" {...revealProps()}>
          <ProgrammeGlyph slug={p.slug} className="size-14" />
        </span>
        <div className="nv-chk-id">
          <h3
            id={titleId}
            className="nv-chk-name text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance text-ink lg:text-h3"
          >
            {p.name}
          </h3>
          <p className="nv-chk-price">
            {SHOW_POPULAR_BADGE && p.popular && (
              <span className="rounded-full bg-white px-3 py-1 text-[0.8125rem] font-semibold text-primary">
                Most booked
              </span>
            )}
            <span className="text-[1.25rem] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums xl:text-[1.75rem] xl:tracking-[-0.03em]">
              {price}
            </span>
          </p>
        </div>
      </div>

      <p className="nv-chk-tagline text-small text-pretty text-ink-2">{p.tagline}</p>

      <ul aria-label={`Included in ${p.name}`} className="nv-chk-tests flex flex-wrap gap-1.5">
        {p.serviceCodes.map((c) => (
          <li
            key={c}
            className="rounded-full bg-white/75 px-2.5 py-[3px] text-[0.8125rem] leading-[1.125rem] font-medium text-ink-2"
          >
            {TEST_NAMES[c] ?? c}
          </li>
        ))}
      </ul>

      <CareCta name={p.name} ask={`the ${p.name}`} from={p.price} priceLabel={price} fullWidth className="nv-chk-cta" />
    </article>
  );
}
