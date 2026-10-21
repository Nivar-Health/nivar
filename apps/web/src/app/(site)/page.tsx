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
  title: "Nivar Health | Nurse at home in HSR Layout, Bengaluru",
  absoluteTitle: true,
  description:
    "A registered nurse at your home in HSR Layout, Bengaluru, for injections, IV drips, wound dressings, check-ups and blood tests. A Nivar doctor joins on video when needed, and we tell you the price before we confirm.",
  path: "/",
});

/**
 * One page, nurse first: what a nurse can do, how a visit works, who comes, the comparison, then the
 * check-ups, small habits, questions and the callback form. The ids are the nav's anchors.
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
      <HealthTips />
      <FaqSection fromPrice={fromPrice} completePrice={completePrice} />
      <Callback />
    </>
  );
}
