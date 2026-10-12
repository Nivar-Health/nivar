import type { Metadata } from "next";
import { DoctorDashboard } from "../_components/dashboard";

export const metadata: Metadata = { title: "Consults" };

export default function DoctorHomePage() {
  return <DoctorDashboard />;
}
