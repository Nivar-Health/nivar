import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { generalSans, notoDevanagari, notoKannada } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nivar | Doctor-led health check-ups at home",
    template: "%s | Nivar",
  },
  description:
    "Book an at-home health check-up in Bangalore. A Nivar nurse visits with smart ECG and stethoscope, a Nivar doctor reviews your readings live and video-consults you, and your report is usually ready within the hour.",
  applicationName: "Nivar",
};

export const viewport: Viewport = {
  themeColor: "#f6f8f6",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={cn(generalSans.variable, notoKannada.variable, notoDevanagari.variable, "h-full antialiased")}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster theme="light" position="top-center" closeButton richColors={false} />
      </body>
    </html>
  );
}
