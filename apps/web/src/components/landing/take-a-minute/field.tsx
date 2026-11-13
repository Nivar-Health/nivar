import { memo } from "react";

/* The field behind the sheet: a still jade pool and a dimmer for the eye break. Nothing here moves or
   repaints while a session runs. The mint pool that breathes with Breathe belongs to the stage
   (orb.tsx), so it stays behind the orb wherever the sheet scrolls. No backdrop-filter, no blur filters. */

type Bind = (el: HTMLElement | SVGElement | null) => (() => void) | undefined;

/** The field's bound layers (anim.ts bindStyle): its fade and the dimmer. */
export type FieldBinds = { fade: Bind; dim: Bind };

export const Field = memo(function Field({ binds: { fade, dim } }: { binds: FieldBinds }) {
  return (
    <div ref={fade} aria-hidden className="nv-minute-field">
      <span className="nv-minute-pool" />
      <span ref={dim} className="nv-minute-field-dim" />
    </div>
  );
});
