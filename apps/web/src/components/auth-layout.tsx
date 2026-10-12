import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { EcgLine } from "@/components/brand/ecg-line";
import { Logo } from "@/components/brand/logo";

/**
 * Split sign-in layout. Desktop: black brand panel with a single ECG trace on
 * the left, form on the right. Mobile: single column with a slim brand header.
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
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:w-[46%] lg:max-w-[720px] lg:flex-col xl:w-1/2">

        <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
          <Link href="/" className="w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-white/40">
            <Logo size="md" variant="light" />
          </Link>

          <div className="mt-auto max-w-md pb-6">
            <p className="text-[13px] font-medium text-white/55">{eyebrow}</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1.08] text-white xl:text-5xl">
              {headline}
            </h1>
            <ul className="mt-8 flex flex-col gap-3.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[15px] leading-snug text-white/75">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-white/20">
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
            strokeClassName="stroke-white/40"
            glowClassName="stroke-signal"
            thin
          />
        </div>

        {footnote && (
          <div className="relative border-t border-white/10 px-12 py-5 text-sm text-white/50 xl:px-16">
            {footnote}
          </div>
        )}
      </aside>

      {/* Mobile brand header */}
      <header className="relative overflow-hidden bg-ink px-5 pt-5 pb-20 text-white lg:hidden">
        <div className="relative flex items-center justify-between">
          <Link href="/" className="rounded-md outline-none">
            <Logo size="sm" variant="light" />
          </Link>
          <span className="text-xs font-medium text-white/60">{eyebrow}</span>
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
      <main className="relative -mt-6 flex flex-1 flex-col rounded-t-[28px] bg-background px-5 pt-8 pb-10 sm:px-8 lg:mt-0 lg:items-center lg:justify-center lg:rounded-none lg:px-12">
        <div className="mx-auto w-full max-w-[400px] animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
