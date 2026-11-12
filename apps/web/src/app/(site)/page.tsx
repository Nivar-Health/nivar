import { getCatalog } from "@/components/landing/catalog";
import { CheckUps } from "@/components/landing/check-ups";
import { Callback } from "@/components/landing/closing";
import { Comparison } from "@/components/landing/comparison";
import { FaqSection } from "@/components/landing/faq-section";
import { HealthTips } from "@/components/landing/health-tips";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { pageMetadata } from "@/components/landing/seo";
import { Services } from "@/components/landing/services";
import { YourNurse } from "@/components/landing/your-nurse";

export const metadata = pageMetadata({
  // The service and the place first: that is what a stranger searches for, and what a shared link shows.
  title: "Nurse at home in HSR Layout, Bengaluru | Nivar Health",
  absoluteTitle: true,
  // 150 characters, so search results and share previews show the whole sentence, price promise included.
  description:
    "A registered nurse at your home in HSR Layout, Bengaluru, for injections, IV drips, dressings, blood tests and check-ups. We tell you the price first.",
  path: "/",
});

/**
 * One page, nurse first. The decision path runs without a detour: what a nurse can do, how a visit
 * works, who comes, the comparison, the check-ups, the questions, then the callback form. Small
 * habits follows the form, for the wait and for anyone who came only to read. The ids are the nav's
 * anchors.
 */
export default async function HomePage() {
  const catalog = await getCatalog();
  const { packages, services } = catalog;
  // The FAQ quotes only what the catalogue holds: no packages, no "from" price; no Complete Home
  // Check-up, no price under its name.
  const fromPrice = packages.length ? Math.min(...packages.map((p) => p.price)) : null;
  const completePrice = packages.find((p) => p.slug === "complete-home-checkup")?.price ?? null;

  return (
    <>
      <Hero />
      <Services catalog={catalog} />
      <HowItWorks />
      <YourNurse />
      <Comparison />
      <CheckUps packages={packages} services={services} />
      <FaqSection fromPrice={fromPrice} completePrice={completePrice} />
      <Callback />
      <HealthTips />
    </>
  );
}
