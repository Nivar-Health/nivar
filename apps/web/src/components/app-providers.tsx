"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";

/** The sign-in session, tooltips and toasts. Only the product routes load them; the public site needs none. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthProvider>
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </AuthProvider>
      <Toaster theme="light" position="top-center" closeButton richColors={false} />
    </>
  );
}
