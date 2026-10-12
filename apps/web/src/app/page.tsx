import type { Metadata } from "next";
import { getCatalog } from "@/components/landing/catalog";
import { Callback, FinalCta, SiteFooter } from "@/components/landing/closing";
import { Coverage } from "@/components/landing/coverage";
import { Devices } from "@/components/landing/devices";
import { Doctors } from "@/components/landing/doctors";
import { FaqSection } from "@/components/landing/faq-section";
import { ForWhom } from "@/components/landing/for-whom";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Packages } from "@/components/landing/packages";
import { SiteNav } from "@/components/landing/site-nav";
import { Testimonials } from "@/components/landing/testimonials";
import { TrustStrip } from "@/components/landing/trust-strip";

const TITLE = "Nivar | Doctor-led health check-ups at home in Bangalore";
const DESCRIPTION =
  "A Nivar nurse visits with a smart ECG and stethoscope, a full-time Nivar doctor reviews your readings live and consults you on video, and your report and prescription arrive in about an hour.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Nivar",
    locale: "en_IN",
    title: "Your doctor's check-up, at home within the hour",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Your doctor's check-up, at home within the hour",
    description: DESCRIPTION,
  },
};

export default async function LandingPage() {
  const { packages, services } = await getCatalog();
  const prices = packages.map((p) => p.price);
  const fromPrice = prices.length ? Math.min(...prices) : Math.min(...services.map((s) => s.price));
  const complete =
    packages.find((p) => p.slug === "complete-home-checkup")?.price ?? (prices.length ? Math.max(...prices) : 0);

  return (
    <div data-landing className="flex min-h-dvh flex-1 flex-col bg-ivory">
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        <Hero fromPrice={fromPrice} />
        <TrustStrip />
        <HowItWorks />
        <Packages packages={packages} services={services} />
        <Devices />
        <Doctors />
        <ForWhom />
        <Coverage />
        <Testimonials />
        <FaqSection fromPrice={fromPrice} completePrice={complete} />
        <Callback />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
