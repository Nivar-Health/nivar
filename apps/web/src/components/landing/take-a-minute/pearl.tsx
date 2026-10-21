import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./pearl.css";

export type PearlProps = { size?: number; className?: string } & Omit<HTMLAttributes<HTMLSpanElement>, "className">;

/**
 * The Take a minute pearl, a small lit sphere. Decorative (aria-hidden). Server-safe, and it spreads
 * the remaining props, so `data-minute-origin` reaches the element.
 */
export function Pearl({ size = 34, className, style, ...rest }: PearlProps) {
  return (
    <span
      aria-hidden
      className={cn("nv-minute-pearl", className)}
      style={{ "--nv-pearl": `${size}px`, ...style } as CSSProperties}
      {...rest}
    />
  );
}
