import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nivar | Doctor-led health check-ups at home",
    template: "%s | Nivar",
  },
  description:
    "Book an at-home health check-up in Bangalore. A Nivar nurse visits with smart ECG and stethoscope, a Nivar doctor reviews your readings live and video-consults you, and your report arrives within the hour.",
  applicationName: "Nivar",
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster theme="light" position="top-center" closeButton richColors={false} />
      </body>
    </html>
  );
}
