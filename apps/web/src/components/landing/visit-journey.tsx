"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  Check,
  CheckCheck,
  Clock3,
  DoorOpen,
  FileHeart,
  FileText,
  Gauge,
  MessageCircle,
  Mic,
  PackageCheck,
  PhoneCall,
  Pill,
  Stethoscope,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMotionPaused } from "./motion";

export type JourneyStep = { title: string; text: string; time: string };

const ICONS: LucideIcon[] = [MessageCircle, PhoneCall, DoorOpen, Video];
/** How long each step stays on screen; each scene finishes its own animation about 2s before. */
const DWELL_MS = [6000, 6200, 6400, 7000];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * "How it works" as a short story: four steps on the left, and a phone that acts each one out
 * (a WhatsApp chat, the doctor's call, the nurse's arrival, the video and the report).
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

        <p className="mt-4 text-center text-caption text-ink-3 lg:mt-4">Illustrative screens. Names are examples.</p>
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
                  isActive ? "bg-white shadow-[0_20px_44px_-30px_rgb(1_43_54/0.55)]" : "hover:bg-white/60",
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

const SCENES = [ChatScene, CallScene, ArriveScene, DoneScene];

function Stage({ active, run }: { active: number; run: number }) {
  const Scene = SCENES[active] ?? ChatScene;
  return (
    <div
      aria-hidden
      className="relative isolate flex justify-center overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#ffffff_0%,var(--aqua)_60%,var(--aqua-2)_100%)] px-4 py-10 ring-1 ring-white sm:py-12"
    >
      <div className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.35),transparent)]" />
      <div className="absolute -bottom-28 -left-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(1_76_94/0.16),transparent)]" />
      <div className="relative w-full max-w-[19.5rem]">
        <div className="relative h-[30.5rem] overflow-hidden rounded-[2.25rem] border-[6px] border-pond bg-white shadow-[0_40px_80px_-36px_rgb(1_43_54/0.6)]">
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

/** A chat bubble: `out` is the family's own message (right, green), otherwise Nivar's (left, white). */
function Bubble({ out = false, delay, time, children }: { out?: boolean; delay: number; time: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "jn-in max-w-[85%] rounded-2xl px-3 py-2 leading-snug text-ink shadow-xs",
        out ? "self-end rounded-br-md bg-[#d9fdd3]" : "self-start rounded-bl-md bg-white",
      )}
      style={d(delay)}
    >
      {children}
      <span className="mt-0.5 flex items-center justify-end gap-1 text-[0.5625rem] text-ink-3">
        {time}
        {out && <CheckCheck className="size-3 text-sky-ink" />}
      </span>
    </div>
  );
}

/** Step 1: the family messages Nivar on WhatsApp, with the prescription. */
function ChatScene() {
  return (
    <div className="-mx-4 -mt-11 flex h-[calc(100%+3.75rem)] flex-col bg-aqua text-[0.75rem]">
      <div className="jn-in flex items-center gap-2.5 bg-white px-4 pt-10 pb-2.5 shadow-xs" style={d(0)}>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-bold text-white">N</span>
        <span className="flex-1">
          <span className="block font-semibold text-ink">Nivar Health</span>
          <span className="block text-[0.625rem] text-signal-ink">online</span>
        </span>
        <PhoneCall className="size-4 text-primary" />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 pt-4">
        <Bubble out delay={300} time="4:02 PM">
          Hi, my mother needs a B12 injection at home. HSR Layout, Sector 2.
        </Bubble>
        <Bubble out delay={1000} time="4:02 PM">
          <span className="flex items-center gap-2 rounded-lg bg-white/70 p-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-sky-tint text-sky-ink">
              <FileText className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">Prescription.jpg</span>
              <span className="block text-[0.625rem] text-ink-3">Photo</span>
            </span>
          </span>
        </Bubble>
        <span className="jn-out flex w-fit gap-1 self-start rounded-2xl bg-white px-3 py-2.5 shadow-xs" style={d(2300)}>
          {[0, 1, 2].map((k) => (
            <span key={k} className="size-1.5 rounded-full bg-ink-3/50" />
          ))}
        </span>
        {/* Takes the typing dots' place (26px tall + the 8px gap) once they fade. */}
        <div className="-mt-[2.125rem] flex flex-col">
          <Bubble delay={2400} time="4:03 PM">
            Thank you! Our doctor will call you in a few minutes to check the prescription and confirm a time.
          </Bubble>
        </div>
      </div>

      <div className="jn-in flex items-center gap-2 px-3 pt-2 pb-4" style={d(200)}>
        <span className="flex h-9 flex-1 items-center rounded-full bg-white px-3.5 text-ink-3">Message</span>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-white">
          <Mic className="size-4" />
        </span>
      </div>
    </div>
  );
}

/** Step 2: a Nivar doctor calls, and the visit plan fills in. */
function CallScene() {
  const plan = ["B12 injection, IM", "Prescription checked", "Today, 6:00 PM", "Price told upfront"];
  return (
    <div className="relative flex h-full flex-col text-[0.75rem]">
      <div className="jn-in flex flex-col items-center rounded-2xl bg-pond px-4 pt-5 pb-4 text-white" style={d(0)}>
        <span className="relative flex size-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
          <span className="jn-ripple motion-loop absolute inset-0 rounded-full bg-mint-glow/25" style={d(400)} />
          <Stethoscope className="size-6 text-mint-glow" />
        </span>
        <span className="mt-3 text-[0.9375rem] font-semibold">Your Nivar doctor</span>
        <span className="text-[0.6875rem] text-on-pine-2 tabular-nums">Voice call, 02:14</span>
        <span className="mt-3 flex h-5 items-end gap-[3px]">
          {[6, 12, 18, 10, 16, 8, 14, 6, 11].map((h, k) => (
            <span key={k} className="jn-grow w-1 rounded-full bg-mint-glow/80" style={{ height: h, "--d": `${300 + k * 60}ms` } as CSSProperties} />
          ))}
        </span>
      </div>

      <p className="jn-in mt-4 font-semibold text-ink-3" style={d(700)}>
        Visit plan
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {plan.map((x, i) => (
          <li key={x} className="jn-in flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 ring-1 ring-border" style={d(900 + i * 450)}>
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="font-medium text-ink">{x}</span>
          </li>
        ))}
      </ul>

      <div
        className="jn-drop absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 rounded-2xl bg-white p-3 text-ink shadow-lg ring-1 ring-border"
        style={d(3200)}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span>
          <span className="block font-semibold">Visit confirmed</span>
          <span className="block text-[0.6875rem] text-ink-3">Today, 6:00 PM. Priya will come.</span>
        </span>
      </div>
    </div>
  );
}

/** Step 3: the nurse travels to the home with the kit and the medicines. */
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
          <circle className="jn-ripple motion-loop" cx="214" cy="58" r="15" fill="var(--primary)" fillOpacity={0.3} style={d(2900)} />
          <circle cx="214" cy="58" r="14" fill="var(--primary)" stroke="white" strokeWidth={3} />
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
          { icon: PackageCheck, label: "Sealed kit" },
          { icon: Pill, label: "Medicines" },
          { icon: Gauge, label: "BP" },
          { icon: Activity, label: "ECG" },
        ].map((x, i) => (
          <span key={x.label} className="jn-pop flex flex-col items-center gap-1 rounded-xl bg-white py-2 ring-1 ring-border" style={d(3400 + i * 150)}>
            <span className="flex size-7 items-center justify-center rounded-lg bg-aqua text-primary">
              <x.icon className="size-4" />
            </span>
            <span className="text-[0.625rem] font-semibold text-ink-2">{x.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Step 4: the doctor joins on video, the care is done, and the report arrives on WhatsApp. */
function DoneScene() {
  const rows = [
    { label: "B12 injection", value: "Given, 6:12 PM", flag: "Done" },
    { label: "Blood pressure", value: "126/78", flag: "Elevated" },
  ];
  return (
    <div className="relative flex h-full flex-col text-[0.75rem]">
      <div className="jn-in relative h-[8.5rem] shrink-0 overflow-hidden rounded-2xl bg-pond" style={d(0)}>
        <Image src="/img/doctor.jpg" alt="" fill sizes="300px" className="object-cover object-[50%_30%]" />
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-pond/80 px-2 py-1 text-[0.625rem] font-semibold text-white backdrop-blur">
          <span className="size-1.5 rounded-full bg-mint-glow" />
          On video
        </span>
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.6875rem] font-semibold text-ink backdrop-blur">
          Your Nivar doctor
        </span>
        <span className="jn-pop absolute right-2.5 bottom-2.5 flex size-11 items-center justify-center rounded-xl bg-aqua-2 text-[0.8125rem] font-semibold text-primary ring-2 ring-white" style={d(500)}>
          KI
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.label} className="jn-in flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-border" style={d(700 + i * 450)}>
            <span className="text-ink-3">{r.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-ink tabular-nums">{r.value}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold",
                  r.flag === "Elevated" ? "bg-marigold-tint text-marigold-ink" : "bg-aqua text-primary",
                )}
              >
                {r.flag}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-end rounded-2xl bg-aqua p-2.5">
        <Bubble delay={1900} time="6:40 PM">
          <span className="flex items-center gap-2 rounded-lg bg-aqua p-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-rose-tint text-rose-ink">
              <FileHeart className="size-4" />
            </span>
            <span>
              <span className="block font-semibold">Visit report.pdf</span>
              <span className="block text-[0.625rem] text-ink-3">Signed by your doctor</span>
            </span>
          </span>
          <span className="mt-1.5 block">Here is today&apos;s report. Take care!</span>
        </Bubble>
      </div>

      <div
        className="jn-drop absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 rounded-2xl bg-pond p-3 text-white shadow-lg"
        style={d(3400)}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-mint-glow text-pond">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span>
          <span className="block font-semibold">Care done</span>
          <span className="block text-[0.6875rem] text-on-pine-2">Report sent on WhatsApp, to you and your son</span>
        </span>
      </div>
    </div>
  );
}
