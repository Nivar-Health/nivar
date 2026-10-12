import { Activity, BadgeCheck, FileHeart, Stethoscope, type LucideIcon } from "lucide-react";
import { Container } from "./primitives";

const ITEMS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Stethoscope, title: "Full-time doctors", body: "MBBS and above, registered with the medical council" },
  { icon: BadgeCheck, title: "Trained nurses", body: "BLS certified, trained to clinical protocols" },
  { icon: Activity, title: "Reviewed live", body: "A doctor watches your ECG as it is recorded" },
  { icon: FileHeart, title: "Report in about an hour", body: "Diagnosis and prescription, in your app" },
];

export function TrustStrip() {
  return (
    <section aria-label="Why families trust Nivar" className="border-y border-ink/8 bg-white/60">
      <Container>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-6 py-7 sm:gap-x-8 lg:grid-cols-4 lg:divide-x lg:divide-ink/8 lg:py-8">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3 sm:flex-row sm:items-start lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-[0.95rem] font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-[0.85rem] leading-snug text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
