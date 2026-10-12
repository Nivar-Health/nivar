"use client";

import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type FaqItem = { q: string; a: ReactNode };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion className="border-t border-ink/10">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={`faq-${i}`} className="border-b border-ink/10 not-last:border-b">
          <AccordionTrigger className="gap-6 rounded-none py-5 text-[1.0625rem] font-semibold text-ink hover:no-underline focus-visible:ring-offset-2 sm:text-lg **:data-[slot=accordion-trigger-icon]:mt-1 **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-primary">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="max-w-[62ch] pb-6 text-[0.98rem] leading-relaxed text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
