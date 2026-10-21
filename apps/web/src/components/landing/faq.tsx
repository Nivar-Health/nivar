import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type FaqItem = { q: string; a: ReactNode };

/** Keeps hyphenated words (check-up) on one line, so text-pretty never breaks them at the hyphen. */
function keepHyphenated(text: string) {
  return text
    .split(/(\S+-\S+)/)
    .map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}

/**
 * Native exclusive disclosures (`<details name="faq">`): one answer open at a time, no JavaScript, and
 * closed answers stay in the HTML, so find-in-page opens them and search engines read them. Each
 * question stays an h3 inside its summary. The card (`nv-faq-item`, closing.css) carries the press
 * state, the open-state lift and the opening itself.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <details key={item.q} name="faq" className="nv-faq-item px-5 sm:px-6">
          <summary className="flex min-h-14 cursor-pointer list-none items-start justify-between gap-6 rounded-xl py-4 focus-ring sm:min-h-16 sm:py-5">
            <h3 className="text-[1.0625rem] leading-snug font-semibold text-pretty">{keepHyphenated(item.q)}</h3>
            <ChevronDown aria-hidden className="nv-faq-chev mt-0.5 size-5 shrink-0 text-primary" />
          </summary>
          <div className="nv-faq-a max-w-[52ch] pb-6 text-body text-pretty text-ink-2">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
