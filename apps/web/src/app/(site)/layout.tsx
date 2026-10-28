import type { Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/landing/closing";
import { DisclosureHash } from "@/components/landing/disclosure-hash";
import { RevealObserver } from "@/components/landing/reveal";
import { SiteNav } from "@/components/landing/site-nav";
import { FloatingCluster } from "@/components/landing/take-a-minute/cluster";
import "@/components/landing/landing.css";

// The page runs edge to edge (under the notch in landscape); fixed chrome pads itself with env(safe-area-inset-*).
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

/** The public site: the nav, the footer and the corner cluster (Take a minute above WhatsApp). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-landing className="flex min-h-dvh flex-1 flex-col bg-background">
      {/* Appears just under the nav pill (h-16, capped at 1220px) and lines up with its left edge, so it covers none of the nav's targets. */}
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-primary text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(5.25rem+env(safe-area-inset-top))] focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:px-4 focus:py-2.5 focus-ring sm:focus:top-[calc(5.5rem+env(safe-area-inset-top))] sm:focus:left-[max(1.25rem,env(safe-area-inset-left),calc((100%_-_1220px)/2))]"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <FloatingCluster />
      <RevealObserver />
      <DisclosureHash />
    </div>
  );
}
