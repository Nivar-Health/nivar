"use client";

import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardPen,
  Clock3,
  DoorOpen,
  FileHeart,
  FileText,
  Gauge,
  MessageCircle,
  Mic,
  PackageCheck,
  Pause,
  PhoneCall,
  Pill,
  Play,
  Stethoscope,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { LANGUAGES } from "./l10n";
import { useMotionPaused } from "./motion";
import "./visit-journey.css";

export type JourneyStep = {
  title: string;
  /** The step's one word on its tab below lg: "Book", "Call", "Visit", "Report". */
  short: string;
  text: string;
  time: string;
};

/** Step 1 is a WhatsApp chat only when WhatsApp exists; otherwise it is the callback request. */
const ICONS: LucideIcon[] = [SITE.whatsapp ? MessageCircle : ClipboardPen, PhoneCall, DoorOpen, Video];
/** Desktop autoplay: long enough to read each step's words (mob-07); every scene finishes by about 4 s. */
const DWELL_MS = [8000, 9000, 10500, 9000];

/** Autoplay and Pause exist only at lg, where all four steps sit in a list beside the phone. */
const WIDE = "(width >= 64rem)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const isWide = () => window.matchMedia(WIDE).matches;
const serverWide = () => false;

type Direction = "next" | "prev" | null;

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const towards = (to: number, from: number): Direction => (to > from ? "next" : to < from ? "prev" : null);

/**
 * "How it works" as a short story: four steps, and a phone that acts each one out (the request, the
 * doctor's call, the nurse's arrival, the video and the report).
 *
 * Below lg the steps are four tabs over the phone and nothing moves on its own: a tab (or a swipe on the
 * phone) picks a step, its words show in the one tab panel and its scene plays once. The panel keeps the
 * height of the longest step, so neither the tabs nor the phone ever move.
 *
 * At lg the steps are a list beside the phone that plays itself: it advances while in view and holds in a
 * hidden tab. Pause stops it (WCAG 2.2.2), and so does any sign that the visitor has taken over: picking
 * a step, swiping the phone or moving focus into the story. Play resumes it.
 *
 * The first scene waits on a blank screen until half the phone is in view, then plays. Under reduced
 * motion (or the visitor's own pause) nothing advances and every scene shows its finished state.
 */
export function VisitJourney({ steps }: { steps: readonly JourneyStep[] }) {
  const uid = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);
  const [dir, setDir] = useState<Direction>(null);
  const [waiting, setWaiting] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [tookOver, setTookOver] = useState(false);
  const reduced = useMotionPaused();
  const wide = useSyncExternalStore(subscribeWide, isWide, serverWide);
  const held = userPaused || tookOver;
  const playing = wide && !reduced && inView && tabVisible && !held;
  const n = steps.length;

  /** The first good look at the phone has happened, or the visitor already picked a step. */
  const seen = useRef(false);
  /** The latest values, for the observers set up once. */
  const live = useRef({ held, wide, reduced });
  /** Time already played of the current run, so Play continues a paused step instead of restarting it. */
  const clock = useRef({ key: "", ms: 0 });
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    live.current = { held, wide, reduced };
  }, [held, wide, reduced]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let wasInView = false;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        const screen = e.rootBounds?.height || window.innerHeight;
        // Its own share in view, or the share of a short screen it fills.
        const shown = e.isIntersecting ? Math.max(e.intersectionRatio, e.intersectionRect.height / screen) : 0;
        const nowInView = shown >= 0.35;
        setInView(nowInView);
        if (!seen.current) {
          if (shown >= 0.5) {
            // The first good look: the current scene plays from its start.
            seen.current = true;
            setWaiting(false);
            setRun((r) => r + 1);
          } else if (shown === 0 && !live.current.reduced) {
            // Still far away: hold a blank screen, so the scene plays once it is seen instead of twice.
            setWaiting(true);
          }
        } else if (nowInView && !wasInView && live.current.wide && !live.current.held) {
          // Desktop, back in view: the current step plays again.
          setRun((r) => r + 1);
        }
        wasInView = nowInView;
      },
      { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] },
    );
    io.observe(el);
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setTabVisible(visible);
      if (visible && live.current.wide && !live.current.held) setRun((r) => r + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const key = `${active}:${run}`;
    if (clock.current.key !== key) clock.current = { key, ms: 0 };
    const started = performance.now();
    const t = window.setTimeout(
      () => {
        setActive((a) => (a + 1) % n);
        setRun((r) => r + 1);
        setDir(null);
      },
      Math.max(0, (DWELL_MS[active] ?? 8000) - clock.current.ms),
    );
    return () => {
      window.clearTimeout(t);
      if (clock.current.key === key) clock.current.ms += performance.now() - started;
    };
  }, [playing, active, run, n]);

  /** The visitor chose what to see: show it, play its scene, and (at lg) stop advancing until Play. */
  const show = (i: number, how: Direction) => {
    seen.current = true;
    setWaiting(false);
    setActive(i);
    setRun((r) => r + 1);
    setDir(how);
    setTookOver(true);
  };

  const toggle = () => {
    if (held) {
      setUserPaused(false);
      setTookOver(false);
    } else {
      setUserPaused(true);
    }
  };

  // Focus moving into the steps means someone is reading or choosing: hold the story (Pause itself excepted).
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest("[data-jn-toggle]")) setTookOver(true);
  };

  // The tabs (APG, automatic activation): arrows move and select, wrapping; Home and End jump.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = tabs.current.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const to =
      e.key === "ArrowRight" ? (from + 1) % n
      : e.key === "ArrowLeft" ? (from + n - 1) % n
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : -1;
    if (to < 0) return;
    e.preventDefault();
    show(to, towards(to, active));
    tabs.current[to]?.focus();
  };

  // Touch: swipe the phone like stories, left for the next step and right for the previous one (M4).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      show((active + (dx < 0 ? 1 : n - 1)) % n, dx < 0 ? "next" : "prev");
    }
  };
  const onPointerCancel = () => {
    swipe.current = null;
  };

  const panelId = `${uid}-panel`;
  const tabId = (i: number) => `${uid}-tab-${i}`;

  return (
    <div onFocus={onFocus} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="min-w-0 lg:order-2 lg:col-span-7">
        {/* Below lg: the steps as tabs (at lg the list beside the phone takes over; no tablist there). */}
        <div role="tablist" aria-label="Steps of a visit" onKeyDown={onTabKey} className="nv-jn-tabs lg:hidden">
          {steps.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.title}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={on}
                aria-controls={panelId}
                tabIndex={on ? 0 : -1}
                onClick={() => show(i, towards(i, active))}
                className="nv-jn-tab"
              >
                <span className="nv-jn-tab-label">
                  <span className="sr-only">Step </span>
                  <span className="nv-jn-num">{i + 1}</span> {s.short}
                </span>
                <span aria-hidden className="nv-jn-tab-ind" />
              </button>
            );
          })}
        </div>

        {/* One panel for the four tabs: every step's words share one grid cell, so the box is as tall as
            the longest step and only the current one is visible (and read). */}
        <div role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0} className="nv-jn-panel lg:hidden">
          {steps.map((s, i) => (
            <div key={s.title} className="nv-jn-cap" data-active={i === active ? "" : undefined}>
              <p className="nv-jn-meta">
                <span className="font-semibold text-primary">
                  Step {i + 1}
                  <span className="sr-only">,</span>
                </span>
                <span className="inline-flex items-center gap-1 text-ink-3">
                  <Clock3 aria-hidden className="size-3.5" />
                  {s.time}
                </span>
              </p>
              <p className="mt-1 text-h4 text-ink">{s.title}</p>
              <p className="mt-1 text-small text-pretty text-ink-2">{s.text}</p>
            </div>
          ))}
        </div>

        <div ref={stageRef} className="relative mt-2 lg:mt-0">
          <Stage
            active={active}
            run={run}
            dir={dir}
            still={!playing}
            waiting={waiting}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
          {wide && !reduced && (
            <button
              type="button"
              data-jn-toggle=""
              onClick={toggle}
              aria-label={held ? "Play the story" : "Pause the story"}
              className="nv-jn-toggle focus-ring"
            >
              {held ? <Play aria-hidden /> : <Pause aria-hidden />}
              <span>{held ? "Play" : "Pause"}</span>
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-caption text-ink-2 lg:mt-3">Illustrative screens.</p>
      </div>

      <ol className="relative isolate hidden flex-col gap-2 lg:order-1 lg:col-span-5 lg:flex">
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
                onClick={() => show(i, null)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-describedby={`${uid}-time-${i} ${uid}-text-${i}`}
                className="nv-jn-pick group flex w-full gap-5 rounded-[1.5rem] p-4 text-left focus-ring"
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
                    <span id={`${uid}-time-${i}`} className="inline-flex items-center gap-1 text-caption font-medium text-ink-3">
                      <Clock3 aria-hidden className="size-3.5" />
                      {s.time}
                    </span>
                  </span>
                  <span className={cn("mt-1 block text-h4 transition-colors", isActive ? "text-ink" : "text-ink-2")}>
                    {s.title}
                  </span>
                  <span
                    id={`${uid}-text-${i}`}
                    className={cn(
                      "mt-1.5 block text-small text-pretty transition-colors",
                      isActive ? "text-ink-2" : "text-ink-3",
                    )}
                  >
                    {s.text}
                  </span>
                  {isActive && !reduced && (
                    <span aria-hidden className="mt-4 block h-1 overflow-hidden rounded-full bg-primary/12">
                      <span
                        key={run}
                        className="jn-progress block h-full rounded-full bg-primary"
                        style={{ "--dwell": `${DWELL_MS[i] ?? 8000}ms` } as CSSProperties}
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

const SCENES = [SITE.whatsapp ? ChatScene : RequestScene, CallScene, ArriveScene, DoneScene];

function Stage({
  active,
  run,
  dir,
  still,
  waiting,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: {
  active: number;
  run: number;
  dir: Direction;
  /** Not playing (below lg always; held, off screen, hidden tab or reduced motion at lg): the scene's loops rest. */
  still: boolean;
  /** Before the first good look: a blank screen, so the first scene plays when it is seen. */
  waiting: boolean;
  onPointerDown(e: PointerEvent<HTMLDivElement>): void;
  onPointerUp(e: PointerEvent<HTMLDivElement>): void;
  onPointerCancel(): void;
}) {
  const Scene = SCENES[active] ?? SCENES[0];
  return (
    <div
      aria-hidden
      data-still={still ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="nv-jn-stage relative isolate flex justify-center px-4 py-6 lg:py-12"
    >
      <div className="absolute -top-24 -right-24 -z-10 hidden size-80 rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.35),transparent)] sm:block" />
      <div className="absolute -bottom-28 -left-24 -z-10 hidden size-80 rounded-full bg-[radial-gradient(closest-side,rgb(1_76_94/0.16),transparent)] sm:block" />
      <div className="nv-jn-fit relative w-full max-w-[19.5rem]">
        <div className="nv-jn-device relative h-[30.5rem] overflow-hidden rounded-[2.25rem] border-[6px] border-pond bg-white shadow-[0_40px_80px_-36px_rgb(1_43_54/0.6)]">
          <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-pond" />
          {!waiting && (
            <div
              key={`${active}-${run}`}
              data-dir={dir ?? undefined}
              className={cn(dir ? "nv-jn-scene" : "jn-scene", "absolute inset-0 px-4 pt-11 pb-4")}
            >
              <Scene />
            </div>
          )}
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

/** A 32px round photo in a scene: who you will hear from. Decorative (the stage is aria-hidden). */
function Face({ src }: { src: string }) {
  return (
    <span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-aqua-2">
      <Image src={src} alt="" fill sizes="32px" className="object-cover" />
    </span>
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

/** Step 1 (WhatsApp set): the family messages Nivar on WhatsApp, with the prescription. */
function ChatScene() {
  return (
    <div className="-mx-4 -mt-11 flex h-[calc(100%+3.75rem)] flex-col bg-aqua text-[0.75rem]">
      <div className="jn-in flex items-center gap-2.5 bg-white px-4 pt-10 pb-2.5 shadow-xs" style={d(0)}>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-white">N</span>
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
            Thank you! Our doctor will call you within {SITE.callbackWithin} to check the prescription and confirm a time.
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

/** Step 1 (no WhatsApp): the family asks for a callback on this site, with the real form's questions. */
function RequestScene() {
  const kannada = LANGUAGES[1];
  return (
    <div className="relative flex h-full flex-col text-[0.75rem]">
      {/* Inset 4px, so the logo's corner stays hidden behind the rounded "Request sent" card. */}
      <div className="jn-in flex items-center gap-2.5 pt-1 pl-1" style={d(0)}>
        <LogoMark className="size-8" />
        <span>
          <span className="block text-[0.9375rem] font-semibold text-ink">Request a callback</span>
          <span className="block text-[0.6875rem] text-ink-3">Nivar Health</span>
        </span>
      </div>

      {/* Starts below where the two-line "Request sent" card lands, so the card covers only the header. */}
      <div className="jn-in mt-11" style={d(300)}>
        <p className="font-semibold text-ink">Who is the visit for?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Myself", "A parent", "A child"].map((who) => (
            <span
              key={who}
              className={cn(
                "rounded-full border px-2.5 py-1.5 font-medium",
                who === "A parent" ? "nv-jn-select border-primary bg-aqua text-primary" : "border-border-strong bg-white text-ink-2",
              )}
              style={who === "A parent" ? d(800) : undefined}
            >
              {who}
            </span>
          ))}
        </div>
      </div>

      <div className="jn-in mt-4" style={d(1100)}>
        <p className="font-semibold text-ink">Preferred language for the call</p>
        <p className="mt-2 flex h-9 items-center justify-between rounded-xl border border-border-strong bg-white px-3 text-ink">
          <span>
            <span lang={kannada.lang}>{kannada.endonym}</span> ({kannada.english})
          </span>
          <ChevronDown className="size-3.5 text-primary" />
        </p>
      </div>

      <div className="jn-in mt-4" style={d(1600)}>
        <p className="font-semibold text-ink">Anything we should know?</p>
        <p className="mt-2 rounded-xl border border-border-strong bg-white px-3 py-2.5 leading-snug text-ink">
          A B12 injection for my mother in HSR Layout. We have her prescription.
        </p>
      </div>

      <span
        className="jn-press mt-auto flex h-10 shrink-0 items-center justify-center rounded-full bg-primary text-[0.8125rem] font-semibold text-white"
        style={d(200)}
      >
        Request a callback
      </span>

      <div
        className="jn-drop absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 rounded-2xl bg-white p-3 text-ink shadow-lg ring-1 ring-border"
        style={d(2800)}
      >
        <Face src="/img/care-coordinator-1x1.jpg" />
        <span>
          <span className="block font-semibold">Request sent</span>
          <span className="block text-[0.6875rem] leading-snug text-ink-3">
            A care coordinator will call you back within {SITE.callbackWithin}.
          </span>
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
          <span className="block text-[0.6875rem] text-ink-3">Today, 6:00 PM. Your nurse will come.</span>
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
      <ScreenTitle sub="Live location">Your nurse</ScreenTitle>

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
        <Face src="/img/nurse-portrait-1x1.jpg" />
        <span className="relative flex-1">
          <span className="block font-semibold text-ink">Your Nivar nurse</span>
          <span className="relative block h-4 text-[0.6875rem]">
            <span className="jn-out absolute inset-0 text-ink-3" style={d(2900)}>
              On the way
            </span>
            <span className="jn-in absolute inset-0 font-semibold text-primary" style={d(3000)}>
              Has arrived at your door
            </span>
          </span>
        </span>
      </div>

      <p className="jn-in mt-3 font-semibold text-ink-3" style={d(3300)}>
        In the nurse&apos;s bag
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
        <Image src="/img/doctor.jpg" alt="" fill sizes="(min-width: 1024px) 270px, 230px" className="object-cover object-[50%_30%]" />
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-pond/85 px-2 py-1 text-[0.625rem] font-semibold text-white">
          <span className="size-1.5 rounded-full bg-mint-glow" />
          On video
        </span>
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[0.6875rem] font-semibold text-ink">
          Your Nivar doctor
        </span>
        <span className="jn-pop absolute right-2.5 bottom-2.5 flex size-11 items-center justify-center rounded-xl bg-aqua-2 text-primary ring-2 ring-white" style={d(500)}>
          <UserRound className="size-5" />
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

      {/* The report's panel arrives just before its message (mob-03), instead of sitting empty. */}
      <div className="jn-in mt-3 flex flex-1 flex-col justify-end rounded-2xl bg-aqua p-2.5" style={d(1700)}>
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
          <span className="block text-[0.6875rem] text-on-pine-2">Report sent on WhatsApp, to you and your mother</span>
        </span>
      </div>
    </div>
  );
}
