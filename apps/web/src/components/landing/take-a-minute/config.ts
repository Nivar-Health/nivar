import type { Tone, ToolId } from "./types";

/* Plain, server-safe module: the tile (server) and the shell (client) both read it. */

export const TOOL_ORDER: readonly ToolId[] = ["breathe", "rest", "pulse", "eyes"];

export const TOOL_LABEL: Readonly<Record<ToolId, string>> = { breathe: "Breathe", rest: "BP rest", pulse: "Pulse", eyes: "Eyes" };
export const TOOL_DURATION: Readonly<Record<ToolId, string>> = { breathe: "1–5 min", rest: "5 min", pulse: "30 sec", eyes: "20 sec" };
/** Spoken names for launchers and tabs (visible name and duration are aria-hidden beside these). */
export const TOOL_SPOKEN: Readonly<Record<ToolId, string>> = {
  breathe: "Breathe, 1 to 5 minutes", rest: "Blood pressure rest, 5 minutes", pulse: "Pulse, 30 seconds", eyes: "Eye break, 20 seconds",
};

export const TOOL_TONE: Readonly<Record<ToolId, Tone>> = {
  breathe: "mint",
  rest: "sky",
  pulse: "rose",
  eyes: "pearl",
};

/**
 * A disabled tool leaves the tabs, the tile and the deep links. Pulse waits on a Nivar doctor's
 * sign-off: on in development for review, off in production unless NEXT_PUBLIC_MINUTE_PULSE=1.
 */
export const TOOL_ENABLED: Readonly<Record<ToolId, boolean>> = {
  breathe: true,
  rest: true,
  pulse: process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MINUTE_PULSE === "1",
  eyes: true,
};

/** The enabled tools, in tab order. */
export const ENABLED_TOOLS: readonly ToolId[] = TOOL_ORDER.filter((id) => TOOL_ENABLED[id]);

export function isToolId(v: unknown): v is ToolId {
  return typeof v === "string" && (TOOL_ORDER as readonly string[]).includes(v);
}

/** An enabled tool for any input: a disabled or unknown tool falls back to Breathe. */
export function enabledTool(v: unknown): ToolId {
  return isToolId(v) && TOOL_ENABLED[v] ? v : "breathe";
}

/**
 * Deep links on "/": `#take-a-minute` opens the last-used tool ("") and `#take-a-minute-<tool>` that
 * tool. A disabled tool's link opens Breathe. Look up `HASH[location.hash]`; undefined means not ours.
 */
export const HASH: Readonly<Record<string, ToolId | "">> = {
  "#take-a-minute": "",
  ...Object.fromEntries(TOOL_ORDER.map((id) => [`#take-a-minute-${id}`, enabledTool(id)])),
};
