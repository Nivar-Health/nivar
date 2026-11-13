import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Calm, branded loading state: the Nivar mark breathing slowly above a short line of text. It fades
 * in after a moment, so a fast load never flashes it. The text is the status a screen reader hears;
 * the breath stops under reduced motion or the visitor's pause (motion-loop).
 */
export function FullScreenLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("fixed inset-0 z-40 grid place-items-center bg-background", className)}
    >
      <div className="flex animate-in flex-col items-center gap-4 delay-300 duration-300 fade-in fill-mode-both">
        <LogoMark className="motion-loop size-12 animate-breathe" />
        <p className="text-small font-medium text-foreground-2">{label}</p>
      </div>
    </div>
  );
}
