import type { Metadata } from "next";
import { CustomersPage } from "../_components/people-pages";

export const metadata: Metadata = { title: "Customers" };

export default function AdminCustomersPage() {
  return <CustomersPage />;
}
