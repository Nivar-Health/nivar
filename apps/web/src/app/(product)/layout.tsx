import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app-providers";

// Sign-in, the patient app, the staff consoles and the dev showcase are not for search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The product: patient app, staff consoles, their sign-in pages and the dev showcase. One layout for
 * all of them, so the session survives the client navigation from sign-in to the app.
 */
export default function ProductLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
