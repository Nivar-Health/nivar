import { getCatalog } from "@/components/landing/catalog";
import { Callback } from "@/components/landing/closing";
import { Comparison } from "@/components/landing/comparison";
import { EverydayCare } from "@/components/landing/everyday-care";
import { FaqSection } from "@/components/landing/faq-section";
import { HealthRibbon } from "@/components/landing/health-ribbon";
import { Hero } from "@/components/landing/hero";
import { HowItWorksShort } from "@/components/landing/how-it-works";
import { pageMetadata } from "@/components/landing/seo";
import { Services, careCategories } from "@/components/landing/services";
import { TeamSafety } from "@/components/landing/team-safety";
import { WhoItsFor } from "@/components/landing/who-its-for";

export const metadata = pageMetadata({
  title: "Nivar Health | Your OPD, at home in HSR Layout",
  absoluteTitle: true,
  description:
    "A trained Nivar nurse comes to your home for injections, drips, dressings, tests and check-ups, and a Nivar doctor joins on video when you need one. HSR Layout and nearby, Bengaluru, 7 AM to 8 PM.",
  path: "/",
});

/**
 * One scroll: what we do (services), how it works, what it costs and why trust us (comparison,
 * who it's for, team and safety), then tips, questions and the callback form. Detail lives on
 * /services, /how-it-works and /why-nivar.
 */
export default async function HomePage() {
  const catalog = await getCatalog();
  const { packages, services } = catalog;
  const prices = packages.map((p) => p.price);
  const fromPrice = prices.length ? Math.min(...prices) : Math.min(...services.map((s) => s.price));
  const complete =
    packages.find((p) => p.slug === "complete-home-checkup")?.price ?? (prices.length ? Math.max(...prices) : 0);

  return (
    <>
      <Hero />
      <HealthRibbon />
      <Services categories={careCategories(catalog)} />
      <HowItWorksShort />
      <Comparison />
      <WhoItsFor />
      <TeamSafety />
      <EverydayCare />
      <FaqSection fromPrice={fromPrice} completePrice={complete} />
      <Callback />
    </>
  );
}
