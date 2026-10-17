import { Newsreader } from "next/font/google";

/**
 * Serif accent: one italic phrase per heading. Kept out of ./fonts (which the root layout imports)
 * so that it is preloaded only on the routes that import this module: the sign-in pages
 * (via components/auth-layout.tsx). Never on the landing page, the patient app or the staff apps.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  preload: true,
  variable: "--font-newsreader",
});
