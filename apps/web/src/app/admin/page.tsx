import type { Metadata } from "next";
import { AdminDashboard } from "./_components/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminHomePage() {
  return <AdminDashboard />;
}
