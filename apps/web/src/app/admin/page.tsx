import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminHomePage() {
  return <h1 className="font-display text-3xl font-medium tracking-tight">Dashboard</h1>;
}
