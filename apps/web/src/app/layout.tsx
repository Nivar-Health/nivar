import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { generalSans, notoDevanagari, notoKannada } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Share previews (og:image, twitter:image) resolve against this. Without it they pointed at localhost.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || SITE.url),
  title: {
    default: "Nivar Health | Nurse at home in Bengaluru",
    template: "%s | Nivar Health",
  },
  // The home page's own sentence, so every page without one describes Nivar the same way.
  description:
    "A registered nurse at your home in HSR Layout, Bengaluru, for injections, IV drips, dressings, blood tests and check-ups. We tell you the price first.",
  applicationName: "Nivar Health",
  // iOS Safari would otherwise turn readings, booking codes and prices into tap-to-call links.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f6fafb",
  colorScheme: "light",
};

/** The document shell only. The session, tooltips and toasts live in app/(product)/layout.tsx, so the public site never loads them. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={cn(generalSans.variable, notoKannada.variable, notoDevanagari.variable, "h-full antialiased")}
      // The public site marks <html> before React hydrates (SiteRoot in landing/chrome-signals.ts).
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
