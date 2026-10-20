import { ArrowRight } from "lucide-react";
import { getCatalog } from "@/components/landing/catalog";
import { HealthFacts } from "@/components/landing/health-facts";
import { ARROW_NUDGE, ButtonLink, Container, Section, inr } from "@/components/landing/primitives";
import { pageMetadata } from "@/components/landing/seo";
import { cn } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Why Nivar Health?",
  description:
    "High blood pressure and raised blood sugar are common in India and rarely cause symptoms early on. The figures, with their sources, and how a check-up at home helps.",
  path: "/why-nivar",
});

export default async function WhyNivarPage() {
  const { packages } = await getCatalog();
  const prices = packages.map((p) => p.price);
  return (
    <>
      <HealthFacts />
      <Section tone="aqua" titleId="check-title" className="py-16 lg:py-20">
        <Container className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="check-title" className="text-h3 text-balance text-ink">
              Finding out takes one home visit.
            </h2>
            <p className="mt-2 max-w-[56ch] text-body text-pretty text-ink-2">
              A nurse checks your blood pressure, sugar and heart at home, and a Nivar doctor reviews every reading.
              {prices.length > 0 && ` Check-ups from ${inr(Math.min(...prices))}.`}
            </p>
          </div>
          <ButtonLink href="/services#check-ups" size="lg" className={cn("shrink-0", ARROW_NUDGE)}>
            See health check-ups
            <ArrowRight aria-hidden />
          </ButtonLink>
        </Container>
      </Section>
    </>
  );
}
