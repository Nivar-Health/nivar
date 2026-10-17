"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  CalendarCheck2,
  Check,
  Clock3,
  DoorOpen,
  Download,
  Droplet,
  FileHeart,
  Gauge,
  HeartPulse,
  Stethoscope,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniTrace } from "./mini-trace";
import { useMotionPaused } from "./motion";

export type JourneyStep = { title: string; text: string; time: string };

const ICONS: LucideIcon[] = [CalendarCheck2, DoorOpen, Video, FileHeart];
/** How long each step stays on screen; each scene finishes its own animation about 2s before. */
const DWELL_MS = [5600, 6400, 6400, 7000];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * "How it works" as a short story: four steps on the left, and a phone that acts each one out.
 * It starts at step 1 when it scrolls into view, advances on its own and loops; any step can be
 * picked. It holds while off screen or in a hidden tab, and under reduced motion it does not
 * advance and every scene shows its finished state.
 */
export function VisitJourney({ steps }: { steps: readonly JourneyStep[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const seen = useRef(false);
  const still = useMotionPaused();
  const playing = !still && inView && tabVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1].isIntersecting;
        setInView(visible);
        if (!visible) return;
        // First time in view: tell the story from the beginning. Afterwards: replay the current step.
        if (!seen.current) {
          seen.current = true;
          setActive(0);
        }
        setRun((r) => r + 1);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setTabVisible(visible);
      if (visible) setRun((r) => r + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      setActive((a) => (a + 1) % steps.length);
      setRun((r) => r + 1);
    }, DWELL_MS[active] ?? 6000);
    return () => window.clearTimeout(t);
  }, [playing, active, run, steps.length]);

  const pick = (i: number) => {
    setActive(i);
    setRun((r) => r + 1);
  };

  return (
    <div ref={ref} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:order-2 lg:col-span-7">
        {/* Phones: one bar per step above the phone (tap to jump), the current step's words below it. */}
        <div className="mb-3 grid grid-cols-4 gap-2 lg:hidden">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => pick(i)}
              aria-current={i === active ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className="group flex flex-col gap-1.5 rounded-md py-2 text-left focus-ring"
            >
              <span className={cn("text-xs font-semibold", i === active ? "text-primary" : "text-ink-3")}>Step {i + 1}</span>
              <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-primary/15">
                {i < active || (i === active && still) ? (
                  <span className="block h-full w-full rounded-full bg-primary" />
                ) : i === active ? (
                  <span
                    key={run}
                    className="jn-progress block h-full rounded-full bg-primary"
                    style={{ "--dwell": `${DWELL_MS[i] ?? 6000}ms` } as CSSProperties}
                    data-paused={playing ? undefined : ""}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>

        <Stage active={active} run={run} />

        <div key={`${active}-${run}`} className="jn-scene mt-5 lg:hidden">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            Step {active + 1}
            <span className="inline-flex items-center gap-1 text-caption font-medium text-ink-3">
              <Clock3 aria-hidden className="size-3.5" />
              {steps[active]?.time}
            </span>
          </p>
          <p className="mt-1 text-h4 text-ink">{steps[active]?.title}</p>
          <p className="mt-1.5 text-small text-pretty text-ink-2">{steps[active]?.text}</p>
        </div>

        <p className="mt-4 text-center text-caption text-ink-3 lg:mt-4">Illustrative screens from the Nivar app.</p>
      </div>

      <ol className="relative hidden flex-col gap-2 lg:order-1 lg:col-span-5 lg:flex">
        {steps.map((s, i) => {
          const Icon = ICONS[i] ?? Check;
          const isActive = i === active;
          const done = i < active;
          return (
            <li key={s.title} className="relative">
              {/* Rail from this node's centre (40px down) to the next one's (40px into the next row, after the 8px gap). */}
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute top-10 -bottom-12 left-10 w-0.5 -translate-x-1/2 overflow-hidden rounded-full bg-primary/12">
                  <span
                    className={cn(
                      "block h-full w-full origin-top rounded-full bg-primary transition-transform duration-700 ease-calm",
                      i < active ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                </span>
              )}
              <button
                type="button"
                onClick={() => pick(i)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "group flex w-full gap-5 rounded-[1.5rem] p-4 text-left transition-[background-color,box-shadow] duration-300 ease-calm focus-ring",
                  isActive ? "bg-white shadow-[0_20px_44px_-30px_rgb(6_47_45/0.55)]" : "hover:bg-white/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full ring-4 transition-colors duration-500",
                    isActive
                      ? "bg-primary text-white ring-primary/15"
                      : done
                        ? "bg-aqua-2 text-primary ring-aqua"
                        : "bg-white text-ink-3 ring-aqua",
                  )}
                >
                  {done ? <Check className="size-5" strokeWidth={2.5} /> : <Icon className="size-5" strokeWidth={2} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={cn("text-small font-semibold", isActive ? "text-primary" : "text-ink-3")}>
                      Step {i + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 text-caption font-medium text-ink-3">
                      <Clock3 aria-hidden className="size-3.5" />
                      {s.time}
                    </span>
                  </span>
                  <span className={cn("mt-1 block text-h4 transition-colors", isActive ? "text-ink" : "text-ink-2")}>
                    {s.title}
                  </span>
                  <span
                    className={cn(
                      "mt-1.5 block text-small text-pretty transition-colors",
                      isActive ? "text-ink-2" : "text-ink-3",
                    )}
                  >
                    {s.text}
                  </span>
                  {isActive && !still && (
                    <span aria-hidden className="mt-4 block h-1 overflow-hidden rounded-full bg-primary/12">
                      <span
                        key={run}
                        className="jn-progress block h-full rounded-full bg-primary"
                        style={{ "--dwell": `${DWELL_MS[i] ?? 6000}ms` } as CSSProperties}
                        data-paused={playing ? undefined : ""}
                      />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The phone and its four scenes                                              */
/* ------------------------------------------------------------------------- */

const SCENES = [BookScene, ArriveScene, DoctorScene, ReportScene];

function Stage({ active, run }: { active: number; run: number }) {
  const Scene = SCENES[active] ?? BookScene;
  return (
    <div
      aria-hidden
      className="relative isolate flex justify-center overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#ffffff_0%,var(--aqua)_60%,var(--aqua-2)_100%)] px-4 py-10 ring-1 ring-white sm:py-12"
    >
      <div className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(242_163_58/0.18),transparent)]" />
      <div className="absolute -bottom-28 -left-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(11_115_102/0.16),transparent)]" />
      <div className="relative w-full max-w-[19.5rem]">
        <div className="relative h-[30.5rem] overflow-hidden rounded-[2.25rem] border-[6px] border-pond bg-white shadow-[0_40px_80px_-36px_rgb(6_47_45/0.6)]">
          <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-pond" />
          <div key={`${active}-${run}`} className="jn-scene absolute inset-0 px-4 pt-11 pb-4">
            <Scene />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="jn-in" style={d(0)}>
      <p className="text-[0.9375rem] font-semibold text-ink">{children}</p>
      {sub && <p className="text-[0.6875rem] text-ink-3">{sub}</p>}
    </div>
  );
}

/** Step 1: pick a programme, a day and a slot, then confirm. */
function BookScene() {
  const slots = ["Within 60 min", "11:00 am", "1:00 pm", "3:00 pm", "5:00 pm", "7:00 pm"];
  return (
    <div className="relative flex h-full flex-col text-[0.75rem]">
      <ScreenTitle sub="For Kamala Iyer, 67">Book a check-up</ScreenTitle>

      <p className="jn-in mt-4 font-semibold text-ink-3" style={d(150)}>
        Programme
      </p>
      <div className="jn-in mt-1.5" style={d(250)}>
        <div className="jn-select-card flex items-center gap-3 rounded-xl bg-aqua p-2.5 ring-2 ring-primary" style={d(650)}>
          <span className="flex size-9 items-center justify-center rounded-lg bg-rose-tint text-rose-ink">
            <HeartPulse className="size-4.5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-ink">Heart Check</span>
            <span className="block text-[0.6875rem] text-ink-3">ECG, stethoscope and consult</span>
          </span>
          <span className="font-semibold text-ink">₹1,499</span>
        </div>
      </div>

      <p className="jn-in mt-4 font-semibold text-ink-3" style={d(450)}>
        Day
      </p>
      <div className="jn-in mt-1.5 flex gap-1.5" style={d(500)}>
        {["Today", "Tomorrow", "Saturday"].map((x, i) => (
          <span
            key={x}
            className={cn(
              "rounded-full px-3 py-1.5 font-semibold",
              i === 0 ? "jn-select bg-primary text-white" : "bg-white text-ink-2 ring-1 ring-border",
            )}
            style={i === 0 ? { "--d": "1100ms" } as CSSProperties : undefined}
          >
            {x}
          </span>
        ))}
      </div>

      <p className="jn-in mt-4 font-semibold text-ink-3" style={d(650)}>
        Time
      </p>
      <div className="jn-in mt-1.5 grid grid-cols-3 gap-1.5" style={d(700)}>
        {slots.map((x, i) => (
          <span
            key={x}
            className={cn(
              "rounded-lg px-1 py-2 text-center font-medium",
              i === 3 ? "jn-select bg-primary text-white" : "bg-white text-ink-2 ring-1 ring-border",
            )}
            style={i === 3 ? { "--d": "1700ms" } as CSSProperties : undefined}
          >
            {x}
          </span>
        ))}
      </div>

      <span className="jn-press mt-auto flex h-11 items-center justify-center rounded-full bg-primary font-semibold text-white" style={d(900)}>
        Confirm booking
      </span>

      <div
        className="jn-drop absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 rounded-2xl bg-pond p-3 text-white shadow-lg"
        style={d(2700)}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-mint-glow text-pond">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span>
          <span className="block font-semibold">Booking confirmed</span>
          <span className="block text-[0.6875rem] text-on-pine-2">Today, 3:00 pm. Your nurse is assigned.</span>
        </span>
      </div>
    </div>
  );
}

/** Step 2: the nurse travels to the home, then unpacks the devices. */
const ROUTE = "M28 168 C 70 168, 70 110, 120 110 S 168 72, 194 70";

function ArriveScene() {
  return (
    <div className="flex h-full flex-col text-[0.75rem]">
      <ScreenTitle sub="Live location">Your nurse is coming</ScreenTitle>

      {/* A fixed 248 x 200 frame, so the SVG route and the travelling nurse share pixel coordinates. */}
      <div className="jn-in relative mx-auto mt-3 h-[200px] w-[248px] shrink-0 overflow-hidden rounded-2xl bg-aqua" style={d(100)}>
        <svg width="248" height="200" viewBox="0 0 248 200" className="absolute inset-0" fill="none">
          <path d="M-10 130 H 260 M 60 -10 V 210 M 160 -10 V 210 M -10 40 H 260" stroke="white" strokeWidth={14} />
          <path d="M-10 90 H 260 M 110 -10 V 210 M 210 -10 V 210" stroke="white" strokeOpacity={0.7} strokeWidth={7} />
          <rect x="72" y="140" width="76" height="60" rx="10" fill="var(--mint-glow)" fillOpacity={0.35} />
          <rect x="172" y="100" width="70" height="22" rx="8" fill="var(--sky-tint)" />
          <path d={ROUTE} stroke="var(--primary)" strokeOpacity={0.22} strokeWidth={5} strokeLinecap="round" />
          <path
            className="jn-draw"
            d={ROUTE}
            pathLength={1}
            stroke="var(--primary)"
            strokeWidth={5}
            strokeLinecap="round"
            style={{ "--d": "300ms", "--dur": "2600ms" } as CSSProperties}
          />
          <circle className="jn-ripple motion-loop" cx="214" cy="58" r="15" fill="var(--marigold)" fillOpacity={0.4} style={d(2900)} />
          <circle cx="214" cy="58" r="14" fill="var(--marigold)" stroke="white" strokeWidth={3} />
          {/* A small house */}
          <path d="M207 59.5 214 53l7 6.5V65h-14z" fill="white" />
        </svg>
        <span
          className="jn-travel absolute top-0 left-0 flex size-6 items-center justify-center rounded-full bg-white shadow-md"
          style={{ offsetPath: `path("${ROUTE}")`, "--d": "300ms" } as CSSProperties}
        >
          <span className="size-4 rounded-full bg-primary" />
        </span>
      </div>

      <div className="jn-in mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-border" style={d(300)}>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-[0.8125rem] font-semibold text-white">P</span>
        <span className="relative flex-1">
          <span className="block font-semibold text-ink">Priya, your Nivar nurse</span>
          <span className="relative block h-4 text-[0.6875rem]">
            <span className="jn-out absolute inset-0 text-ink-3" style={d(2900)}>
              On her way, about 12 min
            </span>
            <span className="jn-in absolute inset-0 font-semibold text-primary" style={d(3000)}>
              Has arrived at your door
            </span>
          </span>
        </span>
      </div>

      <p className="jn-in mt-3 font-semibold text-ink-3" style={d(3300)}>
        In her bag
      </p>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {[
          { icon: Activity, label: "ECG", tone: "bg-aqua text-primary" },
          { icon: Stethoscope, label: "Steth", tone: "bg-sky-tint text-sky-ink" },
          { icon: Gauge, label: "BP", tone: "bg-rose-tint text-rose-ink" },
          { icon: Droplet, label: "Sugar", tone: "bg-marigold-tint text-marigold-ink" },
        ].map((x, i) => (
          <span key={x.label} className="jn-pop flex flex-col items-center gap-1 rounded-xl bg-white py-2 ring-1 ring-border" style={d(3400 + i * 150)}>
            <span className={cn("flex size-7 items-center justify-center rounded-lg", x.tone)}>
              <x.icon className="size-4" />
            </span>
            <span className="text-[0.625rem] font-semibold text-ink-2">{x.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Step 3: the doctor on video while the readings stream in. */
function DoctorScene() {
  const vitals = [
    { label: "Heart rate", value: "76 bpm", flag: "Normal" },
    { label: "Blood pressure", value: "126/78", flag: "Elevated" },
    { label: "Oxygen", value: "98%", flag: "Normal" },
  ];
  return (
    <div className="flex h-full flex-col text-[0.75rem]">
      <div className="jn-in relative h-[10.5rem] overflow-hidden rounded-2xl bg-pond" style={d(0)}>
        <Image src="/img/doctor.jpg" alt="" fill sizes="300px" className="object-cover object-[50%_30%]" />
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-pond/80 px-2 py-1 text-[0.625rem] font-semibold text-white backdrop-blur">
          <span className="size-1.5 rounded-full bg-mint-glow" />
          Live
        </span>
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.6875rem] font-semibold text-ink backdrop-blur">
          Dr. Ananya Rao
        </span>
        <span className="jn-pop absolute right-2.5 bottom-2.5 flex size-12 items-center justify-center rounded-xl bg-aqua-2 text-[0.8125rem] font-semibold text-primary ring-2 ring-white" style={d(500)}>
          KI
        </span>
      </div>

      <div className="jn-in mt-3 rounded-2xl bg-pond p-3 text-white" style={d(400)}>
        <div className="flex items-center justify-between text-[0.6875rem]">
          <span className="font-semibold">ECG, lead II</span>
          <span className="flex items-center gap-1 text-mint-glow">
            <HeartPulse className="size-3.5" />
            72 bpm
          </span>
        </div>
        <MiniTrace className="mt-1.5 h-8 text-mint-glow" />
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {vitals.map((v, i) => (
          <div key={v.label} className="jn-in flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-border" style={d(1100 + i * 500)}>
            <span className="text-ink-3">{v.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-ink tabular-nums">{v.value}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold",
                  v.flag === "Normal" ? "bg-aqua text-primary" : "bg-marigold-tint text-marigold-ink",
                )}
              >
                {v.flag}
              </span>
            </span>
          </div>
        ))}
      </div>

      <span className="jn-pop mt-auto flex items-center justify-center gap-1.5 rounded-full bg-aqua py-2 font-semibold text-primary" style={d(2900)}>
        <Check className="size-3.5" strokeWidth={3} />
        Reviewed live by your doctor
      </span>
    </div>
  );
}

/** Step 4: the report fills in, gets signed and lands in the app. */
function ReportScene() {
  const rows = [
    { label: "Blood pressure", value: "126/78", flag: "Elevated" },
    { label: "ECG", value: "Normal rhythm", flag: "Normal" },
    { label: "Blood sugar", value: "112 mg/dL", flag: "Normal" },
  ];
  return (
    <div className="relative flex h-full flex-col text-[0.75rem]">
      <div className="jn-in flex items-start justify-between" style={d(0)}>
        <span>
          <span className="block text-[0.9375rem] font-semibold text-ink">Health report</span>
          <span className="block text-[0.6875rem] text-ink-3">Kamala Iyer, 67. Heart Check</span>
        </span>
        <span className="flex size-9 items-center justify-center rounded-xl bg-aqua text-primary">
          <FileHeart className="size-4.5" />
        </span>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border rounded-2xl ring-1 ring-border">
        {rows.map((r, i) => (
          <div key={r.label} className="jn-in flex items-center justify-between px-3 py-2.5" style={d(300 + i * 350)}>
            <span className="text-ink-3">{r.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-ink">{r.value}</span>
              <span
                className={cn(
                  "size-2 rounded-full",
                  r.flag === "Normal" ? "bg-primary" : "bg-marigold",
                )}
              />
            </span>
          </div>
        ))}
      </div>

      <p className="jn-in mt-4 font-semibold text-ink-3" style={d(1400)}>
        Doctor&apos;s note
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {["94%", "86%", "72%"].map((w, i) => (
          <span key={w} className="jn-grow h-2 rounded-full bg-aqua-2" style={{ width: w, "--d": `${1500 + i * 220}ms` } as CSSProperties} />
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span>
          <svg viewBox="0 0 120 36" className="h-8 w-28" fill="none">
            <path
              className="jn-draw"
              d="M4 26c8-14 14-20 18-12s-6 16 2 10 10-18 16-10 0 14 8 8 8-14 14-8 4 10 12 6 12-10 22-8 14 4 20 2"
              pathLength={1}
              stroke="var(--pond)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ "--d": "2200ms", "--dur": "1100ms" } as CSSProperties}
            />
          </svg>
          <span className="jn-in block text-[0.625rem] text-ink-3" style={d(2900)}>
            Dr. Ananya Rao, MBBS, MD
          </span>
        </span>
        <span className="jn-pop flex size-12 items-center justify-center rounded-full border-2 border-primary text-[0.5625rem] leading-tight font-bold text-primary" style={d(3000)}>
          SIGNED
        </span>
      </div>

      <span className="jn-pop mt-auto flex h-11 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-white" style={d(3400)}>
        <Download className="size-4" />
        Download report
      </span>

      <div
        className="jn-drop absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 rounded-2xl bg-pond p-3 text-white shadow-lg"
        style={d(3700)}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-mint-glow text-pond">
          <FileHeart className="size-4" />
        </span>
        <span>
          <span className="block font-semibold">Your report is ready</span>
          <span className="block text-[0.6875rem] text-on-pine-2">Also sent to your son&apos;s app</span>
        </span>
      </div>
    </div>
  );
}
