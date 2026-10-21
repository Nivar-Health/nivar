"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import "./snap-row.css";

export type SnapRowProps = {
  /** Names the row (its region while it scrolls, else its list) and its buttons, e.g. "Health check-up packages". */
  label: string;
  children: ReactNode[];
  /** Item width on the row, e.g. "basis-[85%] sm:basis-[46%]". Chip rows leave it out (auto width). */
  itemClassName?: string;
  /** From this breakpoint the row is a plain grid, with no cue or buttons. Default "never". */
  gridFrom?: "sm" | "md" | "lg" | "never";
  /** Grid columns and gap once it is a grid, e.g. "sm:grid-cols-2 lg:grid-cols-3". */
  gridClassName?: string;
  className?: string;
  /** "always" on card rows (one flick moves one card), "normal" on chip rows. Default "always". */
  snapStop?: "always" | "normal";
};

const GRID_QUERY = { sm: "(min-width: 40rem)", md: "(min-width: 48rem)", lg: "(min-width: 64rem)" } as const;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
/** The edge fade's width (--nv-snap-fade, 2rem in snap-row.css). */
const FADE_PX = 32;

/** `index` is the item snapped to the start; `last` the last one wholly in view (more than one on wide rows). */
type Position = { index: number; last: number; scrolled: boolean; atEnd: boolean; fits: boolean };
const START: Position = { index: 0, last: 0, scrolled: false, atEnd: false, fits: false };

function motionPaused() {
  return window.matchMedia(REDUCED_QUERY).matches || document.documentElement.dataset.motion === "paused";
}

/** Whether `query` matches, for behaviour only (layout stays CSS). False on the server and when null. */
function useMatches(query: string | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!query) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (query ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Offset of each item from the first, i.e. the scrollLeft that snaps it to the start. */
function snapPoints(list: HTMLElement): number[] {
  const items = Array.from(list.children) as HTMLElement[];
  const first = items[0]?.offsetLeft ?? 0;
  return items.map((item) => item.offsetLeft - first);
}

/**
 * A sideways row that snaps card by card on phones and, from `gridFrom`, turns into a plain grid.
 * While it scrolls it is a named region, focusable for arrow-key scrolling, and keyboard focus inside
 * brings its card fully into view. Edges fade while there is more to see; phones get a
 * dot row, and from sm previous and next buttons with a "2 / 4" cue ("2–3 / 4" while two cards are in
 * view). On its first reveal the items slide in once from the right (never under reduced motion or
 * html[data-motion="paused"]).
 *
 * It bleeds 20px into the parent's inline padding, so place it inside `Container` (or ≥ 20px of
 * padding). Don't wrap it in revealProps: it has its own entrance.
 */
export function SnapRow({
  label,
  children,
  itemClassName,
  gridFrom = "never",
  gridClassName,
  className,
  snapStop = "always",
}: SnapRowProps) {
  const items = Children.toArray(children);
  const count = items.length;
  const trackId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState<Position>(START);
  const isGrid = useMatches(gridFrom === "never" ? null : GRID_QUERY[gridFrom]);
  const scrollable = !isGrid && !pos.fits;

  // Position, edges and the cue, measured on scroll (once per frame) and on resize.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const max = scroller.scrollWidth - scroller.clientWidth;
      const x = scroller.scrollLeft;
      const fits = max <= 1;
      const atEnd = x >= max - 2;
      const scrolled = x > 2;
      const els = Array.from(list.children) as HTMLElement[];
      const points = snapPoints(list);
      let index = 0;
      let best = Infinity;
      points.forEach((p, i) => {
        const d = Math.abs(p - x);
        if (d < best) {
          best = d;
          index = i;
        }
      });
      // The snapport ends where it starts: the first item's offset is the 20px inset on both sides.
      const viewEnd = x + scroller.clientWidth - (els[0]?.offsetLeft ?? 0);
      let last = index;
      while (last + 1 < els.length && els[last + 1].offsetLeft + els[last + 1].offsetWidth <= viewEnd + 2) last++;
      setPos((prev) =>
        prev.index === index &&
        prev.last === last &&
        prev.scrolled === scrolled &&
        prev.atEnd === atEnd &&
        prev.fits === fits
          ? prev
          : { index, last, scrolled, atEnd, fits },
      );
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    ro?.observe(scroller);
    ro?.observe(list);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count]);

  // First reveal (mobile addendum M3): armed below the fold, played once when the row comes into view.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof IntersectionObserver === "undefined" || motionPaused()) return;
    if (wrap.getBoundingClientRect().top < window.innerHeight) return;
    let done = 0;
    wrap.dataset.reveal = "armed";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        wrap.dataset.reveal = "in";
        done = window.setTimeout(() => {
          delete wrap.dataset.reveal;
          // Measure again now the items are back in place.
          scrollerRef.current?.dispatchEvent(new Event("scroll"));
        }, 700 + 60 * Math.min(count, 8) + 100);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(wrap);
    return () => {
      io.disconnect();
      window.clearTimeout(done);
      delete wrap.dataset.reveal;
    };
  }, [count]);

  // Tabbing into a card the row hides (the browser leaves a mostly hidden one where it is): bring the
  // whole card in, clear of the edge fade. Keyboard focus only, so a click never moves its own target.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list || !scrollable) return;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el === scroller || !el.matches(":focus-visible")) return;
      const item = el.closest<HTMLElement>(".nv-snap-item");
      const first = list.firstElementChild;
      if (!item || !(first instanceof HTMLElement)) return;
      const box = scroller.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.left >= box.left && r.right <= box.right - FADE_PX) return;
      scroller.scrollTo({ left: item.offsetLeft - first.offsetLeft, behavior: motionPaused() ? "auto" : "smooth" });
    };
    scroller.addEventListener("focusin", onFocusIn);
    return () => scroller.removeEventListener("focusin", onFocusIn);
  }, [scrollable]);

  const step = (dir: -1 | 1) => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;
    const points = snapPoints(list);
    const last = points.length - 1;
    const next = Math.min(Math.max(pos.index + dir, 0), last);
    // The last step goes to the true end: a wide last item can snap short of it and leave Next stuck.
    const target = next === last ? scroller.scrollWidth - scroller.clientWidth : (points[next] ?? 0);
    scroller.scrollBy({ left: target - scroller.scrollLeft, behavior: motionPaused() ? "auto" : "smooth" });
  };

  const prevOff = !pos.scrolled;
  const nextOff = pos.atEnd;
  // At the end the last dot lights, even when a short last chip can't snap to the start.
  const dot = pos.atEnd && !pos.fits ? count - 1 : pos.index;
  const cue = pos.last > pos.index ? `${pos.index + 1}–${pos.last + 1} / ${count}` : `${pos.index + 1} / ${count}`;

  return (
    <div
      ref={wrapRef}
      className={cn("nv-snap-wrap", className)}
      data-grid-from={gridFrom}
      data-fits={pos.fits ? "" : undefined}
    >
      {/* A named, focusable region only while it scrolls; as a grid, or when it all fits, the list carries the name. */}
      <div
        ref={scrollerRef}
        id={trackId}
        role={scrollable ? "region" : undefined}
        aria-label={scrollable ? label : undefined}
        tabIndex={scrollable ? 0 : undefined}
        className="nv-snap"
        data-snap-stop={snapStop}
        data-scrolled={pos.scrolled ? "" : undefined}
        data-at-end={pos.atEnd ? "" : undefined}
      >
        <ul
          ref={listRef}
          role="list"
          aria-label={scrollable ? undefined : label}
          className={cn("nv-snap-track", gridClassName)}
        >
          {items.map((child, i) => (
            <li
              key={isValidElement(child) && child.key != null ? child.key : i}
              className={cn("nv-snap-item", itemClassName)}
              style={{ "--nv-snap-i": Math.min(i, 8) } as CSSProperties}
            >
              {child}
            </li>
          ))}
        </ul>
      </div>
      {count > 1 && (
        <>
          <div aria-hidden className="nv-snap-dots">
            {items.map((_, i) => (
              <span key={i} data-active={i === dot ? "" : undefined} />
            ))}
          </div>
          <div className="nv-snap-ctrl">
            <button
              type="button"
              className="nv-snap-btn"
              aria-label={`Previous: ${label}`}
              aria-controls={trackId}
              aria-disabled={prevOff || undefined}
              onClick={() => !prevOff && step(-1)}
            >
              <ChevronLeft aria-hidden />
            </button>
            <button
              type="button"
              className="nv-snap-btn"
              aria-label={`Next: ${label}`}
              aria-controls={trackId}
              aria-disabled={nextOff || undefined}
              onClick={() => !nextOff && step(1)}
            >
              <ChevronRight aria-hidden />
            </button>
            <span aria-hidden className="nv-snap-cue">
              {cue}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
