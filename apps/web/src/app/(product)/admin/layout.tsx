import {
  ClipboardList,
  Contact,
  Inbox,
  LayoutDashboard,
  PackageOpen,
  UsersRound,
} from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { StaffShell } from "@/components/staff-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <RequireRole role="admin">
      <StaffShell
        roleLabel="Admin"
        width="wide"
        nav={[
          { href: "/admin", label: "Dashboard", icon: <LayoutDashboard /> },
          { href: "/admin/bookings", label: "Bookings", icon: <ClipboardList /> },
          { href: "/admin/staff", label: "Staff", icon: <UsersRound /> },
          { href: "/admin/packages", label: "Packages", icon: <PackageOpen /> },
          { href: "/admin/customers", label: "Customers", icon: <Contact /> },
          { href: "/admin/leads", label: "Leads", icon: <Inbox /> },
        ]}
      >
        {children}
      </StaffShell>
    </RequireRole>
  );
}
