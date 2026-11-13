import { Armchair, CircleAlert, Eye, HeartPulse, Wind, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENABLED_TOOLS, LOAD_FAILED, LOAD_SLOW, TOOL_DURATION, TOOL_LABEL, TOOL_SPOKEN } from "./take-a-minute/config";
import { Pearl } from "./take-a-minute/pearl";
import type { ToolId } from "./take-a-minute/types";
import "./health-tips.css";

const ICON: Readonly<Record<ToolId, LucideIcon>> = { breathe: Wind, rest: Armchair, pulse: HeartPulse, eyes: Eye };

/** What each tool offers, in the lede's words. */
const OFFER: Readonly<Record<ToolId, string>> = {
  breathe: "slow your breathing",
  eyes: "rest your eyes",
  rest: "sit quietly before a BP reading",
  pulse: "count your pulse",
};

/** "slow your breathing, rest your eyes, or sit quietly before a BP reading": the enabled tools, in order. */
function offers(tools: readonly ToolId[]): string {
  const words = tools.map((t) => OFFER[t]);
  return words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")}, or ${words[words.length - 1]}`;
}

/**
 * The way into Take a minute from the page, at the top of Small habits: a still pearl in a pond and one
 * whole-card launcher per tool, named as everywhere else (config.ts). The launchers are markup only: the
 * corner island opens the experience for any [data-minute-open], and the orb rises from this pearl
 * (data-minute-origin inside data-minute-scope). Pulse leaves while TOOL_ENABLED.pulse is off, and
 * Breathe then spans the row. Nothing here animates but the press.
 */
export function TakeAMinuteTile({ className }: { className?: string }) {
  const tools = ENABLED_TOOLS;
  const odd = tools.length % 2 === 1;

  return (
    <div
      data-minute-scope=""
      className={cn("group/tile theme-pine nv-habits-tile relative isolate overflow-hidden rounded-3xl p-5 text-on-pine sm:p-7 lg:p-8", className)}
    >
      {/* The pearl sits in the corner; the room beside it is a float, so the title and the lede's first line
          wrap short of it and the lede's second line runs the full width. */}
      <span aria-hidden className="nv-habits-tile-room">
        <Pearl size={64} data-minute-origin="" className="nv-habits-tile-pearl" />
      </span>
      <h3 className="text-h3 text-on-pine">Take a minute.</h3>
      {/* on-pine, not on-pine-2: under the lede's first line the card is at its lightest (the jade corner and
          its glow), where on-pine-2 reaches only about 4:1. */}
      <p className="mt-1.5 text-small/[1.45] text-pretty text-on-pine">
        A short guided pause: {offers(tools)}. It opens right here.
      </p>

      <div className={cn("mt-3.5 grid grid-cols-2 gap-2 lg:grid-cols-2", odd ? "md:grid-cols-3" : "md:grid-cols-4")}>
        {tools.map((tool, i) => {
          const Icon = ICON[tool];
          return (
            <button
              key={tool}
              type="button"
              data-minute-open={tool}
              aria-haspopup="dialog"
              className={cn(
                "nv-habits-launch",
                i === 0 && "nv-habits-launch--first",
                odd && i === 0 && "col-span-2 md:col-span-1 lg:col-span-2",
              )}
            >
              <Icon aria-hidden className="nv-habits-launch-icon" strokeWidth={2} />
              <span aria-hidden className="nv-habits-launch-text">
                <span className="nv-habits-launch-name">{TOOL_LABEL[tool]}</span>
                <span className="nv-habits-launch-time">{TOOL_DURATION[tool]}</span>
              </span>
              <span className="sr-only">{TOOL_SPOKEN[tool]}</span>
            </button>
          );
        })}
      </div>

      {/* The note, "Opening…" and the failure line share one slot, so a slow or failed load swaps the words
          without moving anything: "Opening…" while a launcher carries data-minute-slow (the corner sets it
          after 400 ms), the failure through health-tips.css. The corner's status region announces the
          failure; this line is the visible half of it, on phones where the corner is hidden. */}
      <div className="nv-habits-tile-foot mt-2.5 text-[0.875rem]/[1.45]">
        <p className="nv-tile-note flex items-center gap-2 text-on-pine-3 group-has-[[data-minute-slow]]/tile:hidden">
          <Pearl size={14} />
          <span className="text-balance sm:hidden">Always in the menu, whenever you need it.</span>
          <span className="max-sm:hidden">It&apos;s also in the corner of your screen.</span>
        </p>
        <p aria-hidden="true" className="hidden items-center gap-2 text-on-pine-2 group-has-[[data-minute-slow]]/tile:flex">
          <Pearl size={14} />
          {LOAD_SLOW}
        </p>
        <p aria-hidden="true" className="nv-tile-failed text-on-pine">
          <CircleAlert aria-hidden className="mr-2 inline size-3.5 align-[-0.15em]" strokeWidth={2.25} />
          {LOAD_FAILED}
        </p>
      </div>
    </div>
  );
}
