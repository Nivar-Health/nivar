import type { ReactNode } from "react";
import { Disclosure } from "./disclosure";

/** `id` is the deep-link target (spec §1.14), e.g. "faq-cost" for /#faq-cost. */
export type FaqItem = { id: string; q: string; a: ReactNode };

/** Keeps hyphenated words (check-up) on one line, so the title's wrapping never breaks them at the hyphen. */
function keepHyphenated(text: string) {
  return text
    .split(/(\S+-\S+)/)
    .map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}

/**
 * Native disclosures in the card look (disclosure.tsx): no JavaScript and no `name`, so several answers can
 * stay open and opening one never moves another's question. Closed answers stay in the HTML, so
 * find-in-page opens them and search engines read them. Each question stays an h3 inside its summary.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Disclosure key={item.id} id={item.id} variant="card" titleTag="h3" title={keepHyphenated(item.q)}>
          {item.a}
        </Disclosure>
      ))}
    </div>
  );
}
