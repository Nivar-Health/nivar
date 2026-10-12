import type { Metadata } from "next";
import { ConsultWorkspace } from "../../_components/workspace";

export const metadata: Metadata = { title: "Consult workspace" };

export default async function ConsultPage(props: PageProps<"/doctor/consults/[id]">) {
  const { id } = await props.params;
  return <ConsultWorkspace bookingId={id} />;
}
