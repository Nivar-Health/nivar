import { STATUS_META } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pill showing a booking status. `audience="patient"` uses the friendly
 * patient wording, `"staff"` the operational wording. Live statuses pulse.
 */
export function StatusBadge({
  status,
  audience = "staff",
  size = "default",
  showIcon = true,
  className,
}: {
  status: BookingStatus;
  audience?: "patient" | "staff";
  size?: "sm" | "default";
  showIcon?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.confirmed;
  const Icon = meta.icon;
  const label = audience === "patient" ? meta.patientLabel : meta.staffLabel;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
        meta.badgeClass,
        className,
      )}
    >
      {meta.live ? (
        <span className={cn("live-dot size-1.5", status === "consult" ? "text-saffron" : "")} />
      ) : (
        showIcon && <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      )}
      {label}
    </span>
  );
}
