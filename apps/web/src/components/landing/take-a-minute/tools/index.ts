import type { FC } from "react";
import type { ToolId, ToolProps } from "../types";
import { Breathe } from "./breathe";
import { Eyes } from "./eyes";
import { Pulse } from "./pulse";
import { Rest } from "./rest";

/* The four tools (spec §5.6). Each renders through the shell's Layout slots and drives the orb, ring,
   field, sound, haptics and live region only through the ExperienceApi. The shell shows only the
   enabled ones (config.ts TOOL_ENABLED), so Pulse stays out of the tabs until a doctor signs it off. */

export const TOOLS: Record<ToolId, FC<ToolProps>> = {
  breathe: Breathe,
  rest: Rest,
  pulse: Pulse,
  eyes: Eyes,
};
