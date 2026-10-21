import { Armchair, Eye, HeartPulse, Wind, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_ENABLED } from "./take-a-minute/config";
import { Pearl } from "./take-a-minute/pearl";
import type { ToolId } from "./take-a-minute/types";
import "./health-tips.css";

const LAUNCHERS: readonly { tool: ToolId; label: string; icon: LucideIcon }[] = [
  { tool: "breathe", label: "Start breathing", icon: Wind },
  { tool: "rest", label: "Rest before a BP reading", icon: Armchair },
  { tool: "pulse", label: "Check your pulse", icon: HeartPulse },
  { tool: "eyes", label: "Rest your eyes", icon: Eye },
];

const LAUNCHER =
  "relative flex min-h-[3.25rem] items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-[0.9375rem] leading-[1.2] font-semibold text-balance focus-ring transition-[background-color,scale] duration-180 active:scale-[0.97] active:duration-90 motion-reduce:active:scale-100 [&_svg]:size-[18px] [&_svg]:shrink-0 max-[379px]:[&_svg]:hidden";

/**
 * The way into Take a minute from the page: a still pearl in a pond and one button per tool. The
 * buttons are markup-only launchers (the corner cluster opens the experience); the morph starts from
 * this pearl. Pulse leaves while TOOL_ENABLED.pulse is off. Nothing here animates.
 */
export function TakeAMinuteTile({ className }: { className?: string }) {
  const launchers = LAUNCHERS.filter((l) => TOOL_ENABLED[l.tool]);
  const odd = launchers.length % 2 === 1;
  const tools = TOOL_ENABLED.pulse
    ? "A breathing guide, a five-minute rest before a blood pressure reading, a pulse count and a 20-second eye break."
    : "A breathing guide, a five-minute rest before a blood pressure reading and a 20-second eye break.";

  return (
    <div
      data-minute-scope=""
      className={cn(
        "theme-pine nv-habits-tile relative isolate flex flex-col overflow-hidden rounded-3xl p-5 text-on-pine sm:p-7 lg:p-8",
        className,
      )}
    >
      <div className="nv-habits-tile-copy flow-root">
        <Pearl size={96} data-minute-origin="" className="nv-habits-tile-pearl" />
        <h3 className="text-h3 text-on-pine">Take a minute.</h3>
        <p className="mt-1.5 max-w-[46ch] text-small/[1.5] text-pretty text-on-pine-2 sm:mt-2 sm:text-small">
          {tools} It opens right here, whenever you need it.
        </p>
      </div>

      <div className="nv-habits-tile-launch mt-auto pt-4 sm:pt-6">
        <div
          className={cn(
            "grid grid-cols-2 gap-2 lg:grid-cols-2",
            odd ? "md:grid-cols-3" : "md:grid-cols-4",
          )}
        >
          {launchers.map(({ tool, label, icon: Icon }, i) => (
            <button
              key={tool}
              type="button"
              data-minute-open={tool}
              aria-haspopup="dialog"
              className={cn(
                LAUNCHER,
                i === 0
                  ? "bg-on-pine text-ink hover:bg-white active:bg-white/85 [&_svg]:text-primary"
                  : "bg-white/[0.07] text-on-pine ring-1 ring-white/12 ring-inset hover:bg-white/12 active:bg-white/16 [&_svg]:text-mint-glow",
                odd && i === 0 && "col-span-2 md:col-span-1 lg:col-span-2",
              )}
            >
              <Icon aria-hidden strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-caption text-on-pine-3">
          <Pearl size={14} />
          It&apos;s also in the corner of your screen.
        </p>
      </div>
    </div>
  );
}
