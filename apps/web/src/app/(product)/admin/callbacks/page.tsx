import type { Metadata } from "next";
import { CallbacksPage } from "../_components/callbacks-page";

export const metadata: Metadata = { title: "Callback requests" };

export default function AdminCallbacksPage() {
  return <CallbacksPage />;
}
