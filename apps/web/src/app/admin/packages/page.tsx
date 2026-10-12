import type { Metadata } from "next";
import { PackagesPage } from "../_components/packages-page";

export const metadata: Metadata = { title: "Packages" };

export default function AdminPackagesPage() {
  return <PackagesPage />;
}
