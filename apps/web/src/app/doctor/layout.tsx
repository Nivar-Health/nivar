import { Stethoscope } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { StaffShell } from "@/components/staff-shell";

export default function DoctorLayout({ children }: LayoutProps<"/doctor">) {
  return (
    <RequireRole role="doctor">
      <StaffShell
        roleLabel="Doctor"
        width="full"
        nav={[{ href: "/doctor", label: "Consults", icon: <Stethoscope /> }]}
      >
        {children}
      </StaffShell>
    </RequireRole>
  );
}
