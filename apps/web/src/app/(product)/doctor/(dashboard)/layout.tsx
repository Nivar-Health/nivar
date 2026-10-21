import { Stethoscope } from "lucide-react";
import { StaffShell } from "@/components/staff-shell";

export default function DoctorDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffShell roleLabel="Doctor" width="full" nav={[{ href: "/doctor", label: "Consults", icon: <Stethoscope /> }]}>
      {children}
    </StaffShell>
  );
}
