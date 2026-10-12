"use client";

import type { ReactNode } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type FaqItem = { q: string; a: ReactNode };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion className="border-t border-border">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={`faq-${i}`} className="border-b border-border not-last:border-b">
          <AccordionTrigger className="gap-6 rounded-none border-0 py-5 text-[1.0625rem] leading-snug font-medium text-foreground hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 **:data-[slot=accordion-trigger-icon]:mt-0.5 **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-foreground">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="max-w-[60ch] pb-6 text-[15px] leading-[1.6] text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
