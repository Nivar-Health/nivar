"use client";

import { Check, Mic, Video } from "lucide-react";
import { EcgMonitor } from "@/components/live/ecg-monitor";
import { cn } from "@/lib/utils";
import { useEcgFeed, usePairing, usePrefersReducedMotion } from "./live-feeds";
import { StaticEcgPanel } from "./static-trace";

const HR = 72;

/**
 * The hero composition: a home visit in progress. A live Smart ECG trace
 * (local simulator), the doctor on video, and the patient's visit timeline.
 */
export function HeroVisual() {
  const reduced = usePrefersReducedMotion();
  const feed = useEcgFeed(HR);
  const paired = usePairing(!reduced, 1100);

  return (
    <div className="relative mx-auto w-full max-w-[560px] pt-[56px] pb-[152px] sm:pt-[88px] sm:pb-[144px] lg:mr-0">
      {/* Soft halo behind the composition */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-12%] top-[8%] bottom-[4%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(14_94_82/0.16),transparent)] blur-2xl"
      />

      {/* Visit console */}
      <div
        className="relative animate-fade-up rounded-[22px] border border-ink/8 bg-white p-2.5 shadow-[0_1px_2px_rgb(19_35_33/0.05),0_30px_60px_-30px_rgb(14_94_82/0.45)] sm:p-3"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex h-[52px] items-center gap-3 pr-[132px] pl-1.5 sm:h-[60px] sm:pr-[222px]">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint font-display text-[0.95rem] font-semibold text-teal-deep"
          >
            SI
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[0.9rem] font-semibold text-ink">Sneha Iyer, 36</p>
            <p className="truncate text-xs text-muted-foreground">Home visit, Koramangala</p>
          </div>
        </div>

        {reduced ? (
          <StaticEcgPanel height={180} heartRate={HR} className="sm:h-[200px]!" />
        ) : (
          <EcgMonitor
            feed={feed}
            status={paired ? "streaming" : "connecting"}
            heartRate={null}
            height={180}
            className="sm:h-[200px]!"
          />
        )}

        <dl className="grid grid-cols-3 divide-x divide-ink/8 px-1 pt-3 pb-1.5">
          <Vital label="Blood pressure" short="BP" value="124/82" unit="mmHg" />
          <Vital label="SpO2" value="98" unit="%" />
          <Vital label="Sugar, fasting" short="Sugar" value="96" unit="mg/dL" />
        </dl>
      </div>

      {/* Doctor on video */}
      <DoctorTile className="absolute top-0 right-2 animate-fade-up sm:right-3" />

      {/* Visit timeline */}
      <VisitTimeline className="absolute bottom-0 left-[-4px] animate-fade-up sm:left-[-28px]" />
    </div>
  );
}

function Vital({ label, short, value, unit }: { label: string; short?: string; value: string; unit: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-2.5 first:pl-1.5 sm:px-3.5">
      <dt className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground sm:text-xs">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </dt>
      <dd className="font-display text-[1.15rem] leading-none font-semibold text-ink tabular-nums sm:text-[1.35rem]">
        {value}
        <span className="ml-1 font-sans text-[10px] font-medium text-muted-foreground sm:text-[11px]">{unit}</span>
      </dd>
    </div>
  );
}

function DoctorTile({ className }: { className?: string }) {
  return (
    <figure
      className={cn(
        "w-[120px] overflow-hidden rounded-2xl border border-white/70 bg-teal-deep shadow-[0_20px_40px_-18px_rgb(7_27_24/0.6)] ring-1 ring-ink/10 sm:w-[200px]",
        className,
      )}
      style={{ animationDelay: "420ms" }}
    >
      <div className="relative aspect-[4/3] w-full">
        <DoctorPortrait />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-ink/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <span className="live-dot size-1.5! text-[#FF6B5E]" aria-hidden />
          On call
        </div>
        <div className="absolute top-2 right-2 hidden items-end gap-[2px] rounded-full bg-ink/55 px-1.5 py-1 backdrop-blur-sm sm:flex" aria-hidden>
          <Mic className="mr-0.5 size-3 text-white" />
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-[2px] animate-pulse rounded-full bg-[#3BE3B4]"
              style={{ height: `${[6, 10, 7, 11][i]}px`, animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#071B18]/90 via-[#071B18]/55 to-transparent px-2.5 pt-6 pb-1.5 sm:px-3 sm:pb-2">
          <p className="truncate text-[11px] font-semibold text-white sm:text-[0.8rem]">Dr. Ananya Rao</p>
          <p className="flex items-center gap-1 truncate text-[10px] text-white/70 sm:text-[11px]">
            <Video className="size-3 shrink-0" aria-hidden />
            Cardiologist, Nivar
          </p>
        </figcaption>
      </div>
    </figure>
  );
}

/** Flat illustrated portrait for the video tile (no stock photography). */
function DoctorPortrait() {
  return (
    <svg viewBox="0 0 180 225" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" role="img" aria-label="Dr. Ananya Rao on a video call">
      <defs>
        <linearGradient id="dr-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C6B5E" />
          <stop offset="1" stopColor="#0A3D35" />
        </linearGradient>
      </defs>
      <rect width="180" height="225" fill="url(#dr-bg)" />
      {/* clinic shelf and window light */}
      <rect x="0" y="54" width="180" height="3" fill="#ffffff" opacity="0.06" />
      <rect x="118" y="20" width="44" height="58" rx="4" fill="#ffffff" opacity="0.07" />
      <rect x="14" y="34" width="10" height="20" rx="2" fill="#F2A33A" opacity="0.5" />
      <rect x="27" y="40" width="8" height="14" rx="2" fill="#E6F2EE" opacity="0.35" />
      {/* hair back */}
      <path d="M58 98c0-30 14-50 33-50s33 20 33 50c0 22-6 38-6 38H64s-6-16-6-38z" fill="#231612" />
      {/* neck */}
      <path d="M80 128h22v22H80z" fill="#B97E5E" />
      {/* coat */}
      <path d="M30 225c2-42 22-70 61-74 39 4 59 32 61 74z" fill="#F4FBF8" />
      <path d="M91 151l-13 30 13 44 13-44z" fill="#2E7D6E" />
      <path d="M78 151l13 30-6 4-14-28zM104 151l-13 30 6 4 14-28z" fill="#E1EEEA" />
      {/* stethoscope */}
      <path d="M66 162c-4 18 2 34 14 38" stroke="#132321" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="82" cy="201" r="5" fill="#132321" />
      <circle cx="82" cy="201" r="2.2" fill="#9FB0AC" />
      {/* face */}
      <ellipse cx="91" cy="104" rx="23" ry="27" fill="#C68B69" />
      {/* hair front */}
      <path d="M67 100c2-24 14-36 26-36 14 0 24 12 23 30-10-2-22-10-28-20-4 12-12 22-21 26z" fill="#231612" />
      {/* bindi and features */}
      <circle cx="91" cy="92" r="1.6" fill="#C2453D" />
      <path d="M81 106h5M97 106h5" stroke="#3A2419" strokeWidth="2" strokeLinecap="round" />
      <path d="M86 118c3 2.4 7 2.4 10 0" stroke="#7C3F2E" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const STEPS: { label: string; time: string; state: "done" | "live" | "next" }[] = [
  { label: "Nurse Priya arrived", time: "9:41", state: "done" },
  { label: "Vitals and ECG recorded", time: "9:52", state: "done" },
  { label: "Doctor consult", time: "Live", state: "live" },
  { label: "Report and prescription", time: "~10:15", state: "next" },
];

function VisitTimeline({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-[236px] rounded-2xl border border-ink/8 bg-ivory/95 p-3.5 shadow-[0_24px_48px_-24px_rgb(19_35_33/0.45)] backdrop-blur sm:w-[264px] sm:p-4",
        className,
      )}
      style={{ animationDelay: "640ms" }}
    >
      <p className="text-xs font-semibold text-ink">Your visit today</p>
      <ol className="mt-2.5 space-y-2">
        {STEPS.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[0.78rem] sm:text-[0.8rem]">
            {s.state === "done" ? (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
              </span>
            ) : s.state === "live" ? (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-saffron/25">
                <span className="live-dot size-1.5! text-[#C9761A]" aria-hidden />
              </span>
            ) : (
              <span className="size-4 shrink-0 rounded-full border-[1.5px] border-dashed border-ink/25" aria-hidden />
            )}
            <span className={cn("min-w-0 flex-1 truncate", s.state === "next" ? "text-muted-foreground" : "text-ink")}>
              {s.label}
            </span>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                s.state === "live" ? "font-semibold text-[#A35F12]" : "text-muted-foreground",
              )}
            >
              {s.time}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
