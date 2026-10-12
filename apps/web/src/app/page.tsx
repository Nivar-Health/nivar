import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";

// Placeholder landing page. The full marketing page replaces this (Task D).
export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-ecg-grid">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Logo size="md" />
        <Link
          href="/staff/login"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Staff sign in
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-40 md:px-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Now in Bangalore</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] font-medium tracking-tight md:text-7xl">
          Doctor-led health check-ups, <span className="text-primary italic">at home.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          A Nivar nurse visits with a smart ECG and stethoscope. A Nivar doctor watches your readings live,
          consults over video and sends your report within the hour.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-lift transition-colors hover:bg-primary/90"
          >
            Book a home check-up
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/staff/login"
            className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-6 text-[15px] font-semibold transition-colors hover:bg-muted"
          >
            Staff console
          </Link>
        </div>
      </main>
      <EcgLine beats={7} className="pointer-events-none absolute inset-x-0 bottom-8 h-32" />
    </div>
  );
}
