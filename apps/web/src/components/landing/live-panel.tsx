import Image from "next/image";
import { Activity, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveDashboardSlot } from "./live-slot";

/* Monitor heights, each its content's own at the landing's 12px labels (the stethoscope's Listen and
   level meter need 195). The skeleton's Tailwind heights mirror them, and the slot's min-heights (388px
   phones, 654px sm, 662px lg) are the dashboard's measured heights (385.6, 651.3, 659.3) plus the few px
   the vitals absorb, so it lands exactly on its reserved box: no layout shift. Change one, re-measure
   all (.qa-state/mobile/build/checkups/slot.mjs). */
const ECG_PHONE = 151;
const ECG = 168;
const STETH = 195;

const SEES = [
  { icon: Activity, text: "The heart's rhythm, from the smart ECG, as it records." },
  { icon: Stethoscope, text: "Heart and lung sounds through the digital stethoscope, live." },
] as const;

/**
 * The live readings panel, last in #check-ups (spec U6). Server-rendered copy around one client
 * island (live-slot.tsx) that reserves the dashboard's box, shows a still pond skeleton, and loads the
 * dashboard chunk once the box is within 600px of the viewport. Below lg a photo of a nurse taking an
 * ECG at home opens the card. No call to action here or after it.
 */
export function LivePanel({ className }: { className?: string }) {
  return (
    <section id="live" aria-labelledby="live-title" className={cn("scroll-mt-24", className)}>
      <div className="nv-chk-live theme-pine band-pond relative isolate overflow-hidden rounded-4xl lg:grid lg:grid-cols-12">
        <div aria-hidden className="absolute inset-0 -z-10 bg-ecg-grid-dark" />

        {/* Inset like the dashboard below it, so the photo's corners are concentric with the card's. */}
        <div className="nv-chk-live-photo relative mx-2 mt-2 aspect-[3/2] overflow-hidden rounded-[1.5rem] bg-white/5 sm:mx-2.5 sm:mt-2.5 lg:hidden">
          <Image
            src="/img/nurse-ecg-home.jpg"
            alt="A Nivar nurse holds a handheld ECG while an older man rests his fingertips on its pads, on his sofa at home"
            fill
            sizes="(min-width: 640px) calc(100vw - 48px), calc(100vw - 40px)"
            className="object-cover object-[50%_35%]"
          />
        </div>

        <div className="p-5 sm:p-8 lg:col-span-5 lg:flex lg:flex-col lg:justify-center lg:gap-10 lg:py-12 lg:pr-6 lg:pl-11 xl:pl-12">
          <div>
            <h3
              id="live-title"
              className="max-w-[22ch] text-[1.375rem] leading-[1.18] font-semibold tracking-[-0.02em] text-balance text-foreground sm:text-h3 lg:text-[2rem] lg:leading-[1.12] lg:tracking-[-0.025em]"
            >
              Readings reach your doctor while you&apos;re still on the sofa.
            </h3>
            <p className="mt-3 max-w-[46ch] text-small text-pretty text-foreground-2 lg:mt-5 lg:text-body">
              The smart ECG and digital stethoscope stream to a Nivar doctor&apos;s console as the nurse records. If
              something looks or sounds off, the doctor asks for a repeat on the spot.
            </p>
          </div>

          <div className="hidden lg:block">
            <p id="live-sees" className="text-small font-semibold text-foreground">
              What your doctor sees
            </p>
            <ul aria-labelledby="live-sees" className="mt-4 flex flex-col gap-4 border-t border-border pt-5">
              {SEES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3.5 text-small text-pretty text-foreground-2">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/8 text-mint-glow ring-1 ring-white/10"
                  >
                    <Icon className="size-[1.125rem]" strokeWidth={1.9} />
                  </span>
                  <span className="pt-1.5">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="nv-chk-live-dash px-2 pb-2 sm:px-2.5 sm:pb-2.5 lg:col-span-7 lg:p-3">
          <LiveDashboardSlot
            ecgPhone={ECG_PHONE}
            ecg={ECG}
            steth={STETH}
            className="min-h-[388px] sm:min-h-[654px] lg:min-h-[662px]"
          >
            <Skeleton />
            <p className="nv-chk-loading sr-only">Loading the live demo</p>
          </LiveDashboardSlot>
        </div>
      </div>

      <p className="mt-2.5 text-caption text-pretty text-ink-3">Demo with simulated readings and an illustrative patient.</p>
    </section>
  );
}

/** The dashboard's silhouette, still, in pond tones: header, monitors with their leads off, vitals. */
function Skeleton() {
  return (
    <div
      aria-hidden
      className="nv-chk-skel absolute inset-0 flex flex-col rounded-[1.5rem] border border-border bg-card p-3 sm:p-4 lg:p-5"
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-2.5 sm:pb-4">
        <div className="flex flex-col gap-2 py-0.5">
          <span className="h-3.5 w-28 rounded-full bg-white/12" />
          <span className="hidden h-3 w-40 rounded-full bg-white/7 sm:block" />
        </div>
        <span className="h-8 w-20 rounded-full bg-white/8 sm:h-9 sm:w-36" />
      </div>
      <SkeletonMonitor className="h-[151px] sm:h-[168px]" />
      <SkeletonMonitor className="mt-3 hidden h-[195px] sm:flex" />
      <div className="mt-2.5 grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border sm:mt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col justify-center gap-3 bg-card p-3 sm:px-4">
            <span className="h-3 w-20 rounded-full bg-white/8" />
            <span className="h-5 w-14 rounded-full bg-white/12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The monitor's frame in its own palette (components/live MONITOR: bg, edge and the HR panel). */
function SkeletonMonitor({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#0a0a0a]", className)}
    >
      <div className="h-[33px] shrink-0 border-b border-white/5" />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <span className="nv-chk-skel-trace absolute inset-x-4 top-[52%] h-[1.25px]" />
        </div>
        <div className="w-[92px] shrink-0 border-l border-white/5 bg-[#0A221E] sm:w-[124px]" />
      </div>
    </div>
  );
}
