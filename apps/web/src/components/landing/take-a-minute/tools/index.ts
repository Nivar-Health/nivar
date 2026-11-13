import { lazy, type FC } from "react";
import { TOOL_ENABLED } from "../config";
import type { ToolId, ToolProps } from "../types";
import { Breathe } from "./breathe";
import { Eyes } from "./eyes";
import { Rest } from "./rest";

/* The tools. Each renders through the shell's Layout slots and drives the orb, ring, field, sound,
   haptics and live region only through the ExperienceApi. The shell shows only the enabled ones
   (config.ts TOOL_ENABLED). Pulse waits on a doctor's sign-off: it is its own chunk, fetched only where
   it is enabled, so production never downloads its code or its copy. The shell renders it in a Suspense
   boundary. */

const Off: FC<ToolProps> = () => null;

export const TOOLS: Record<ToolId, FC<ToolProps>> = {
  breathe: Breathe,
  eyes: Eyes,
  rest: Rest,
  pulse: TOOL_ENABLED.pulse ? lazy(() => import("./pulse").then((m) => ({ default: m.Pulse }))) : Off,
};
