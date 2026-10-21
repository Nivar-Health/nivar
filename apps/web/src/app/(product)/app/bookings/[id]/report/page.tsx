import type { Metadata } from "next";
import { MedicalReport } from "../../../_components/medical-report";

export const metadata: Metadata = { title: "Medical report" };

export default async function ReportPage({ params }: PageProps<"/app/bookings/[id]/report">) {
  const { id } = await params;
  return <MedicalReport key={id} id={id} />;
}
