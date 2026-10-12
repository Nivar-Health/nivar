import type { Metadata } from "next";
import { LeadsPage } from "../_components/people-pages";

export const metadata: Metadata = { title: "Leads" };

export default function AdminLeadsPage() {
  return <LeadsPage />;
}
