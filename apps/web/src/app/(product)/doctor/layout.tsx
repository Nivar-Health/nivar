import { RequireRole } from "@/components/require-role";

/**
 * Every doctor route requires a signed-in doctor. The dashboard renders inside
 * the staff shell (see `(dashboard)/layout.tsx`); the consult workspace is a
 * full-bleed, immersive screen with its own header.
 */
export default function DoctorLayout({ children }: LayoutProps<"/doctor">) {
  return <RequireRole role="doctor">{children}</RequireRole>;
}
