import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Calm, branded loading state: the Nivar mark with a soft heartbeat. */
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
      className={cn(
        "fixed inset-0 z-40 grid place-items-center bg-background",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <span className="relative grid size-16 place-items-center">
          <span aria-hidden className="absolute inset-1 rounded-[22px] bg-primary/20 animate-pulse-ring" />
          <LogoMark className="relative size-14 animate-heartbeat drop-shadow-sm" />
        </span>
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {label}
          <span aria-hidden className="inline-flex gap-1">
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
          </span>
        </span>
      </div>
    </div>
  );
}
