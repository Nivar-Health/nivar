import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

export default function PatientHomePage() {
  return <h1 className="font-display text-3xl font-medium tracking-tight">Your health, at home</h1>;
}
