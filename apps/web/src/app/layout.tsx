import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { generalSans, notoDevanagari, notoKannada } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Share previews (og:image, twitter:image) resolve against this. Without it they pointed at localhost.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || SITE.url),
  title: {
    default: "Nivar Health | Your OPD, at home",
    template: "%s | Nivar Health",
  },
  description:
    "A registered Nivar nurse comes to your home in HSR Layout and nearby, Bengaluru, for injections, drips, dressings, tests and check-ups, and a Nivar doctor joins on video when you need one.",
  applicationName: "Nivar Health",
};

export const viewport: Viewport = {
  themeColor: "#f6f8f6",
  colorScheme: "light",
};

/** The document shell only. The session, tooltips and toasts live in app/(product)/layout.tsx, so the public site never loads them. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={cn(generalSans.variable, notoKannada.variable, notoDevanagari.variable, "h-full antialiased")}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
