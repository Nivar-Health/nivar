import type { Metadata } from "next";
import Link from "next/link";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";
import { EmergencyText } from "@/components/landing/callback-form";
import { buttonClass } from "@/components/landing/primitives";
import "@/components/landing/landing.css";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Outside the site's layout (any unknown address lands here, app routes included), so it carries the
 * public site's skin itself: data-landing for the teal tokens. People arrive from old shared links or
 * a mistyped address, sometimes while trying to get help, so it offers the next step and the
 * emergency numbers.
 */
export default function NotFound() {
  return (
    <div data-landing className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-background text-ink">
      <header className="px-5 pt-5 sm:px-8 sm:pt-6">
        <Link href="/" aria-label="Nivar home" className="inline-flex min-h-11 items-center rounded-xl p-1 focus-ring">
          <Logo size="sm" />
        </Link>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pt-10 pb-40 sm:px-8 sm:text-center">
        <p className="text-small font-semibold text-primary">Page not found</p>
        <h1 className="mt-3 text-h2 text-balance text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-4 text-lede text-pretty text-ink-2">
          The link may be old, or the page may have moved. You can go back to the home page, or ask us to call you.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className={buttonClass("primary", "max-sm:h-14 max-sm:w-full", "lg")}>
            Go to the home page
          </Link>
          <Link href="/#callback" className={buttonClass("secondary", "max-sm:h-14 max-sm:w-full", "lg")}>
            Request a callback
          </Link>
        </div>
        <p className="mt-8 text-small text-pretty text-ink-2">
          <EmergencyText />
        </p>
      </main>
      <EcgLine
        beats={6}
        animated={false}
        thin
        strokeClassName="stroke-primary/20"
        className="pointer-events-none absolute inset-x-0 bottom-10 h-24"
      />
    </div>
  );
}
