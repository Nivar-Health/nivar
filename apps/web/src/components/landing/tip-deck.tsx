"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Droplet,
  Footprints,
  Gauge,
  HeartPulse,
  Moon,
  PhoneCall,
  Share,
  Soup,
  Wind,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "./external-link";
import type { HealthSource, HealthTip, TipCategory } from "./health-content";
import { buttonClass } from "./primitives";
import { Pearl } from "./take-a-minute/pearl";
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
/** The first block after `el` that is displayed (the walk photo is not, on phones). */
function nextShown(el: Element | null): Element | null {
  let next = el?.nextElementSibling ?? null;
  while (next && next.getClientRects().length === 0) next = next.nextElementSibling;
  return next;
}

/** The blocks under the card glide to their new place for this long (health-tips.css), plus a margin. */
const GLIDE_MS = 260;
/** Pressed state (mobile addendum M2): a tint and scale .97, 90 ms in and 180 ms out; tint only when reduced. */
const PRESS =
  "transition-[background-color,border-color,color,translate,scale] duration-180 active:scale-[0.97] active:bg-aqua active:duration-90 motion-reduce:active:scale-100";

type ShareNote = "Copied" | "Couldn't copy";
/** What the button can do here: open the phone's share sheet, copy, or nothing (then it stays hidden). */
type ShareMode = "share" | "copy" | "none";

const subscribeNever = () => () => {};

function shareMode(): ShareMode {
  if (typeof navigator.share === "function") return "share";
  return typeof navigator.clipboard?.writeText === "function" ? "copy" : "none";
}

function subscribeHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}
const readHash = () => window.location.hash;

function motionPaused() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "paused"
  );
}

/** The tip in full: its words, then its call-for-help sentence or its phone line where it has one. */
function tipWords(tip: HealthTip) {
  const phone = tip.phone && `${tip.phone.before} ${tip.phone.label} ${tip.phone.after}`;
  return [tip.text, tip.urgent, phone].filter(Boolean).join(" ");
}

/** Title, words and the sources' short labels. The one link in a shared tip is the tip's own. */
function shareText(tip: HealthTip) {
  const sources = tip.sources.map((s) => s.short ?? s.label).join("; ");
  return `${tip.title}\n${tipWords(tip)}\n${tip.sources.length > 1 ? "Sources" : "Source"}: ${sources}`;
}

/** Web Share where the browser has it, otherwise a copy. Returns the note to show, or null for none. */
async function shareTip(tip: HealthTip): Promise<ShareNote | null> {
  // The tip's own address: the deck shows whichever tip the hash names (see TipDeck).
  const url = `${window.location.origin}/#${tip.id}`;
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

const MINUTE_LABEL = { breathe: "Breathe with a guide", rest: "Use the 5-minute rest timer" } as const;

/**
 * A quiet way into Take a minute from the advice it matches. Markup only: the corner island opens the
 * tool for any [data-minute-open], the orb rises from this pearl, and focus comes back here on close.
 */
export function MinuteLauncher({ tool, className }: { tool: keyof typeof MINUTE_LABEL; className?: string }) {
  return (
    <button
      type="button"
      data-minute-open={tool}
      aria-haspopup="dialog"
      className={cn(
        "nv-habits-minute flex min-h-11 w-fit max-w-full items-center gap-2 rounded-full bg-white py-1.5 pr-3.5 pl-2 text-left text-sm/[1.25] font-semibold text-balance text-primary shadow-xs ring-1 ring-border-strong ring-inset focus-ring transition-[background-color,scale] duration-180 hover:bg-aqua/50 active:scale-[0.97] active:bg-aqua active:duration-90 motion-reduce:active:scale-100 forced-colors:border forced-colors:border-[ButtonText] sm:gap-2.5 sm:pr-4 sm:pl-2.5 sm:text-[0.9375rem]",
        className,
      )}
    >
      <Pearl size={22} />
      {MINUTE_LABEL[tool]}
    </button>
  );
}

/** The card's sources, with their short labels ("All sources" keeps the full ones). */
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
    <p className={cn("text-sm text-pretty text-ink-3", className)} style={style}>
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
 * auto-advances. A link to one tip (/#tip-salt, which is what Share sends) shows that tip: the page
 * can't know the hash when it renders, so the deck switches to it once it is running. The card fits
 * the tip it shows; the arrows sit in the header, above anything whose height changes, so the control
 * being tapped never moves. A text-only polite status names each new tip and confirms a copy (the tip
 * itself is not a live region, so modals can hide it).
 */
export function TipDeck({
  tips,
  todayIndex,
  dateLabel,
  className,
}: {
  tips: readonly HealthTip[];
  /** The tip of the day: the deck opens on it, and only it carries that name and the date. */
  todayIndex: number;
  dateLabel: string;
  className?: string;
}) {
  const [index, setIndex] = useState(todayIndex);
  const [dir, setDir] = useState<1 | -1>(1);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState<{ text: ShareNote; at: number } | null>(null);
  /** The polite status: set by a step or a copy only, so the note running out never re-announces the tip. */
  const [status, setStatus] = useState("");
  const titleId = useId();
  const mode = useSyncExternalStore(subscribeNever, shareMode, (): ShareMode => "share");
  const cardRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swipedAt = useRef(Number.NEGATIVE_INFINITY);
  /** Where the block under the card sat when a step began (null: nothing to glide from). */
  const stepFrom = useRef<number | null>(null);

  // A tip's link. The hash is read once the deck runs and again whenever it changes; each new hash is
  // acted on once, so stepping away from a linked tip is never undone.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [seenHash, setSeenHash] = useState("");
  if (hash !== seenHash) {
    setSeenHash(hash);
    const linked = tips.findIndex((t) => `#${t.id}` === hash);
    if (linked >= 0 && linked !== index) {
      setIndex(linked);
      setNote(null);
    }
  }

  const tip = tips[index];
  const isToday = index === todayIndex;
  const count = tips.length;

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), NOTE_MS);
    return () => window.clearTimeout(t);
  }, [note]);

  // A step changes the card's height, and everything under it would jump. On phones the next block down
  // (and all that follows it) starts from where it was and glides to its new place: a transform, so no
  // layout is animated. Beside the card (from md) that block doesn't move, and nothing happens.
  useLayoutEffect(() => {
    const from = stepFrom.current;
    stepFrom.current = null;
    const card = cardRef.current;
    const grid = card?.parentElement;
    const below = nextShown(card);
    if (from === null || !grid || !below) return;
    grid.removeAttribute("data-tip-glide");
    const shift = from - below.getBoundingClientRect().top;
    if (Math.abs(shift) < 1) return;
    grid.style.setProperty("--nv-habits-tip-shift", `${shift}px`);
    grid.setAttribute("data-tip-glide", "from");
    below.getBoundingClientRect(); // the start pose has to be styled before the glide can leave it
    grid.setAttribute("data-tip-glide", "to");
    const done = window.setTimeout(() => grid.removeAttribute("data-tip-glide"), GLIDE_MS);
    return () => window.clearTimeout(done);
  }, [index]);

  const go = (step: 1 | -1) => {
    const next = (index + step + count) % count;
    const below = nextShown(cardRef.current);
    stepFrom.current = below && !motionPaused() ? below.getBoundingClientRect().top : null;
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
  // A swipe that ends on a link or a button must not open it.
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
  const ShareIcon = mode === "copy" ? Copy : Share;

  return (
    <article
      ref={cardRef}
      id="tip"
      aria-labelledby={titleId}
      className={cn(
        "nv-habits-tip relative flex flex-col rounded-3xl bg-card p-4 shadow-[0_18px_40px_-32px_rgb(1_43_54/0.45)] ring-1 ring-ink/6 sm:p-8",
        className,
      )}
    >
      {/* Where each tip's link lands: the browser scrolls here by itself, before the deck is running. */}
      {tips.map((t) => (
        <span key={t.id} id={t.id} className="nv-habits-tip-anchor" />
      ))}

      {/* Header (health-tips.css): what this is, then the pager. Phones give the date and the counter a
          line of their own under the chip and the arrows; only one of the two counters is ever displayed. */}
      <div className="nv-habits-tip-head">
        <p className="nv-habits-tip-chip rounded-full bg-aqua px-3 py-1 text-sm font-semibold whitespace-nowrap text-primary">
          {isToday ? "Tip of the day" : "Health tip"}
        </p>
        <p className="nv-habits-tip-meta flex items-baseline gap-3 text-sm/[1.35] whitespace-nowrap text-ink-3">
          {isToday && <span className="font-medium">{dateLabel}</span>}
          <span className="ml-auto font-semibold tabular-nums sm:hidden">{counter}</span>
        </p>
        <div className="nv-habits-tip-pager flex items-center gap-2">
          <span className="min-w-14 text-center text-sm font-semibold whitespace-nowrap text-ink-3 tabular-nums max-sm:hidden">
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
            {/* When to call for help: the tip's own last sentence, apart from the advice so it is not
                missed. The numbers stay plain text here; the call buttons are in the note below the deck. */}
            {tip.urgent && (
              <p className="mt-3 flex max-w-[34rem] items-start gap-2.5 text-small/[1.5] text-pretty text-ink sm:text-body">
                <PhoneCall aria-hidden className="mt-[0.1875rem] size-4 shrink-0 text-danger sm:mt-1.5" strokeWidth={2.25} />
                <span>{tip.urgent}</span>
              </p>
            )}
            {tip.phone && (
              <p className="mt-2 max-w-[34rem] text-small/[1.5] text-pretty text-ink-2 sm:text-body">
                {tip.phone.before}{" "}
                <a
                  href={`tel:${tip.phone.tel}`}
                  className="relative rounded-sm font-semibold whitespace-nowrap text-ink tabular-nums underline decoration-current/40 underline-offset-[3px] transition-colors duration-180 before:absolute before:-inset-x-2 before:-inset-y-3 hover:decoration-current focus-ring active:bg-aqua/60 active:duration-90"
                >
                  {tip.phone.label}
                </a>{" "}
                {tip.phone.after}
              </p>
            )}
            {tip.minute && <MinuteLauncher tool={tip.minute} className="mt-3.5 sm:mt-5" />}
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
        {mode !== "none" && (
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
                  <ShareIcon className={cn(note && "invisible")} />
                  <Check className={cn(!note && "invisible")} strokeWidth={2.5} />
                </span>
                <span className="grid [&>*]:[grid-area:1/1] max-[22.5rem]:sr-only">
                  {/* The label says what the button does here: a phone shares, a desktop browser copies. */}
                  <span className={cn(note && "invisible")}>{mode === "copy" ? "Copy tip" : "Share tip"}</span>
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
