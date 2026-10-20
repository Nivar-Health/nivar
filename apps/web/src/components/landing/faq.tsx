"use client";

import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type FaqItem = { q: string; a: ReactNode };

/**
 * Without JavaScript the triggers cannot open anything, so every answer simply shows (chevrons hidden).
 * In @layer base because Tailwind's preflight hides [hidden] with a layered !important, which an
 * unlayered !important cannot beat.
 */
const NO_JS_CSS =
  "@layer base{[data-faq] [data-slot=accordion-content][hidden]{display:block!important;content-visibility:visible}" +
  "[data-faq] [data-slot=accordion-trigger-icon]{display:none}}";

/**
 * Keeps hyphenated words (check-up) on one line, so text-pretty never breaks them at the hyphen.
 * The caller wraps the result in one <span>, because the trigger is a flex container.
 */
function keepHyphenated(text: string) {
  return text
    .split(/(\S+-\S+)/)
    .map((part, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{part}</span> : part));
}

/**
 * Closed answers stay in the HTML (hidden="until-found"), so the browser's find-in-page can open them
 * and search engines can read them.
 * `focus-visible:after:hidden` cancels the base trigger's focus ::after, which would otherwise become a
 * zero-width flex item and shift the chevron by the 24px gap whenever the trigger takes focus.
 * `transition-[color]` replaces the base `transition-all`, which tweened the focus outline in from
 * 3px/0 offset at half opacity to the 2px/2px focus-ring over 150ms; now the ring snaps on like every
 * other control and only the open-state text colour eases (160ms, standard curve, section 5.1).
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <>
      <noscript>
        <style>{NO_JS_CSS}</style>
      </noscript>
      <Accordion data-faq="" hiddenUntilFound className="flex flex-col gap-3">
        {items.map((item, i) => (
          <AccordionItem
            key={item.q}
            value={`faq-${i}`}
            className="rounded-2xl border-0 bg-white px-5 shadow-xs ring-1 ring-ink/5 transition-shadow duration-300 data-[open]:shadow-[0_18px_40px_-28px_rgb(1_43_54/0.5)] sm:px-6"
          >
            <AccordionTrigger className="min-h-16 cursor-pointer gap-6 rounded-xl border-0 py-5 text-[1.0625rem] leading-snug font-semibold text-pretty text-ink transition-[color] duration-160 ease-standard hover:no-underline focus-visible:ring-0 focus-visible:after:hidden focus-ring aria-expanded:text-primary **:data-[slot=accordion-trigger-icon]:mt-0.5 **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-primary">
              <span>{keepHyphenated(item.q)}</span>
            </AccordionTrigger>
            <AccordionContent className="max-w-[62ch] pb-6 text-body text-pretty text-ink-2">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
