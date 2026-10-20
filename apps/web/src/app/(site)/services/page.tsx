import { getCatalog } from "@/components/landing/catalog";
import { LabTests } from "@/components/landing/lab-tests";
import { Programmes } from "@/components/landing/programmes";
import { pageMetadata } from "@/components/landing/seo";
import { ServicesOverview, careCategories } from "@/components/landing/services";

export const metadata = pageMetadata({
  title: "Services and prices",
  description:
    "Injections and vaccines, IV drips, wound care, health check-ups, ECG, lab tests and doctor consults at home in HSR Layout and nearby, Bengaluru. One price per service, told upfront.",
  path: "/services",
});

export default async function ServicesPage() {
  const catalog = await getCatalog();
  return (
    <>
      <ServicesOverview categories={careCategories(catalog)} />
      <Programmes packages={catalog.packages} />
      <LabTests services={catalog.services} />
    </>
  );
}
