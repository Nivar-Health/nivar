import { useId } from "react";

/* The Pulse tool's still drawing: a palm-up forearm with the thumb uppermost, and the index and
   middle fingers of the other hand resting on the thumb side of the wrist, just below the base of the
   thumb, over a soft disc at the pulse point. It never moves, so nothing on screen can set a rhythm
   for the count. */

export function Wrist() {
  const fade = `nv-wrist-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg aria-hidden viewBox="0 0 96 96" className="nv-tool-figure">
      <defs>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.55" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <circle cx="47" cy="61" r="10" className="nv-tool-part-disc nv-tool-wrist-spot" />
      <path d="M2 58H52M2 76H54" className="nv-tool-line" />
      <path
        d="M52 58C55 57 58 53 60.6 47.2C62 44.2 65.8 44.8 65.6 48.2C65.4 51.6 63.8 55.4 62.4 58H74C78 58 86 57.6 89.6 59C93.6 60.6 93.6 74.4 89.6 75.8C86 77.2 78 77 74 77H54"
        className="nv-tool-line"
      />
      <path d="M76 63.4H91.4M76 67.5H92.6M76 71.6H91.6M54.5 60C53.6 64 53.6 70 54.5 74" className="nv-tool-line nv-tool-line-soft" />
      <path
        d="M39.5 24V53.6A3.5 3.5 0 0 0 46.5 53.6V24M47 22V54A3.5 3.5 0 0 0 54 54V22"
        stroke={`url(#${fade})`}
        className="nv-tool-wrist-fingers"
      />
    </svg>
  );
}
