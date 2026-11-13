import { cn } from "@/lib/utils";
import { LANGUAGES, LIKE_FAMILY } from "./l10n";

const NAMES: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.lang, l.english]));

/**
 * "Cared for like family" in English, Kannada and Hindi: three lines that stand together and never
 * change, so every reader finds their own language at once. Screen readers get one sentence that names
 * the languages. The Noto faces arrive as the lines near the screen (reveal.tsx).
 */
export function HealthWords({ className }: { className?: string }) {
  const [en, ...indic] = LIKE_FAMILY;

  return (
    <div className={cn("flex items-center gap-3 sm:gap-4", className)}>
      <p className="sr-only">
        {en.text} Also in{" "}
        {indic.map((p, k) => (
          <span key={p.lang}>
            {k === indic.length - 1 ? "and " : ""}
            {NAMES[p.lang]}, <span lang={p.lang}>{p.text}</span>
            {k === indic.length - 1 ? "." : "; "}
          </span>
        ))}
      </p>

      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(1_76_94/0.5)] ring-1 ring-aqua-2 sm:size-12"
      >
        <svg viewBox="0 0 28 16" fill="none" className="h-4 w-6 text-rose sm:h-5 sm:w-7">
          <path
            d="M1 9h7l2.5 0 2-6 2.5 11 2-5h10"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {/* The Indic lines keep the page's 1.6 line height for their scripts (globals.css), so a line that
          wraps on the narrowest phones never touches the next. */}
      <div aria-hidden="true" className="min-w-0 font-semibold text-primary">
        {LIKE_FAMILY.map((p) => (
          <span
            key={p.lang}
            lang={p.lang}
            className={cn(
              "block text-balance",
              p.lang === "en-IN"
                ? "text-[1.25rem] leading-[1.3] tracking-[-0.025em] sm:text-[1.75rem] sm:leading-[1.25] lg:text-[2rem]"
                : "text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem]",
            )}
          >
            {p.text}
          </span>
        ))}
      </div>
    </div>
  );
}
