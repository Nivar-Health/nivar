import localFont from "next/font/local";
import { Noto_Sans_Devanagari, Noto_Sans_Kannada } from "next/font/google";

/**
 * Brand face for all UI. Every weight listed here is preloaded on every page, so 700 (product pages
 * only) is a plain @font-face in globals.css that joins this family by name.
 */
export const generalSans = localFont({
  variable: "--font-general",
  display: "swap",
  src: [
    { path: "../../public/fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
  ],
});

/**
 * Indic glyphs only. Never preloaded; unicode-range means Latin pages never download them, and
 * globals.css applies them only once Indic text is about to be seen (reveal.tsx).
 */
export const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-noto-kn",
});

export const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-noto-deva",
});
