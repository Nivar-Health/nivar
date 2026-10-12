import type { Metadata } from "next";
import { BookWizard } from "../_components/book-wizard";

export const metadata: Metadata = { title: "Book a check-up" };

export default async function BookPage({ searchParams }: PageProps<"/app/book">) {
  const sp = await searchParams;
  const pkg = typeof sp.package === "string" ? sp.package : null;
  const test = typeof sp.test === "string" ? sp.test.toUpperCase() : null;
  return <BookWizard key={`${pkg ?? ""}|${test ?? ""}`} initialPackage={pkg} initialTest={test} />;
}
