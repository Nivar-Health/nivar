import { memo, type RefCallback } from "react";
import { Ring, type RingController } from "./ring";
import type { Tone } from "./types";

/* The stage (spec §5.7): halo, the landing ripple, the time-left ring, the orb and its text layer.
   It belongs to the shell, not to a tool, so the orb stays put across tabs and only its tone light
   crossfades. The orb has two transforms: the flight (from the launcher's pearl and back) wraps
   the tools' own scale (.62 at rest, 1 at a full breath). The text layer never scales.

   Orb layers: body (a lit sphere), one tone light per tool, an inner light that setGlow drives,
   and the pearl skin, which makes the orb look exactly like the pearl it left at the start of the
   flight and fades as it grows. Every layer moves by transform and opacity only, bound to motion
   values in motion's frame loop (anim.ts bindStyle). No filters. */

export const TONES: readonly Tone[] = ["mint", "sky", "rose", "pearl"];

type Bind = (el: HTMLElement | SVGElement | null) => (() => void) | undefined;

export type StageBinds = {
  halo: Bind;
  ripple: Bind;
  fly: Bind;
  glow: Bind;
  light: Bind;
  skin: Bind;
  mint: Bind;
  sky: Bind;
  rose: Bind;
  pearl: Bind;
};

export const Stage = memo(function Stage({
  binds: { halo, ripple, fly, glow, light, skin, mint, sky, rose, pearl },
  attachStage,
  attachOrb,
  attachText,
  attachRingSvg,
  attachRingArc,
}: {
  binds: StageBinds;
  attachStage: RefCallback<HTMLDivElement>;
  attachOrb: RefCallback<HTMLDivElement>;
  attachText: RefCallback<HTMLDivElement>;
  attachRingSvg: RingController["attachSvg"];
  attachRingArc: RingController["attachArc"];
}) {
  return (
    <div ref={attachStage} className="nv-minute-stage">
      <span ref={halo} aria-hidden className="nv-minute-halo" />
      <span ref={ripple} aria-hidden className="nv-minute-ripple" />
      <div data-nv-in="ring" className="nv-minute-ringbox">
        <Ring attachSvg={attachRingSvg} attachArc={attachRingArc} />
      </div>
      <div ref={fly} aria-hidden className="nv-minute-fly">
        <div ref={attachOrb} className="nv-minute-orb">
          <span ref={glow} className="nv-minute-orb-glow" />
          <span className="nv-minute-orb-clip">
            <span className="nv-minute-orb-body" />
            <span ref={mint} className="nv-minute-orb-tone" data-tone="mint" />
            <span ref={sky} className="nv-minute-orb-tone" data-tone="sky" />
            <span ref={rose} className="nv-minute-orb-tone" data-tone="rose" />
            <span ref={pearl} className="nv-minute-orb-tone" data-tone="pearl" />
            <span ref={light} className="nv-minute-orb-light" />
            <span ref={skin} className="nv-minute-orb-skin" />
          </span>
        </div>
      </div>
      {/* The tool's word, numeral or figure is portaled here (Layout), or the Pulse tap pad. */}
      <div ref={attachText} className="nv-minute-orb-text" />
    </div>
  );
});
