import { AppShell } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";
import { NamePrompt } from "./_components/name-prompt";

export default function PatientLayout({ children }: LayoutProps<"/app">) {
  return (
    <RequireRole role="customer">
      <AppShell>
        {children}
        <NamePrompt />
      </AppShell>
    </RequireRole>
  );
}
