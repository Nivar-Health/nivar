"use client";

import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { setUserMotionPaused, usePrefersReducedMotion, useUserMotionPaused } from "./motion";

/**
 * The page-wide switch for moving content (WCAG 2.2.2): it stops every loop, the multilingual line,
 * the live traces and the visit story, and is remembered for this visitor. Take a minute's tools are
 * started by the visitor and keep running. When the OS already asks for reduced motion nothing
 * moves, so there is nothing to offer (hidden by CSS until hydration too). The caller styles it; it
 * takes the surrounding text colour.
 */
export function MotionToggle({ className }: { className?: string }) {
  const osReduced = usePrefersReducedMotion();
  const paused = useUserMotionPaused();
  if (osReduced) return null;
  const Icon = paused ? Play : Pause;
  return (
    <button
      type="button"
      onClick={() => setUserMotionPaused(!paused)}
      className={cn("inline-flex min-h-11 items-center gap-2 focus-ring motion-reduce:hidden", className)}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {paused ? "Play animations" : "Pause animations"}
    </button>
  );
}
