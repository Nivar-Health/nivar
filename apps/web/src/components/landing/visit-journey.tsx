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
  RotateCcw,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { LANGUAGES } from "./l10n";
import { useMotionPaused } from "./motion";
import { revealProps } from "./primitives";
import "./visit-journey.css";

export type JourneyStep = {
  title: string;
  text: string;
  time: string;
};

/** Step 1 is a WhatsApp chat only when WhatsApp exists; otherwise it is the callback request. */
const ICONS: LucideIcon[] = [SITE.whatsapp ? MessageCircle : ClipboardPen, PhoneCall, DoorOpen, FileHeart];
/** The story's pace: long enough to read each step's words; every scene finishes by about 4 s. */
const DWELL_MS = [8000, 9000, 10500, 9000];
/** The share of the phone that must be in view for the story to start, and to keep playing. */
const IN_VIEW = 0.35;

/** The phone, its story and the Pause control exist from md, where the steps sit beside it. */
const WIDE = "(width >= 48rem)";
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const isWide = () => window.matchMedia(WIDE).matches;
const serverWide = () => false;

type Direction = "next" | "prev" | null;

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * "How it works": four steps, all of them always readable.
 *
 * Phones get the steps alone, as a static timeline: plain HTML that needs no JavaScript.
 *
 * From md a phone beside the list acts each step out (the request, the call back, the nurse's arrival,
 * the report). The story plays once: it starts when the phone is first seen, advances while it stays in
 * view (and holds in a hidden tab), then rests on the last step, where Pause becomes Replay. Pause stops
 * it (WCAG 2.2.2), and so does any sign that the visitor has taken over: picking a step, swiping the
 * phone or moving focus into the list. Play resumes it.
 *
 * Until it is first seen the phone holds the first scene's finished frame, so it is never blank. Under
 * reduced motion (or the visitor's own pause) nothing advances and every scene shows its finished state.
 */
export function VisitJourney({ steps }: { steps: readonly JourneyStep[] }) {
  const uid = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);
  const [dir, setDir] = useState<Direction>(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [tookOver, setTookOver] = useState(false);
  const reduced = useMotionPaused();
  const wide = useSyncExternalStore(subscribeWide, isWide, serverWide);
  const held = userPaused || tookOver;
  /** The story still has steps to play by itself, though it may be off screen or in a hidden tab right now. */
  const auto = wide && !reduced && !ended && !held;
  const playing = auto && started && inView && tabVisible;
  const n = steps.length;

  /** The first good look at the phone has happened, or the visitor already picked a step. */
  const seen = useRef(false);
  /** The latest value, for the observers set up once. */
  const live = useRef({ auto });
  /** Time already played of the current run, so Play continues a paused step instead of restarting it. */
  const clock = useRef({ key: "", ms: 0 });
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    live.current = { auto };
  }, [auto]);

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
        const nowInView = shown >= IN_VIEW;
        setInView(nowInView);
        if (nowInView && !wasInView) {
          if (!seen.current) {
            // The first good look: the scene and its timer start together, from the first frame.
            seen.current = true;
            setStarted(true);
            setRun((r) => r + 1);
          } else if (live.current.auto) {
            // Back in view mid-story: the current step plays again.
            setRun((r) => r + 1);
          }
        }
        wasInView = nowInView;
      },
      { threshold: [0, 0.1, 0.2, IN_VIEW, 0.5, 0.75, 1] },
    );
    io.observe(el);
    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      setTabVisible(visible);
      if (visible && seen.current && live.current.auto) setRun((r) => r + 1);
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
    const startedAt = performance.now();
    const t = window.setTimeout(
      () => {
        if (active >= n - 1) {
          // Once through: the story rests on the last step until Replay.
          setEnded(true);
          return;
        }
        setActive(active + 1);
        setRun((r) => r + 1);
        setDir(null);
      },
      Math.max(0, (DWELL_MS[active] ?? 8000) - clock.current.ms),
    );
    return () => {
      window.clearTimeout(t);
      if (clock.current.key === key) clock.current.ms += performance.now() - startedAt;
    };
  }, [playing, active, run, n]);

  /** The visitor chose what to see: show it, play its scene, and stop advancing until Play. */
  const show = (i: number, how: Direction) => {
    seen.current = true;
    setStarted(true);
    setActive(i);
    setRun((r) => r + 1);
    setDir(how);
    setTookOver(true);
  };

  const control = ended ? "replay" : held ? "play" : "pause";
  const toggle = () => {
    if (control === "pause") {
      setUserPaused(true);
      return;
    }
    setUserPaused(false);
    setTookOver(false);
    if (control === "replay") {
      setEnded(false);
      setActive(0);
      setDir(null);
    }
    // A plain Pause resumes mid-step. Anything else starts the step afresh, so its scene, its bar and
    // its timer begin together.
    if (control === "replay" || tookOver) setRun((r) => r + 1);
  };

  // Focus moving into the steps means someone is reading or choosing: hold the story (Pause itself excepted).
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest("[data-jn-toggle]")) setTookOver(true);
  };

  // Touch: swipe the phone like stories, left for the next step and right for the previous one. It stops
  // at both ends, and the list beside it does the same job with buttons.
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
    if (Math.abs(dx) <= 40 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
    const to = active + (dx < 0 ? 1 : -1);
    if (to >= 0 && to < n) show(to, dx < 0 ? "next" : "prev");
  };
  const onPointerCancel = () => {
    swipe.current = null;
  };

  return (
    <div
      onFocus={onFocus}
      className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] md:items-center md:gap-6 lg:grid-cols-12 lg:gap-14"
    >
      <ol {...revealProps(0)} className="nv-jn-steps lg:col-span-5">
        {steps.map((s, i) => {
          const Icon = ICONS[i] ?? Check;
          const isActive = i === active;
          return (
            <li key={s.title} className="nv-jn-step" data-state={isActive ? "current" : i < active ? "done" : undefined}>
              {/* Rail from this node's centre to the next one's; from md it fills as the story passes. */}
              {i < n - 1 && (
                <span aria-hidden className="nv-jn-rail">
                  <span />
                </span>
              )}
              <span aria-hidden className="nv-jn-node">
                <Icon className="nv-jn-node-icon" strokeWidth={2} />
                <Check className="nv-jn-node-tick" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="nv-jn-meta">
                  <span className="nv-jn-no">
                    Step {i + 1}
                    <span className="sr-only">,</span>
                  </span>
                  <span id={`${uid}-time-${i}`} className="nv-jn-time">
                    <Clock3 aria-hidden className="size-3.5 shrink-0" />
                    {s.time}
                  </span>
                </p>
                <h3 className="mt-0.5 text-h4 text-ink">{s.title}</h3>
                <p id={`${uid}-text-${i}`} className="mt-1 text-small text-pretty text-ink-2">
                  {s.text}
                </p>
              </div>
              {/* From md the row is also a button that shows its step on the phone. It covers the row, and the
                  words stay outside it, so phones (where it is not displayed) read a plain list. */}
              <button
                type="button"
                onClick={() => show(i, null)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-describedby={`${uid}-time-${i} ${uid}-text-${i}`}
                className="nv-jn-pick focus-ring"
              />
              {/* Out of the flow, so the row is the same height with or without it. Gone once the visitor takes over. */}
              {isActive && wide && !reduced && started && !ended && !tookOver && (
                <span aria-hidden className="nv-jn-track">
                  <span
                    key={run}
                    className="jn-progress block h-full rounded-full bg-primary"
                    style={{ "--dwell": `${DWELL_MS[i] ?? 8000}ms` } as CSSProperties}
                    data-paused={playing ? undefined : ""}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="min-w-0 max-md:hidden lg:col-span-7">
        <div ref={stageRef} className="relative">
          <Stage
            active={active}
            run={run}
            dir={dir}
            still={!playing}
            waiting={!started}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
          {wide && !reduced && (
            <button
              type="button"
              data-jn-toggle=""
              onClick={toggle}
              aria-label={control === "replay" ? "Replay the story" : control === "play" ? "Play the story" : "Pause the story"}
              className="nv-jn-toggle focus-ring"
            >
              {control === "replay" ? <RotateCcw aria-hidden /> : control === "play" ? <Play aria-hidden /> : <Pause aria-hidden />}
              <span>{control === "replay" ? "Replay" : control === "play" ? "Play" : "Pause"}</span>
            </button>
          )}
        </div>

        {/* Hidden from assistive technology with the screens it describes; the steps carry the meaning. */}
        <p aria-hidden className="mt-3 text-center text-[0.875rem] leading-[1.45] text-pretty text-ink-2">
          Illustrative screens, with example names, times and readings.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* The phone and its four scenes                                              */
/* ------------------------------------------------------------------------- */

const SCENES = [SITE.whatsapp ? ChatScene : RequestScene, CallScene, ArriveScene, DoneScene];

/** "care coordinator": the first caller's role without its article, for "Your care coordinator". */
const CALLER_ROLE = SITE.firstCall.who.replace(/^an? /, "");

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
  /** Not playing (held, ended, off screen, hidden tab or reduced motion): the scene's loops rest. */
  still: boolean;
  /** Before the first good look: the scene holds its finished frame, then plays from its start once seen. */
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
      data-waiting={waiting ? "" : undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="nv-jn-stage relative isolate flex justify-center px-4 py-6 lg:py-12"
    >
      <div className="absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(142_211_224/0.35),transparent)]" />
      <div className="absolute -bottom-28 -left-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(1_76_94/0.16),transparent)]" />
      <div className="nv-jn-fit relative w-full max-w-[19.5rem]">
        <div className="nv-jn-device relative h-[30.5rem] overflow-hidden rounded-[2.25rem] border-[6px] border-pond bg-white shadow-[0_40px_80px_-36px_rgb(1_43_54/0.6)]">
          <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-pond" />
          <div
            key={`${active}-${run}`}
            data-dir={dir ?? undefined}
            className={cn(dir ? "nv-jn-scene" : "jn-scene", "absolute inset-0 px-4 pt-11 pb-4")}
          >
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

/** A round photo in a scene: who you will hear from. 32px, or 48px when `large`. Decorative (the stage is aria-hidden). */
function Face({ src, large = false }: { src: string; large?: boolean }) {
  return (
    <span className={cn("relative shrink-0 overflow-hidden rounded-full bg-aqua-2", large ? "size-12" : "size-8")}>
      <Image src={src} alt="" fill sizes={large ? "48px" : "32px"} className="object-cover" />
    </span>
  );
}

/** The round tick that leads a banner or a finished row. */
function Tick({ large = false, className }: { large?: boolean; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full", large ? "size-8" : "size-5", className)}>
      <Check className={large ? "size-4" : "size-3"} strokeWidth={3} />
    </span>
  );
}

/**
 * The notification that ends a scene. It drops in over the scene's own title, and each scene starts its
 * content below where the card lands, so a finished scene never covers what it has just shown.
 */
function Banner({
  delay,
  dark = false,
  lead,
  title,
  children,
}: {
  delay: number;
  dark?: boolean;
  lead: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "jn-drop absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 rounded-2xl p-3 shadow-lg",
        dark ? "bg-pond text-white" : "bg-white text-ink ring-1 ring-border",
      )}
      style={d(delay)}
    >
      {lead}
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={cn("block text-[0.6875rem] leading-snug", dark ? "text-on-pine-2" : "text-ink-3")}>{children}</span>
      </span>
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
            Thank you. {SITE.firstCall.whoCapital} will call you within {SITE.callbackWithin}.
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

      <Banner delay={2800} lead={<Face src="/img/care-coordinator-1x1.jpg" />} title="Request sent">
        {SITE.firstCall.whoCapital} will call you back, usually within {SITE.callbackWithin}.
      </Banner>
    </div>
  );
}

/** Step 2: the care coordinator calls back, and the visit plan fills in. */
function CallScene() {
  const plan = ["B12 injection", "Prescription checked by a doctor", "Today, 6:00 PM", "Price told upfront"];
  return (
    <div className="relative flex h-full flex-col text-[0.75rem]">
      <ScreenTitle sub="Nivar Health">Your callback</ScreenTitle>

      {/* Starts below where the "Visit confirmed" card lands, so the card covers only the title. */}
      <div className="jn-in mt-6 flex flex-col items-center rounded-2xl bg-pond px-4 pt-4 pb-3.5 text-white" style={d(100)}>
        <span className="relative flex rounded-full ring-1 ring-white/20">
          <span className="jn-ripple motion-loop absolute inset-0 rounded-full bg-mint-glow/25" style={d(400)} />
          <Face src="/img/care-coordinator-1x1.jpg" large />
        </span>
        <span className="mt-2.5 text-[0.9375rem] font-semibold">Your {CALLER_ROLE}</span>
        <span className="text-[0.6875rem] text-on-pine-2 tabular-nums">Voice call, 02:14</span>
        <span className="mt-2.5 flex h-5 items-end gap-[3px]">
          {[6, 12, 18, 10, 16, 8, 14, 6, 11].map((h, k) => (
            <span key={k} className="jn-grow w-1 rounded-full bg-mint-glow/80" style={{ height: h, "--d": `${400 + k * 60}ms` } as CSSProperties} />
          ))}
        </span>
      </div>

      <p className="jn-in mt-3.5 font-semibold text-ink-3" style={d(700)}>
        Visit plan
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {plan.map((x, i) => (
          <li key={x} className="jn-in flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 ring-1 ring-border" style={d(900 + i * 450)}>
            <Tick className="bg-primary text-white" />
            <span className="font-medium text-ink">{x}</span>
          </li>
        ))}
      </ul>

      <Banner delay={3200} lead={<Tick large className="bg-primary text-white" />} title="Visit confirmed">
        Today, 6:00 PM, at your home
      </Banner>
    </div>
  );
}

/** The updates a family gets about a visit. The last one is still to come when the nurse arrives. */
const UPDATES = [
  { label: "On the way", time: "5:40 PM", at: 500 },
  { label: "Arrived", time: "6:00 PM", at: 2200 },
  { label: "Finished", time: null, at: 2600 },
];

/**
 * Step 3: the nurse arrives with the kit and the medicines. The screen shows the visit's updates as
 * they come in, never a map: the page promises updates, not live tracking.
 */
function ArriveScene() {
  return (
    <div className="flex h-full flex-col text-[0.75rem]">
      <ScreenTitle sub="Visit updates">Your nurse</ScreenTitle>

      <div className="jn-in mt-3 flex items-center gap-3 rounded-2xl bg-aqua p-3" style={d(100)}>
        <Face src="/img/nurse-portrait-1x1.jpg" large />
        <span className="flex-1">
          <span className="block text-[0.8125rem] font-semibold text-ink">Your Nivar nurse</span>
          <span className="relative block h-4 text-[0.6875rem]">
            <span className="jn-out absolute inset-0 text-ink-2" style={d(2100)}>
              On the way
            </span>
            <span className="jn-in absolute inset-0 font-semibold text-primary" style={d(2200)}>
              Has arrived at your door
            </span>
          </span>
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {UPDATES.map((u) => (
          <li
            key={u.label}
            className={cn(
              "jn-in flex items-center gap-2.5 rounded-xl border px-3 py-2",
              u.time ? "border-border bg-white" : "border-dashed border-border-strong",
            )}
            style={d(u.at)}
          >
            {u.time ? (
              <Tick className="bg-primary text-white" />
            ) : (
              <span className="size-5 shrink-0 rounded-full border-[1.5px] border-dashed border-border-strong" />
            )}
            <span className={cn("flex-1 font-medium", u.time ? "text-ink" : "text-ink-3")}>{u.label}</span>
            {u.time && <span className="text-[0.6875rem] text-ink-3 tabular-nums">{u.time}</span>}
          </li>
        ))}
      </ul>

      <p className="jn-in mt-4 font-semibold text-ink-3" style={d(3000)}>
        In the nurse&apos;s bag
      </p>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {[
          { icon: PackageCheck, label: "Sealed kit" },
          { icon: Pill, label: "Medicines" },
          { icon: Gauge, label: "BP" },
          { icon: Activity, label: "ECG" },
        ].map((x, i) => (
          <span key={x.label} className="jn-pop flex flex-col items-center gap-1 rounded-xl bg-white py-2 ring-1 ring-border" style={d(3100 + i * 150)}>
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
      <ScreenTitle sub="Today, 6:00 PM">Your visit</ScreenTitle>

      {/* Starts below where the two-line "Care done" card lands, so the doctor's face stays in view. */}
      <div className="jn-in relative mt-10 h-[6.5rem] shrink-0 overflow-hidden rounded-2xl bg-pond" style={d(100)}>
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

      {/* The report's panel arrives just before its message, instead of sitting empty. */}
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
          <span className="mt-1.5 block">Here is today&apos;s report. Take care.</span>
        </Bubble>
      </div>

      <Banner delay={3400} dark lead={<Tick large className="bg-mint-glow text-pond" />} title="Care done">
        Report sent {SITE.report.channel}, to you and your mother
      </Banner>
    </div>
  );
}
