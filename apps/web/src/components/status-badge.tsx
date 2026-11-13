import { STATUS_META } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pill showing a booking status. `audience="patient"` uses the friendly patient wording, `"staff"`
 * the operational wording. The pill itself is neutral; the word carries the status, with the
 * status's own icon beside it (so it never rests on colour alone) or, while a visit is under way, a
 * slowly pulsing dot. The default size is 14px for patients; `sm` is the dense size for staff lists.
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
  /** Hide the status icon or dot (text only). */
  showIcon?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.confirmed;
  const label = audience === "patient" ? meta.patientLabel : meta.staffLabel;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-sm",
        meta.badgeClass,
        className,
      )}
    >
      {showIcon &&
        (meta.live ? (
          <span aria-hidden className={cn("live-dot size-1.5", meta.dotClass)} />
        ) : (
          <Icon aria-hidden className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5", meta.dotClass)} />
        ))}
      {label}
    </span>
  );
}
