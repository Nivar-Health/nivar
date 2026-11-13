import type { Metadata } from "next";
import { BookWizard } from "../_components/book-wizard";

export const metadata: Metadata = { title: "Book a check-up" };

/**
 * `?package=` (a package id or slug) and `?test=` (one test code) open the booking with a check-up
 * already chosen, as Home's package tiles do. "Book again" adds `?services=` (bookAgainHref in
 * _components/shared.tsx), which the wizard reads from the URL itself; it is part of the key so a
 * second "Book again" starts a fresh wizard.
 */
export default async function BookPage({ searchParams }: PageProps<"/app/book">) {
  const sp = await searchParams;
  const pkg = typeof sp.package === "string" ? sp.package : null;
  const test = typeof sp.test === "string" ? sp.test.toUpperCase() : null;
  const services = typeof sp.services === "string" ? sp.services.toUpperCase() : "";
  return <BookWizard key={`${pkg ?? ""}|${test ?? ""}|${services}`} initialPackage={pkg} initialTest={test} />;
}
