import type { Metadata } from "next";
import { VisitView } from "../../_components/visit-view";

export const metadata: Metadata = { title: "Visit" };

export default async function NurseVisitPage(props: PageProps<"/nurse/visits/[id]">) {
  const { id } = await props.params;
  return <VisitView bookingId={id} />;
}
