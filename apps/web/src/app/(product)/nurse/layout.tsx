import { CalendarCheck } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { StaffShell } from "@/components/staff-shell";

export default function NurseLayout({ children }: LayoutProps<"/nurse">) {
  return (
    <RequireRole role="nurse">
      <StaffShell
        roleLabel="Nurse"
        width="narrow"
        mobileNav="bottom"
        nav={[{ href: "/nurse", label: "Today", icon: <CalendarCheck /> }]}
      >
        {children}
      </StaffShell>
    </RequireRole>
  );
}
