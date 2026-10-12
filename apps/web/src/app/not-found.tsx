import type { Metadata } from "next";
import Link from "next/link";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Link href="/" className="absolute top-6 left-6 rounded-md outline-none">
        <Logo size="sm" />
      </Link>
      <p className="text-[13px] font-medium text-muted-foreground">Error 404</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The link may be old, or the page may have moved. Everything else is in good health.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to home
      </Link>
      <EcgLine beats={6} animated={false} thin strokeClassName="stroke-foreground/30" className="pointer-events-none absolute inset-x-0 bottom-10 h-24" />
    </div>
  );
}
