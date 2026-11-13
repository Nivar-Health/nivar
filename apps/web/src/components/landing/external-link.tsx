import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Underlined source link that opens in a new tab. Inline, so its press is a tint only: transforms don't
 * apply to inline boxes. The ::before stretches the hit area to 45px tall around a 14px line.
 */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative rounded-sm underline decoration-current/40 underline-offset-[3px] transition-colors duration-180 before:absolute before:-inset-x-1 before:-inset-y-3.5 hover:text-foreground hover:decoration-current focus-ring active:bg-aqua/60 active:duration-90",
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
