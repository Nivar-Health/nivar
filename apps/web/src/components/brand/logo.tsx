import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoVariant = "default" | "light";

const MARK_SIZE: Record<LogoSize, string> = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
  xl: "size-14",
};

const WORD_SIZE: Record<LogoSize, string> = {
  sm: "text-[1.2rem]",
  md: "text-[1.4rem]",
  lg: "text-[1.75rem]",
  xl: "text-[2.4rem]",
};

const GAP: Record<LogoSize, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
  xl: "gap-3.5",
};

/**
 * The Nivar mark: a rounded tile holding a single stroke that reads as both
 * a roof line (home) and an ECG pulse, with a signal-green dot on the right.
 */
export function LogoMark({
  className,
  variant = "default",
  title,
}: {
  className?: string;
  variant?: LogoVariant;
  title?: string;
}) {
  const tile = variant === "light" ? "#FFFFFF" : "#0A0A0A";
  const stroke = variant === "light" ? "#0A0A0A" : "#FFFFFF";
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx="9" fill={tile} />
      <path
        d="M5 18.5H9.6L16 9.5L20.1 23L22.6 18.5H27"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.6" cy="10.4" r="2.5" fill="#19C37D" />
    </svg>
  );
}

export function Logo({
  size = "md",
  variant = "default",
  showWordmark = true,
  className,
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center", GAP[size], className)}
      aria-label="Nivar"
      role="img"
    >
      <LogoMark className={MARK_SIZE[size]} variant={variant} />
      {showWordmark && (
        <span
          aria-hidden
          className={cn(
            "font-display leading-none font-semibold tracking-[-0.03em]",
            WORD_SIZE[size],
            variant === "light" ? "text-white" : "text-ink",
          )}
        >
          nivar
          <span className="text-signal">.</span>
        </span>
      )}
    </span>
  );
}
