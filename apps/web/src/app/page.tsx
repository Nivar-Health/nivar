import type { Metadata } from "next";
import { getCatalog } from "@/components/landing/catalog";
import { Callback, SiteFooter } from "@/components/landing/closing";
import { Devices } from "@/components/landing/devices";
import { Doctors } from "@/components/landing/doctors";
import { EverydayCare } from "@/components/landing/everyday-care";
import { Families } from "@/components/landing/families";
import { FaqSection } from "@/components/landing/faq-section";
import { HealthFacts } from "@/components/landing/health-facts";
import { HealthRibbon } from "@/components/landing/health-ribbon";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LiveSection } from "@/components/landing/live-section";
import { Pricing } from "@/components/landing/pricing";
import { Programmes } from "@/components/landing/programmes";
import { RevealObserver } from "@/components/landing/reveal";
import { SiteNav } from "@/components/landing/site-nav";
import "@/components/landing/landing.css";

const TITLE = "Nivar | Doctor-led health check-ups at home";
const DESCRIPTION =
  "A Nivar nurse visits your home in Bangalore with a smart ECG and stethoscope, a full-time Nivar doctor watches your readings live and consults on video, and your report is usually ready within the hour.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Nivar",
    locale: "en_IN",
    title: "Your doctor's check-up, at your doorstep.",
    description: DESCRIPTION,
    images: [{ url: "/img/doctor.jpg", width: 1600, height: 1194, alt: "A Nivar doctor reviewing live readings" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your doctor's check-up, at your doorstep.",
    description: DESCRIPTION,
    images: ["/img/doctor.jpg"],
  },
};

export default async function LandingPage() {
  const { packages, services } = await getCatalog();
  const prices = packages.map((p) => p.price);
  const fromPrice = prices.length ? Math.min(...prices) : Math.min(...services.map((s) => s.price));
  const complete =
    packages.find((p) => p.slug === "complete-home-checkup")?.price ?? (prices.length ? Math.max(...prices) : 0);

  return (
    <div data-landing className="flex min-h-dvh flex-1 flex-col bg-background">
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-ring"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        <Hero fromPrice={fromPrice} />
        <HealthRibbon />
        <Programmes packages={packages} />
        <HowItWorks />
        <HealthFacts />
        <LiveSection />
        <Devices />
        <Pricing packages={packages} services={services} />
        <Families />
        <EverydayCare />
        <Doctors />
        <FaqSection fromPrice={fromPrice} completePrice={complete} />
        <Callback />
      </main>
      <SiteFooter />
      <RevealObserver />
    </div>
  );
}
