import { AppShell } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export default function PatientLayout({ children }: LayoutProps<"/app">) {
  return (
    <RequireRole role="customer">
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
