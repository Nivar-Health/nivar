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

/** The category's icon disc and the colour of its name. */
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

/** "{title}: {text}" and its sources, the way the card shows them. */
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

/** Underlined source link that opens in a new tab. Client twin of the one in health-facts.tsx. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "rounded-sm underline decoration-border-strong underline-offset-[3px] hover:text-foreground hover:decoration-current focus-ring",
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function TipSources({ sources }: { sources: readonly HealthSource[] }) {
  return (
    <p className="mt-3 text-caption text-ink-3 sm:mt-5">
      {sources.length > 1 ? "Sources: " : "Source: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && "; "}
          <ExternalLink href={s.url}>{s.label}</ExternalLink>
        </span>
      ))}
    </p>
  );
}

function TipBody({ tip, titleId }: { tip: HealthTip; titleId?: string }) {
  return (
    <>
      <h3
        id={titleId}
        className="text-[1.375rem] leading-[1.15] font-semibold tracking-[-0.022em] text-balance text-ink sm:text-[1.75rem]"
      >
        {tip.title}
      </h3>
      <p className="mt-2 text-small/[1.5] text-pretty text-ink-2 sm:mt-3 sm:text-body">{tip.text}</p>
      <TipSources sources={tip.sources} />
    </>
  );
}

/** The tip's category: an icon disc, with its name from sm. Decorative; the live region says it. */
function TipCategoryMark({ tip, className, style }: { tip: HealthTip; className?: string; style?: CSSProperties }) {
  const Icon = TIP_ICONS[tip.category];
  const tone = TIP_TONES[tip.category];
  return (
    <span aria-hidden className={cn("flex items-center gap-2 text-sm font-semibold", tone.ink, className)} style={style}>
      <span className="hidden sm:inline">{tip.category}</span>
      <span className={cn("flex size-8 items-center justify-center rounded-full", tone.disc)}>
        <Icon className="size-4" strokeWidth={2.25} />
      </span>
    </span>
  );
}

/**
 * Tip of the day (IST calendar day), then any other tip by Previous / Next or a swipe. Never
 * auto-advances. Every tip is rendered invisibly underneath, so the card keeps the height of the
 * longest one, and the visible copy sits in a polite live region that changes only when asked.
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
  const titleId = useId();
  const shareable = useSyncExternalStore(subscribeNever, canShareOrCopy, () => true);
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swipedAt = useRef(Number.NEGATIVE_INFINITY);
  const tip = tips[index];
  const isToday = index === initialIndex;

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), NOTE_MS);
    return () => window.clearTimeout(t);
  }, [note]);

  const go = (step: 1 | -1) => {
    setDir(step);
    setTouched(true);
    setIndex((i) => (i + step + tips.length) % tips.length);
  };

  const share = async (e: ReactMouseEvent<HTMLButtonElement>) => {
    const text = await shareTip(tip);
    if (text) setNote({ text, at: e.timeStamp });
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
  // A swipe that ends on a source link must not open it.
  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.timeStamp - swipedAt.current < 400) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const arrowClass = buttonClass("secondary", cn(PRESS, "size-11 px-0"));

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl bg-card p-5 shadow-[0_18px_40px_-32px_rgb(1_43_54/0.45)] ring-1 ring-ink/6 sm:p-8",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="rounded-full bg-aqua px-3 py-1 text-sm font-semibold text-primary">
          {isToday ? "Tip of the day" : "Health tip"}
        </p>
        {isToday && <p className="text-sm font-medium text-ink-3">{dateLabel}</p>}
        <TipCategoryMark
          key={tip.id}
          tip={tip}
          className={cn("ml-auto", touched && "tip-in")}
          style={{ "--dir": dir } as CSSProperties}
        />
      </div>

      <div
        className="mt-4 grid flex-1 touch-pan-y sm:mt-6"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {tips.map((t) => (
          <div key={t.id} aria-hidden className="invisible [grid-area:1/1]">
            <TipBody tip={t} />
          </div>
        ))}
        <div ref={layerRef} aria-live="polite" aria-atomic="true" className="nv-habits-tip-layer [grid-area:1/1]">
          <div key={tip.id} className={touched ? "tip-in" : undefined} style={{ "--dir": dir } as CSSProperties}>
            <span className="sr-only">
              Tip {index + 1} of {tips.length}. {tip.category}.{" "}
            </span>
            <TipBody tip={tip} titleId={titleId} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3.5 sm:mt-7 sm:pt-5">
        <div className="relative">
          {shareable && (
            <button
              type="button"
              onClick={share}
              className={buttonClass("secondary", cn(PRESS, "px-3.5 sm:px-4"))}
            >
              <Share aria-hidden />
              Share tip
            </button>
          )}
          <p
            role="status"
            data-show={note ? "" : undefined}
            className="nv-habits-share-note pointer-events-none absolute bottom-full left-0 mb-2 flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[0.8125rem] font-semibold whitespace-nowrap text-white shadow-[0_10px_24px_-12px_rgb(1_43_54/0.6)]"
          >
            {note && (
              <>
                {note.text === "Copied" ? (
                  <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                ) : (
                  <CircleAlert aria-hidden className="size-3.5" strokeWidth={2.25} />
                )}
                {note.text}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Previous tip" onClick={() => go(-1)} className={arrowClass}>
            <ArrowLeft aria-hidden />
          </button>
          <span aria-hidden className="min-w-[3.5rem] text-center text-[0.8125rem] font-semibold text-ink-3 tabular-nums">
            {index + 1} of {tips.length}
          </span>
          <button type="button" aria-label="Next tip" onClick={() => go(1)} className={arrowClass}>
            <ArrowRight aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
