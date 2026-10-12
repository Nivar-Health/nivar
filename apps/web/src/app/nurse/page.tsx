import type { Metadata } from "next";

export const metadata: Metadata = { title: "Today's visits" };

export default function NurseHomePage() {
  return <h1 className="font-display text-3xl font-medium tracking-tight">Today&apos;s visits</h1>;
}
