import type { Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/landing/closing";
import { RevealObserver } from "@/components/landing/reveal";
import { SiteNav } from "@/components/landing/site-nav";
import { WhatsAppFab } from "@/components/landing/whatsapp";
import "@/components/landing/landing.css";

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

/** The public site: home, Services, How it works and Why Nivar Health? share the nav, footer and WhatsApp button. */
export default function SiteLayout({ children }: { children: ReactNode }) {
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
        {children}
      </main>
      <SiteFooter />
      <WhatsAppFab />
      <RevealObserver />
    </div>
  );
}
