import Image from "next/image";
import { Activity, Headphones, HeartPulse, Stethoscope } from "lucide-react";
import type { CSSProperties } from "react";
import { generateEcgSamples, generateStethSamples } from "@/lib/device-sim";
import { cn } from "@/lib/utils";
import type { DemoSignal } from "./live-dashboard";
import { LiveDashboardSlot } from "./live-slot";
import { Pill } from "./primitives";

/* Monitor heights, each its content's own at the landing's 12px labels (the stethoscope's Listen and
   level meter need 195). The still frames below hold the same heights as Tailwind min-heights, so a
   moving monitor lands exactly on its still: no layout shift. Change one, change both. */
const ECG_PHONE = 151;
const ECG = 168;
const STETH = 195;

/** 76 bpm, and four seconds a frame: it ends on a quiet stretch, so the moving trace joins it cleanly. */
const SIGNAL: DemoSignal = { bpm: 76, seconds: 4 };

/**
 * Demo vitals. 126/78 is "Elevated" under AHA/ACC 2025 (120-129/<80). 92 mg/dL is normal fasting and
 * random alike (MedlinePlus ency/003482: fasting 70-99, random usually 125 or lower), so it needs no qualifier.
 */
const VITALS = [
  { label: "Blood pressure", value: "126/78", unit: "mmHg", flag: "Elevated" },
  { label: "Blood oxygen", value: "98", unit: "%", flag: "Normal" },
  { label: "Blood sugar", value: "92", unit: "mg/dL", flag: "Normal" },
  { label: "Heart rate", value: String(SIGNAL.bpm), unit: "bpm", flag: "Normal" },
] as const;

const SEES = [
  { icon: Activity, text: "The heart's rhythm, from the smart ECG, as it records." },
  { icon: Stethoscope, text: "Heart and lung sounds through the digital stethoscope, live." },
] as const;

/**
 * The readings panel, last in #check-ups (spec U6): a demo of what the doctor sees, and labelled as one
 * wherever it could be taken for a real patient. All of it is server-rendered, the dashboard included,
 * as a still frame; one client island (live-slot.tsx) sets the monitors moving where motion plays.
 * Below lg a photo of a nurse taking an ECG at home opens the card. No call to action here or after it.
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
            sizes="(min-width: 768px) 42vw, (min-width: 640px) calc(100vw - 48px), calc(100vw - 40px)"
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
              The smart ECG and digital stethoscope stream to a Nivar doctor as the nurse records. If something looks
              or sounds off, the doctor asks for a repeat on the spot.
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

        <div className="nv-chk-live-dash min-w-0 px-2 pb-2 sm:px-2.5 sm:pb-2.5 lg:col-span-7 lg:p-3">
          <LiveDashboardSlot
            signal={SIGNAL}
            ecgPhone={ECG_PHONE}
            ecg={ECG}
            steth={STETH}
            className="lg:h-full"
            head={
              <>
                <p className="truncate text-small font-medium text-foreground">
                  Sample patient<span className="max-sm:hidden">, 58</span>
                </p>
                <p className="truncate text-[0.875rem] leading-[1.45] text-muted-foreground max-sm:hidden">
                  Demo of a Complete Home Check-up
                </p>
              </>
            }
            ecgStill={<EcgStill />}
            stethStill={<StethStill />}
          >
            <Vitals />
          </LiveDashboardSlot>
        </div>
      </div>

      <p className="mt-3 text-small text-pretty text-ink-2">
        This is a demo. The readings are simulated and the patient is not a real person.
      </p>
    </section>
  );
}

/* ---- The still frames. Each mirrors its monitor in components/live (ecg-monitor.tsx, steth-monitor.tsx)
   at the landing's label scale: the same frame, labels and literal colours and sizes, with the trace as
   SVG where the monitor draws a canvas. A change to a monitor's chrome is made here too. ---- */

const MONITOR_FRAME =
  "nv-chk-still flex flex-col overflow-hidden rounded-2xl border border-[#262626] bg-[#0a0a0a] text-[#F2F2EE] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_-12px_rgba(0,0,0,0.55)]";
const MONITOR_BAR = "flex items-center justify-between gap-3 border-b border-white/5 px-3.5 py-2";
const MONITOR_LABELS = "flex min-w-0 items-center gap-2.5 overflow-hidden text-xs tracking-wide whitespace-nowrap";
const MONITOR_SIDE = "flex w-[92px] shrink-0 flex-col justify-between border-l border-white/5 bg-[#0A221E] px-3 py-2.5 sm:w-[124px]";

/** The monitors' status chip, saying what this is. Its dot is still: nothing here moves. */
function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#19C37D]/15 px-2 py-0.5 text-xs font-semibold tracking-[0.14em] text-[#8FE3BF]">
      <span aria-hidden className="inline-flex size-1.5 shrink-0 rounded-full bg-[#19C37D]" />
      DEMO
    </span>
  );
}

/** The trace as path data, a point a sample: x in samples, y in steps of 0.005 mV, up being negative. */
function ecgPath(samples: readonly number[]): string {
  let d = "";
  let prev = 0;
  samples.forEach((mv, i) => {
    const y = Math.round(-mv * 200);
    const dy = y - prev;
    d += i === 0 ? `M0 ${y}l` : dy < 0 ? ` 1${dy}` : ` 1 ${dy}`;
    prev = y;
  });
  return d;
}

function EcgStill() {
  const samples = generateEcgSamples(SIGNAL.seconds, SIGNAL.bpm);
  return (
    <div className={cn(MONITOR_FRAME, "min-h-[151px] sm:min-h-[168px]")}>
      <div className={MONITOR_BAR}>
        <div className={MONITOR_LABELS}>
          <span className="font-semibold text-[#19C37D]">ECG</span>
          <span className="rounded border border-[#19C37D]/25 px-1.5 py-px font-medium text-[#8FE3BF]">Lead II</span>
          <span className="hidden text-[#8F8F89] tabular-nums sm:inline">25 mm/s</span>
          <span className="hidden text-[#8F8F89] tabular-nums sm:inline">10 mm/mV</span>
          <span className="hidden text-[#8F8F89] md:inline">0.5 to 40 Hz</span>
        </div>
        <DemoBadge />
      </div>

      <div className="flex min-h-0 flex-1">
        <div role="img" aria-label="ECG waveform, demo" className="nv-chk-plot relative min-w-0 flex-1">
          {/* 25 mm/s and 10 mm/mV on the monitor's millimetre grid: a sample is a tenth of a millimetre
              wide, and the box spans 1.4 mV above the baseline to 0.6 mV below it. */}
          <div data-plot="ecg" className="nv-chk-plot-in" style={{ "--len": samples.length / 10 } as CSSProperties}>
            <span className="nv-chk-plot-grid" />
            <svg
              viewBox={`0 -280 ${samples.length} 400`}
              preserveAspectRatio="none"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="nv-chk-plot-trace"
            >
              <defs>
                <path id="nv-chk-ecg" d={ecgPath(samples)} vectorEffect="non-scaling-stroke" />
              </defs>
              <use href="#nv-chk-ecg" stroke="rgb(25 195 125 / 0.16)" strokeWidth={6} />
              <use href="#nv-chk-ecg" stroke="#19C37D" strokeWidth={1.9} />
            </svg>
          </div>
        </div>

        <div className={MONITOR_SIDE}>
          <div className="flex items-center justify-between text-xs font-semibold tracking-[0.14em] text-[#19C37D]">
            <span>HR</span>
            <span className="inline-flex text-[#19C37D] opacity-85">
              <HeartPulse aria-hidden className="size-4" strokeWidth={2.25} />
            </span>
          </div>
          <div className="-mt-1 flex flex-col">
            <span
              className="font-mono text-[44px] leading-none font-semibold tracking-tight text-[#19C37D] tabular-nums sm:text-[52px]"
              style={{ textShadow: "0 0 18px rgba(59,227,180,0.35)" }}
            >
              {SIGNAL.bpm}
            </span>
            <span className="mt-1 text-xs tracking-wider text-[#8F8F89]">bpm</span>
          </div>
          <div className="flex items-baseline justify-between text-xs text-[#8F8F89]">
            <span className="tracking-wider">RR</span>
            <span className="font-mono text-xs text-[#8FE3BF] tabular-nums">{Math.round(60000 / SIGNAL.bpm)} ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The heart sound's envelope, as the monitor fills it: the peak of every 8 samples, with stretches that
 * stay within 0.02 drawn as one flat run. x in samples; y is the upper half, 0 at the centre line and
 * -0.84 at full scale (the monitor's 42% of the plot's height each way).
 */
function pcgPath(samples: readonly number[]): string {
  const STEP = 8;
  let d = "M0 0";
  let level = -1;
  let flatEnd = -1;
  const point = (x: number, peak: number) => `L${x} ${Number((-peak * 0.84).toFixed(3))}`;
  for (let i = 0; i < samples.length; i += STEP) {
    let peak = 0;
    for (let k = i; k < Math.min(i + STEP, samples.length); k++) peak = Math.max(peak, samples[k]);
    if (Math.abs(peak - level) <= 0.02) {
      flatEnd = i;
      continue;
    }
    if (flatEnd >= 0) d += point(flatEnd, level);
    d += point(i, peak);
    level = peak;
    flatEnd = -1;
  }
  return `${d}${point(samples.length, level)}L${samples.length} 0`;
}

function StethStill() {
  const samples = generateStethSamples(SIGNAL.seconds, SIGNAL.bpm);
  return (
    <div className={cn(MONITOR_FRAME, "min-h-[195px]")}>
      <div className={MONITOR_BAR}>
        <div className={MONITOR_LABELS}>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#E6E6E1]">
            <Stethoscope aria-hidden className="size-3.5" /> PCG
          </span>
          <span className="truncate rounded border border-[#E6E6E1]/25 px-1.5 py-px font-medium text-[#F7D88E]">
            Mitral area
          </span>
          <span className="hidden text-[#8F8F89] sm:inline">20 to 400 Hz</span>
        </div>
        <DemoBadge />
      </div>

      <div className="flex min-h-0 flex-1">
        <div role="img" aria-label="Heart sound waveform, demo" className="nv-chk-plot relative min-w-0 flex-1">
          <div data-plot="pcg" className="nv-chk-plot-in">
            <span className="nv-chk-plot-grid" />
            <span className="nv-chk-plot-mid" />
            <svg viewBox={`0 -1 ${samples.length} 2`} preserveAspectRatio="none" className="nv-chk-plot-trace">
              <defs>
                <linearGradient id="nv-chk-pcg-fill" gradientUnits="userSpaceOnUse" x1="0" y1="-0.84" x2="0" y2="0.84">
                  <stop offset="0" stopColor="#E6E6E1" stopOpacity="0.95" />
                  <stop offset="0.5" stopColor="#E6E6E1" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#E6E6E1" stopOpacity="0.95" />
                </linearGradient>
                <path id="nv-chk-pcg" d={pcgPath(samples)} vectorEffect="non-scaling-stroke" />
              </defs>
              <use href="#nv-chk-pcg" fill="url(#nv-chk-pcg-fill)" />
              <use href="#nv-chk-pcg" fill="url(#nv-chk-pcg-fill)" transform="scale(1 -1)" />
              <use href="#nv-chk-pcg" fill="none" stroke="#FFE3A3" strokeWidth={1} />
            </svg>
            <span className="nv-chk-plot-fade" />
          </div>
        </div>

        <div className={cn(MONITOR_SIDE, "gap-2")}>
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-[0.14em] text-[#E6E6E1]">HR</span>
            <span
              className="mt-0.5 font-mono text-[34px] leading-none font-semibold tracking-tight text-[#E6E6E1] tabular-nums sm:text-[40px]"
              style={{ textShadow: "0 0 16px rgba(242,193,78,0.3)" }}
            >
              {SIGNAL.bpm}
            </span>
            <span className="mt-1 text-xs tracking-wider text-[#8F8F89]">bpm</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {/* Nothing plays in a still frame, so there is nothing to listen to yet. */}
            <button
              type="button"
              disabled
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E6E6E1]/40 text-xs font-semibold text-[#F7D88E] opacity-50"
            >
              <Headphones aria-hidden className="size-3.5" />
              Listen
            </button>
            <div aria-hidden className="flex h-3 items-end justify-center gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="w-[5px] rounded-[1px] bg-white/10" style={{ height: `${40 + (i / 6) * 60}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The four readings under the monitors. Phones: two tight columns, the flag as a dot and a word. */
function Vitals() {
  return (
    <dl className="mt-2.5 grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border sm:mt-4">
      {VITALS.map((v) => (
        <div key={v.label} className="flex flex-col justify-center gap-1 bg-card px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <dt className="flex items-center justify-between gap-2 text-[0.875rem] leading-[1.3] text-muted-foreground">
            <span className="min-w-0">{v.label}</span>
            <Flag flag={v.flag} className="max-sm:hidden" />
          </dt>
          <dd className="flex flex-wrap items-baseline gap-x-1 tabular-nums">
            <span className="text-[1.25rem] leading-none font-medium tracking-[-0.02em] text-foreground sm:text-[1.5rem]">
              {v.value}
            </span>
            <span className="text-[0.875rem] leading-none text-muted-foreground">{v.unit}</span>
          </dd>
          <dd className="flex sm:hidden">
            <Flag flag={v.flag} compact />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A reading's flag: the "Normal" or "Elevated" pill, or on phones a dot and the word. */
function Flag({ flag, compact = false, className }: { flag: "Normal" | "Elevated"; compact?: boolean; className?: string }) {
  const elevated = flag === "Elevated";
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[0.875rem] leading-[1.3] font-medium",
          elevated ? "text-amber-on-dark" : "text-foreground-2",
          className,
        )}
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", elevated ? "bg-amber-on-dark" : "bg-trace")} />
        {flag}
      </span>
    );
  }
  return elevated ? (
    <Pill className={cn("bg-amber-on-dark/14 text-[0.875rem] text-amber-on-dark ring-1 ring-amber-on-dark/35", className)}>
      Elevated
    </Pill>
  ) : (
    <Pill tone="inverse" className={cn("text-[0.875rem]", className)}>
      Normal
    </Pill>
  );
}
