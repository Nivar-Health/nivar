import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { newsreader } from "@/app/accent-font";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Split sign-in layout. Desktop: deep pine brand panel on faint ECG paper with a single
 * trace on the left, form on the right. Mobile: single column with a slim pine brand header.
 */
export function AuthLayout({
  eyebrow,
  headline,
  points,
  footnote,
  children,
}: {
  eyebrow: string;
  headline: ReactNode;
  points: string[];
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(newsreader.variable, "flex min-h-dvh flex-1 flex-col lg:flex-row")}>
      {/* Brand panel (desktop) */}
      <aside className="theme-pine relative hidden overflow-hidden lg:flex lg:w-[46%] lg:max-w-[720px] lg:flex-col xl:w-1/2">
        <div aria-hidden className="absolute inset-0 bg-ecg-grid-dark" />

        <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
          <Link href="/" className="w-fit rounded-md focus-ring">
            <Logo size="md" variant="light" />
          </Link>

          <div className="mt-auto max-w-md pb-6">
            <p className="text-[13px] font-medium text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1.08] text-foreground xl:text-5xl">
              {headline}
            </h1>
            <ul className="mt-8 flex flex-col gap-3.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[15px] leading-snug text-pretty text-foreground-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-border-strong">
                    <Check className="size-3 text-signal" strokeWidth={2.5} aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative h-36">
          <EcgLine
            beats={5}
            className="absolute inset-x-0 bottom-10 h-28"
            strokeClassName="stroke-white/30"
            glowClassName="stroke-signal"
            thin
          />
        </div>

        {footnote && (
          <div className="relative border-t border-border px-12 py-5 text-sm text-muted-foreground xl:px-16">
            {footnote}
          </div>
        )}
      </aside>

      {/* Mobile brand header */}
      <header className="theme-pine relative overflow-hidden px-5 pt-5 pb-20 lg:hidden">
        <div className="relative flex items-center justify-between">
          <Link href="/" className="rounded-md focus-ring">
            <Logo size="sm" variant="light" />
          </Link>
          <span className="text-xs font-medium text-muted-foreground">{eyebrow}</span>
        </div>
        <EcgLine
          beats={3}
          className="absolute inset-x-0 bottom-5 h-12"
          strokeClassName="stroke-white/40"
          glowClassName="stroke-signal"
          thin
        />
      </header>

      {/* Form column */}
      <main className="relative -mt-6 flex flex-1 flex-col rounded-t-3xl bg-background px-5 pt-8 pb-10 sm:px-8 lg:mt-0 lg:items-center lg:justify-center lg:rounded-none lg:px-12">
        <div className="mx-auto w-full max-w-[400px] animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
