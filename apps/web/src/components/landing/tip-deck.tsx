"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Droplet,
  Footprints,
  Gauge,
  HeartPulse,
  Moon,
  Share,
  Soup,
  Wind,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { HealthSource, HealthTip, TipCategory } from "./health-content";
import { buttonClass } from "./primitives";
import "./health-tips.css";

const TIP_ICONS: Record<TipCategory, LucideIcon> = {
  Checks: Gauge,
  Heart: HeartPulse,
  Food: Soup,
  Movement: Footprints,
  Sleep: Moon,
  Sugar: Droplet,
  Breath: Wind,
};

/** The category's icon disc and the colour of its glyph. */
const TIP_TONES: Record<TipCategory, { disc: string; ink: string }> = {
  Checks: { disc: "bg-sky-tint", ink: "text-sky-ink" },
  Heart: { disc: "bg-rose-tint", ink: "text-rose-ink" },
  Food: { disc: "bg-marigold-tint", ink: "text-marigold-ink" },
  Movement: { disc: "bg-aqua", ink: "text-primary" },
  Sleep: { disc: "bg-sky-tint", ink: "text-sky-ink" },
  Sugar: { disc: "bg-marigold-tint", ink: "text-marigold-ink" },
  Breath: { disc: "bg-aqua", ink: "text-primary" },
};

/** A swipe counts past 48px sideways, and only when it is clearly more sideways than up or down. */
const SWIPE_MIN = 48;
/** How far the tip follows the finger while it moves. */
const FOLLOW = 0.35;
/** How long Share shows "Copied" (K4). */
const NOTE_MS = 2000;
/** Pressed state (mobile addendum M2): a tint and scale .97, 90 ms in and 180 ms out; tint only when reduced. */
const PRESS =
  "transition-[background-color,border-color,color,translate,scale] duration-180 active:scale-[0.97] active:bg-aqua active:duration-90 motion-reduce:active:scale-100";

type ShareNote = "Copied" | "Couldn't copy";

const subscribeNever = () => () => {};

/** Share needs Web Share or the async clipboard; without either the button stays hidden. */
function canShareOrCopy() {
  return typeof navigator.share === "function" || typeof navigator.clipboard?.writeText === "function";
}

function motionPaused() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "paused"
  );
}

/** "{title}: {text}" and its sources with their full labels. */
function shareText(tip: HealthTip) {
  const sources = tip.sources.map((s) => `${s.label} ${s.url}`).join("; ");
  return `${tip.title}: ${tip.text}\n${tip.sources.length > 1 ? "Sources" : "Source"}: ${sources}`;
}

/** Web Share where the browser has it, otherwise a copy. Returns the note to show, or null for none. */
async function shareTip(tip: HealthTip): Promise<ShareNote | null> {
  const url = `${window.location.origin}/#health-tips`;
  const text = shareText(tip);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: tip.title, text, url });
      return null;
    } catch (error) {
      // Closing the share sheet is not a failure. Anything else falls back to a copy.
      if (error instanceof DOMException && error.name === "AbortError") return null;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "Copied";
  } catch {
    return "Couldn't copy";
  }
}

/**
 * Underlined source link that opens in a new tab. Client twin of the one in health-facts.tsx. Inline, so
 * its press is a tint only.
 */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "rounded-sm underline decoration-border-strong underline-offset-[3px] transition-colors duration-180 hover:text-foreground hover:decoration-current focus-ring active:bg-aqua/60 active:duration-90",
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** The card's sources, with their short labels ("All sources" and the Share text keep the full ones). */
function TipSources({
  sources,
  className,
  style,
}: {
  sources: readonly HealthSource[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p className={cn("text-caption text-pretty text-ink-3", className)} style={style}>
      {sources.length > 1 ? "Sources: " : "Source: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && "; "}
          <ExternalLink href={s.url} className={s.short && "whitespace-nowrap"}>
            {s.short ?? s.label}
          </ExternalLink>
        </span>
      ))}
    </p>
  );
}

/** The tip's category as a small glyph disc beside its title. Decorative. */
function TipCategoryMark({ tip }: { tip: HealthTip }) {
  const Icon = TIP_ICONS[tip.category];
  const tone = TIP_TONES[tip.category];
  return (
    <span
      aria-hidden
      className={cn("mt-[-0.1875rem] flex size-8 shrink-0 items-center justify-center rounded-full sm:mt-0.5", tone.disc, tone.ink)}
    >
      <Icon className="size-4" strokeWidth={2.25} />
    </span>
  );
}

/**
 * Tip of the day (IST calendar day), then any other tip by Previous / Next or a swipe. Never
 * auto-advances. The card fits the tip it shows; the arrows sit in the header, above anything whose
 * height changes, so the control being tapped never moves. A text-only polite status names each new tip
 * and confirms a copy (the tip itself is not a live region, so modals can hide it).
 */
export function TipDeck({
  tips,
  initialIndex,
  dateLabel,
  className,
}: {
  tips: readonly HealthTip[];
  initialIndex: number;
  dateLabel: string;
  className?: string;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [dir, setDir] = useState<1 | -1>(1);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState<{ text: ShareNote; at: number } | null>(null);
  /** The polite status: set by a step or a copy only, so the note running out never re-announces the tip. */
  const [status, setStatus] = useState("");
  const titleId = useId();
  const shareable = useSyncExternalStore(subscribeNever, canShareOrCopy, () => true);
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swipedAt = useRef(Number.NEGATIVE_INFINITY);
  const tip = tips[index];
  const isToday = index === initialIndex;
  const count = tips.length;

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), NOTE_MS);
    return () => window.clearTimeout(t);
  }, [note]);

  const go = (step: 1 | -1) => {
    const next = (index + step + count) % count;
    setDir(step);
    setTouched(true);
    setNote(null);
    setIndex(next);
    setStatus(`Tip ${next + 1} of ${count}: ${tips[next].title}`);
  };

  const share = async (e: ReactMouseEvent<HTMLButtonElement>) => {
    const text = await shareTip(tip);
    if (!text) return;
    setNote({ text, at: e.timeStamp });
    // Emptied first, so a second copy is announced again.
    setStatus("");
    requestAnimationFrame(() => setStatus(text));
  };

  // Swipe: touch and pen only (a mouse drag selects text). The card follows the finger a little.
  const follow = (dx: number, settle: boolean) => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.toggleAttribute("data-settle", settle);
    layer.style.setProperty("--nv-habits-drag", `${dx * FOLLOW}px`);
    layer.style.setProperty("--nv-habits-fade", String(1 - Math.min(0.4, Math.abs(dx) / 400)));
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (d.axis === "x" && !motionPaused()) follow(dx, false);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (e.type === "pointerup" && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      follow(0, false); // the next tip slides in on its own
      swipedAt.current = e.timeStamp;
      go(dx < 0 ? 1 : -1);
    } else {
      follow(0, true);
    }
  };
  // A swipe that ends on a link must not open it.
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.timeStamp - swipedAt.current < 400) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const arrowClass = buttonClass("secondary", cn(PRESS, "size-11 px-0"));
  const animate = touched ? "tip-in" : undefined;
  const counter = (
    <>
      <span className="sr-only">Tip </span>
      {index + 1} of {count}
    </>
  );

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "nv-habits-tip flex flex-col rounded-3xl bg-card p-4 shadow-[0_18px_40px_-32px_rgb(1_43_54/0.45)] ring-1 ring-ink/6 sm:p-8",
        className,
      )}
    >
      {/* Header: what this is on the left (the date drops under the chip on phones), the pager on the right.
          Below 360 the chip, the counter and both arrows can't share a row, so the counter joins the
          date's line; only one of the two counters is ever displayed. */}
      <div className="flex min-h-11 items-center gap-3 max-sm:min-h-[3.125rem]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <p className="rounded-full bg-aqua px-3 py-1 text-sm font-semibold whitespace-nowrap text-primary">
            {isToday ? "Tip of the day" : "Health tip"}
          </p>
          {isToday && <p className="text-caption/[1.35] font-medium whitespace-nowrap text-ink-3">{dateLabel}</p>}
          <span className="hidden min-w-12 text-caption/[1.35] font-semibold whitespace-nowrap text-ink-3 tabular-nums max-[22.5rem]:block">
            {counter}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="min-w-12 text-center text-caption font-semibold whitespace-nowrap text-ink-3 tabular-nums max-[22.5rem]:hidden">
            {counter}
          </span>
          <button type="button" aria-label="Previous tip" onClick={() => go(-1)} className={arrowClass}>
            <ArrowLeft aria-hidden />
          </button>
          <button type="button" aria-label="Next tip" onClick={() => go(1)} className={arrowClass}>
            <ArrowRight aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="mt-3 touch-pan-y sm:mt-6"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <div ref={layerRef} className="nv-habits-tip-layer">
          <div key={tip.id} className={animate} style={{ "--dir": dir } as CSSProperties}>
            <div className="flex items-start gap-3">
              <TipCategoryMark tip={tip} />
              <h3
                id={titleId}
                className="min-w-0 text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.022em] text-balance text-ink sm:text-[1.75rem]"
              >
                {tip.title}
              </h3>
            </div>
            <p className="mt-2.5 max-w-[34rem] text-small/[1.5] text-pretty text-ink-2 sm:mt-3 sm:text-body">{tip.text}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 sm:mt-6 sm:gap-5">
        {/* It slides in with the tip, from the same side. */}
        <TipSources
          key={tip.id}
          sources={tip.sources}
          className={cn("min-w-0 flex-1", animate)}
          style={{ "--dir": dir } as CSSProperties}
        />
        {shareable && (
          <button
            type="button"
            onClick={share}
            className={buttonClass(
              "secondary",
              cn(PRESS, "nv-habits-share px-3.5 sm:px-4 max-[22.5rem]:size-11 max-[22.5rem]:px-0"),
            )}
          >
            {note?.text === "Couldn't copy" ? (
              <>
                <CircleAlert aria-hidden />
                <span className="max-[22.5rem]:sr-only">Couldn&apos;t copy</span>
              </>
            ) : (
              <>
                {/* Both labels share one cell, so the button keeps its width when it says "Copied". */}
                <span aria-hidden className="grid [&>*]:[grid-area:1/1]">
                  <Share className={cn(note && "invisible")} />
                  <Check className={cn(!note && "invisible")} strokeWidth={2.5} />
                </span>
                <span className="grid [&>*]:[grid-area:1/1] max-[22.5rem]:sr-only">
                  <span className={cn(note && "invisible")}>Share tip</span>
                  <span className={cn(!note && "invisible")}>Copied</span>
                </span>
              </>
            )}
          </button>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </article>
  );
}
