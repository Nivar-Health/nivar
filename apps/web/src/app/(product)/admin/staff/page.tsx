import type { Metadata } from "next";
import { StaffPage } from "../_components/staff-page";

export const metadata: Metadata = { title: "Staff" };

export default function AdminStaffPage() {
  return <StaffPage />;
}
