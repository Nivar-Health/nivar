import type { CSSProperties, ReactNode } from "react";
import type { Package } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Disclosure } from "./disclosure";
import { ProgrammeGlyph, programmeStyle } from "./programme-glyphs";
import { inr, revealProps } from "./primitives";
import { CareCta } from "./whatsapp";

/** Plain names for the tests a programme includes: the chips on the cards, from 640px. */
const TEST_NAMES: Record<string, string> = {
  BP: "Blood pressure",
  ECG: "Smart ECG",
  SUGAR: "Blood sugar",
  HR: "Heart rate",
  SPO2: "Oxygen",
  STETH: "Stethoscope",
  CONSULT: "Doctor consult",
};

/** Short words for the phone row's contents line. */
const SHORT: Record<string, string> = {
  BP: "BP",
  ECG: "ECG",
  SUGAR: "sugar",
  HR: "heart rate",
  SPO2: "oxygen",
  STETH: "stethoscope",
};

const word = (names: Record<string, string>, code: string) => (Object.hasOwn(names, code) ? names[code] : code);

/**
 * What a package includes, from its catalogue codes in their order: "BP, ECG, stethoscope, heart rate +
 * doctor consult". The consult is never counted as a check; an unknown code shows as itself.
 * Lines break only between items: "heart rate" and "+ doctor consult" each wrap as one piece (no-break
 * spaces), so no line ends on "heart" or "+".
 */
export function packageContents(codes: readonly string[]): string {
  const checks = codes.filter((c) => c !== "CONSULT").map((c) => word(SHORT, c).replaceAll(" ", "\u00a0"));
  const consult = codes.includes("CONSULT");
  if (checks.length === 0) return consult ? "Doctor consult" : "";
  const list = checks.join(", ");
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}${consult ? " +\u00a0doctor\u00a0consult" : ""}`;
}

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
 * The check-up packages and, last, `after` (the single checks' row). Below 640px one ruled group, each
 * package a closed row that already shows its price and what it includes; from 640px cards in a grid
 * (spec U6). Catalogue-driven, so admin edits and deactivations show up here; `packages` arrives sorted
 * by sortOrder. One price per check-up; no reference ("usual") price is shown.
 */
export function Programmes({ packages, after }: { packages: Package[]; after?: ReactNode }) {
  if (packages.length === 0 && !after) return null;
  return (
    <ul
      className={cn(
        "nv-disc-group nv-chk-list mt-7 sm:mt-12 sm:grid sm:grid-cols-2 sm:gap-5 lg:mt-14",
        LG_COLS[packages.length] ?? "lg:grid-cols-3",
      )}
      {...revealProps()}
    >
      {packages.map((p) => (
        <PackageRow key={p.slug} pkg={p} />
      ))}
      {after}
    </ul>
  );
}

function PackageRow({ pkg: p }: { pkg: Package }) {
  const price = inr(p.price);
  return (
    <li className="nv-chk-pkg" style={{ "--pg-tint": programmeStyle(p.slug).tint } as CSSProperties}>
      <Disclosure
        id={`pkg-${p.slug}`}
        collapse="phone"
        leadSize="tile"
        lead={
          <span className="nv-chk-lead">
            <ProgrammeGlyph slug={p.slug} bold uid="row" className="size-10" />
          </span>
        }
        title={p.name}
        meta={packageContents(p.serviceCodes)}
        value={<span className="nv-disc-price">{price}</span>}
        head={<PackageHead pkg={p} price={price} />}
        bodyClassName="nv-chk-body"
      >
        <p className="nv-chk-tagline">{p.tagline}</p>
        <ul aria-label={`Included in ${p.name}`} className="nv-chk-tests flex flex-wrap gap-1.5 max-sm:hidden">
          {p.serviceCodes.map((c) => (
            <li
              key={c}
              className="rounded-full bg-white/75 px-2.5 py-[3px] text-[0.8125rem] leading-[1.125rem] font-medium text-ink-2"
            >
              {word(TEST_NAMES, c)}
            </li>
          ))}
        </ul>
        <CareCta name={p.name} ask={`the ${p.name} package`} from={p.price} priceLabel={price} className="nv-chk-cta" />
      </Disclosure>
    </li>
  );
}

/** The card's head from 640px, where it replaces the row: the glyph on its white tile, the name and the price. */
function PackageHead({ pkg: p, price }: { pkg: Package; price: string }) {
  return (
    <div className="nv-chk-head">
      <span aria-hidden className="nv-chk-glyph">
        <ProgrammeGlyph slug={p.slug} uid="card" className="size-14" />
      </span>
      <div className="nv-chk-id">
        <h3
          id={`check-up-${p.slug}`}
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
  );
}
