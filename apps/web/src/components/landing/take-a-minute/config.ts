import type { Tone, ToolId } from "./types";

/* Plain, server-safe module: the tile (server) and the shell (client) both read it. */

/** Tab and launcher order: the calm pair (Breathe, Eye break), then the pair for just before a reading. */
export const TOOL_ORDER: readonly ToolId[] = ["breathe", "eyes", "rest", "pulse"];

export const TOOL_LABEL: Readonly<Record<ToolId, string>> = { breathe: "Breathe", eyes: "Eye break", rest: "Before BP", pulse: "Pulse" };
/** Shown on the tile's launchers. The tabs carry names only: each tool states its own length. */
export const TOOL_DURATION: Readonly<Record<ToolId, string>> = { breathe: "1 to 5 min", eyes: "20 sec", rest: "5 min", pulse: "30 sec" };
/** Accessible names for the tabs and launchers. Each starts with the visible label, so "tap Before BP" finds it. */
export const TOOL_SPOKEN: Readonly<Record<ToolId, string>> = {
  breathe: "Breathe, 1 to 5 minutes",
  eyes: "Eye break, 20 seconds",
  rest: "Before BP, a 5-minute rest before a blood pressure reading",
  pulse: "Pulse, 30 seconds",
};

/** The tools for just before a reading: they follow the calm pair in the tabs, across a hairline. */
export const READING_TOOLS: readonly ToolId[] = ["rest", "pulse"];

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

/**
 * How the tools' safety lines show. "contextual": each where it applies (one quiet line under the
 * button, a text button that opens the sentence in place, or in full beside a result). "always": every
 * line in full, in the flow, in every state. The sentences are word for word the same either way, so a
 * clinical reviewer can restore always-visible text by changing this one word.
 */
export const SAFETY_DISPLAY: "contextual" | "always" = "contextual";

/** What a launcher says when the experience could not load (the corner, its status region and the tile). */
export const LOAD_FAILED = "Couldn't open. Tap again to reload.";
/** What the tile says once a tap has waited on a slow connection for 400 ms. */
export const LOAD_SLOW = "Opening…";

export function isToolId(v: unknown): v is ToolId {
  return typeof v === "string" && (TOOL_ORDER as readonly string[]).includes(v);
}

/** An enabled tool for any input: a disabled or unknown tool falls back to Breathe. */
export function enabledTool(v: unknown): ToolId {
  return isToolId(v) && TOOL_ENABLED[v] ? v : "breathe";
}

/** The deep link that opens `tool` ("" for the general entry). */
export const hashFor = (tool: ToolId | ""): string => `#take-a-minute${tool ? `-${tool}` : ""}`;

/**
 * Deep links on "/": `#take-a-minute` is the general entry ("", which opens Breathe) and
 * `#take-a-minute-<tool>` opens that tool. A disabled tool's link opens Breathe. Look up
 * `HASH[location.hash]`; undefined means not ours.
 */
export const HASH: Readonly<Record<string, ToolId | "">> = {
  [hashFor("")]: "",
  ...Object.fromEntries(TOOL_ORDER.map((id) => [hashFor(id), enabledTool(id)])),
};
