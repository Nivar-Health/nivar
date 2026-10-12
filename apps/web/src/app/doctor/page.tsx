import type { Metadata } from "next";

export const metadata: Metadata = { title: "Consults" };

export default function DoctorHomePage() {
  return <h1 className="font-display text-3xl font-medium tracking-tight">Consults</h1>;
}
