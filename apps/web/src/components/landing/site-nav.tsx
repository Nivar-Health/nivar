"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Logo } from "@/components/brand/logo";
import { bookingEnabled } from "@/lib/features";
import { SITE } from "@/lib/site-facts";
import { BottomBar, modified } from "./bottom-bar";
import { useChromeSignals } from "./chrome-signals";
import { focusLanding, keepRouterState, replaceHash } from "./page-history";
import { buttonClass } from "./primitives";
import { openTakeAMinute, prefetchTakeAMinute } from "./take-a-minute/open";
import { Pearl } from "./take-a-minute/pearl";
import "./site-nav.css";

type Item = { id: string; label: string };

const LINKS: readonly Item[] = [
  { id: "services", label: "Services" },
  { id: "how-it-works", label: "How it works" },
  { id: "nurses", label: "Your nurse" },
  { id: "check-ups", label: "Check-ups" },
  { id: "faq", label: "FAQ" },
];

/** The sheet has room for every section a visitor looks for, so Compare and Health tips get their own rows. */
const SHEET_LINKS: readonly Item[] = [
  { id: "services", label: "Services" },
  { id: "how-it-works", label: "How it works" },
  { id: "nurses", label: "Your nurse" },
  { id: "compare", label: "Compare" },
  { id: "check-ups", label: "Check-ups" },
  { id: "health-tips", label: "Health tips" },
  { id: "faq", label: "FAQ" },
];

/** The desktop link each section marks. Compare is the second half of "Your nurse"; the hero, Small habits and the form mark none. */
const LINK_FOR: Readonly<Record<string, string>> = {
  services: "services",
  "how-it-works": "how-it-works",
  nurses: "nurses",
  compare: "nurses",
  "check-ups": "check-ups",
  faq: "faq",
};

/** Input that means the visitor has taken the scroll back. */
const TAKEOVER = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** A jump longer than this many screen heights arrives most of the way at once, then glides. */
const LONG = 1.5;

/**
 * Marks `id` and holds it while the page glides past the sections between. `onSettled` runs once, at
 * the first of: a scrollend for which `arrived()` holds, 250ms without a scroll, or the 2.5s cap. It is
 * skipped when the visitor takes over: they have moved on, and focus stays where they put it.
 */
type Hold = (id: string, onSettled?: () => void, arrived?: () => boolean) => void;

/**
 * The section crossing a thin band 40–45% down the screen, or null, and `jumpTo` for the bar and the
 * sheet. One IntersectionObserver over `main > section[id]`, collected again if main's children
 * change. An in-page link marks its section at once and holds it while the page glides past the ones
 * between, so the mark goes straight there.
 */
function useCurrentSection(): { current: string | null; jumpTo: (hash: `#${string}`) => boolean } {
  const [current, setCurrent] = useState<string | null>(null);
  const holdRef = useRef<Hold>(() => {});

  useEffect(() => {
    keepRouterState();
    const main = document.getElementById("main");
    if (!main || typeof IntersectionObserver === "undefined") return;
    let sections: HTMLElement[] = [];
    const inBand = new Set<Element>();
    const pick = () => sections.find((s) => inBand.has(s))?.id ?? null;
    // The same band, measured now: when a hold ends right after an instant jump, the observer has not
    // reported the new place yet.
    const pickNow = () => {
      const top = window.innerHeight * 0.4;
      const bottom = window.innerHeight * 0.45;
      return (
        sections.find((s) => {
          const r = s.getBoundingClientRect();
          return r.top < bottom && r.bottom > top;
        })?.id ?? null
      );
    };
    let held = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.add(e.target);
          else inBand.delete(e.target);
        }
        if (!held) setCurrent(pick());
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    const collect = () => {
      io.disconnect();
      inBand.clear();
      sections = Array.from(main.querySelectorAll<HTMLElement>(":scope > section[id]"));
      sections.forEach((s) => io.observe(s));
    };
    collect();
    const mo = new MutationObserver(collect);
    mo.observe(main, { childList: true });

    let stopHold: (() => void) | null = null;
    const hold: Hold = (id, onSettled, arrived) => {
      stopHold?.();
      held = true;
      setCurrent(id);
      let idle = 0;
      let cap = 0;
      const stop = () => {
        held = false;
        stopHold = null;
        window.clearTimeout(idle);
        window.clearTimeout(cap);
        window.removeEventListener("scroll", settle);
        window.removeEventListener("scrollend", onScrollEnd);
        TAKEOVER.forEach((type) => window.removeEventListener(type, takeOver, true));
      };
      const takeOver = () => {
        stop();
        setCurrent(pickNow());
      };
      const end = () => {
        takeOver();
        onSettled?.();
      };
      // Chrome fires a scrollend just after the instant hop of a long jump, before the glide ends.
      const onScrollEnd = () => {
        if (arrived?.() ?? true) end();
      };
      // Without scrollend (or with nothing to scroll), let go once the page has been still a moment.
      const settle = () => {
        window.clearTimeout(idle);
        idle = window.setTimeout(end, 250);
      };
      settle();
      cap = window.setTimeout(end, 2500);
      window.addEventListener("scroll", settle, { passive: true });
      window.addEventListener("scrollend", onScrollEnd);
      TAKEOVER.forEach((type) => window.addEventListener(type, takeOver, { capture: true, passive: true }));
      stopHold = stop;
    };
    holdRef.current = hold;

    // Any other plain click on an in-page link: the logo, the desktop links, a card's call to action.
    // The bar and the sheet jump themselves (preventDefault), so they are skipped here.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || modified(e) || !(e.target instanceof Element)) return;
      const link = e.target.closest<HTMLAnchorElement>('a[href^="#"]');
      const target = link && link.hash.length > 1 ? document.getElementById(link.hash.slice(1)) : null;
      const section = target?.closest<HTMLElement>("main > section[id]");
      if (section && sections.includes(section)) hold(section.id);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      stopHold?.();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  /**
   * The bar's and the sheet's jump: replaces the hash (Back still leaves the page), holds the mark,
   * and focuses the landing's heading once the scroll settles. False when the target is missing.
   */
  const jumpTo = useCallback((hash: `#${string}`): boolean => {
    const target = document.getElementById(hash.slice(1));
    if (!target) return false;
    const section = target.closest<HTMLElement>("main > section[id]");
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const settled = () => focusLanding(target);
    // Arrived: the target rests at its scroll margin, or the page can scroll no further towards it.
    const arrived = () => {
      const off = target.getBoundingClientRect().top - margin;
      if (Math.abs(off) < 2) return true;
      return off > 0
        ? Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight
        : scrollY <= 0;
    };
    if (section) holdRef.current(section.id, settled, arrived);
    replaceHash(hash);
    const reduce =
      matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "paused";
    const top = target.getBoundingClientRect().top;
    if (!reduce && Math.abs(top) > innerHeight * LONG) {
      // A long trip: arrive most of the way at once, then glide the last 120px, so the page never
      // streams every section, reveal and live trace past on a mid-range phone.
      const y = scrollY + top - margin;
      scrollTo({ top: top > 0 ? y - 120 : y + 120, behavior: "instant" });
      requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "smooth" }));
    } else {
      // CSS scroll-behavior glides a short trip; reduced motion and the visitor's pause jump at once.
      target.scrollIntoView(reduce ? { block: "start", behavior: "instant" } : { block: "start" });
    }
    if (!section) requestAnimationFrame(settled);
    return true;
  }, []);

  return { current, jumpTo };
}

/** The links' inline padding: the bar spans the label, not the pill. */
const LINK_PAD = 14;

/**
 * Moves the one indicator under `id`'s link, or fades it out. Coming back from hidden, or after a
 * resize, it jumps into place instead of sliding from where it was.
 */
function placeIndicator(nav: HTMLElement, bar: HTMLElement, id: string | null, jump: boolean) {
  const link = id ? nav.querySelector<HTMLElement>(`a[href="#${id}"]`) : null;
  if (!link || !link.offsetWidth) {
    bar.removeAttribute("data-on");
    return;
  }
  const snap = jump || !bar.hasAttribute("data-on");
  if (snap) bar.setAttribute("data-jump", "");
  bar.style.setProperty("--x", `${link.offsetLeft + LINK_PAD}px`);
  bar.style.setProperty("--s", String(Math.max(link.offsetWidth - LINK_PAD * 2, 0) / 100));
  bar.setAttribute("data-on", "");
  if (snap) {
    bar.getBoundingClientRect(); // commit the new place before transitions come back
    bar.removeAttribute("data-jump");
  }
}

function DesktopLinks({ active }: { active: string | null }) {
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(active);

  useLayoutEffect(() => {
    activeRef.current = active;
    if (navRef.current && barRef.current) placeIndicator(navRef.current, barRef.current, active, false);
  }, [active]);

  // Fonts arriving, the window resizing or the links first showing at lg move them: follow without sliding.
  useEffect(() => {
    const nav = navRef.current;
    const bar = barRef.current;
    if (!nav || !bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => placeIndicator(nav, bar, activeRef.current, true));
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  return (
    <nav ref={navRef} aria-label="Primary" className="relative hidden justify-self-center lg:block">
      <ul className="flex items-center gap-2">
        {LINKS.map((l) => (
          <li key={l.id}>
            <a
              href={`#${l.id}`}
              aria-current={active === l.id ? "location" : undefined}
              className="nv-nav-link focus-ring"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <span ref={barRef} aria-hidden className="nv-nav-ind" />
    </nav>
  );
}

/**
 * Mounts the chrome signals store (chrome-signals.ts), which writes the zone, hero-CTA and typing
 * attributes on <html> that the pill, the bar and the corner follow in CSS. A leaf of its own, so a
 * zone change re-renders nothing visible.
 */
function ChromeSignalsStore() {
  useChromeSignals();
  return null;
}

type Pending = { kind: "section"; hash: `#${string}` } | { kind: "minute" };

const MENU_MARK = "nvMenu";

/** The current history entry is the one the open sheet pushed. */
function isMenuEntry(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[MENU_MARK] === 1;
}

/**
 * The fixed chrome: a floating pill with in-page links (lg), Log in while booking is live, and the one
 * accent action; below lg a menu button opens a sheet with every section, Take a minute and the
 * callback; below 640px a bottom bar (bottom-bar.tsx) whose Menu opens the same sheet. Which of the
 * pill, its action and the bar shows is CSS on the chrome signals. Links are plain `#id` anchors, so
 * they work without JS and keep any query string.
 */
export function SiteNav() {
  const { current, jumpTo } = useCurrentSection();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The trigger that opened the sheet (the pill's menu button or the bar's Menu tab): focus returns to
  // it, and Take a minute's orb rises from it.
  const openerRef = useRef<HTMLElement | null>(null);
  const landingRef = useRef<HTMLElement | null>(null);
  // The sheet locks page scroll and restores it on close, which would undo a jump made while it is
  // open. So a choice closes it first; the jump (or Take a minute) happens once it has closed.
  const pending = useRef<Pending | null>(null);
  // Back closes the sheet, as it closes Take a minute: opening pushes one entry (no URL; Next copies
  // its own state into it), and a close from the sheet's UI steps back over it. This settles once
  // that step has landed.
  const stepBack = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // Portal into the landing root, so the sheet and its dim resolve the teal tokens.
    landingRef.current = headerRef.current?.closest<HTMLElement>("[data-landing]") ?? null;
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Closes the sheet from its own UI, stepping back over its history entry. */
  const close = useCallback(() => {
    setOpen(false);
    if (!isMenuEntry()) return;
    stepBack.current = new Promise<void>((resolve) => {
      let fallback = 0;
      const landed = () => {
        window.removeEventListener("popstate", landed);
        window.clearTimeout(fallback);
        resolve();
      };
      window.addEventListener("popstate", landed);
      fallback = window.setTimeout(landed, 1000);
    });
    window.history.back();
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const onPop = () => {
      if (!isMenuEntry()) setOpen(false);
    };
    // A close that is still stepping back over the previous entry lands first.
    void stepBack.current.then(() => {
      if (!live) return;
      if (!isMenuEntry()) {
        try {
          window.history.pushState({ [MENU_MARK]: 1 }, "");
        } catch {
          // A sandboxed frame can refuse history writes; Back then simply leaves the page as before.
        }
      }
      window.addEventListener("popstate", onPop);
    });
    return () => {
      live = false;
      window.removeEventListener("popstate", onPop);
    };
  }, [open]);

  // At lg the menu button goes away, so an open sheet closes.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (wide.matches) close();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open, close]);

  const choose = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const { hash } = e.currentTarget;
    if (!hash) return;
    e.preventDefault();
    pending.current = { kind: "section", hash: hash as `#${string}` };
    close();
  };

  const takeAMinute = () => {
    pending.current = { kind: "minute" };
    close();
  };

  // Log in leaves through the sheet's own entry, so Back from it returns to this page, not to a
  // closed sheet. A new-tab click leaves the sheet as it is.
  const logIn = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (modified(e)) return;
    if (isMenuEntry()) {
      e.preventDefault();
      router.replace("/login");
    }
    setOpen(false);
  };

  const afterClose = (isOpen: boolean) => {
    const next = pending.current;
    if (isOpen || !next) return;
    pending.current = null;
    // Only once the step back has landed: it would undo a jump made before it, and Take a minute's
    // own history entry must come after it.
    void stepBack.current.then(() => {
      if (next.kind === "minute") {
        openTakeAMinute("", openerRef.current);
        return;
      }
      // The scroll lock lets go in the same tick that reports the close as complete.
      requestAnimationFrame(() => {
        if (!jumpTo(next.hash)) openerRef.current?.focus();
      });
    });
  };

  const desktopActive = current ? (LINK_FOR[current] ?? null) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, d) => {
        if (next) {
          openerRef.current = d.trigger instanceof HTMLElement ? d.trigger : triggerRef.current;
          setOpen(true);
        } else close();
      }}
      onOpenChangeComplete={afterClose}
    >
      <header ref={headerRef} className="nv-nav" data-scrolled={scrolled ? "" : undefined}>
        {/* The links sit at the pill's true centre from xl; at lg the three groups simply spread out. */}
        <div className="nv-nav-bar mx-auto flex h-16 max-w-[1220px] items-center justify-between gap-2 pr-2 pl-5 xl:grid xl:grid-cols-[1fr_auto_1fr]">
          <a
            href="#top"
            aria-label="Nivar home"
            className="nv-nav-logo -mx-1 -my-2 inline-flex h-11 min-w-11 items-center justify-start justify-self-start overflow-hidden rounded-full px-1 py-2 focus-ring"
          >
            <Logo size="sm" />
          </a>

          <DesktopLinks active={desktopActive} />

          <div className="flex items-center gap-2 justify-self-end">
            {bookingEnabled && (
              <Link href="/login" className={buttonClass("ghost", "hidden hover:bg-aqua/70 sm:inline-flex", "sm")}>
                Log in
              </Link>
            )}
            {/* On phones it shows only while the hero's own button is below the fold; at the form and
                the footer it fades at every width (site-nav.css). Its box always stays. */}
            <a href="#callback" className={buttonClass("accent", "nv-nav-cta", "sm")}>
              Request a callback
            </a>

            <Dialog.Trigger ref={triggerRef} aria-label="Open menu" className="nv-nav-menu focus-ring lg:hidden">
              <Menu aria-hidden />
            </Dialog.Trigger>
          </div>
        </div>
      </header>

      <Dialog.Portal container={landingRef}>
        <Dialog.Backdrop className="nv-nav-dim" />
        <Dialog.Popup
          ref={popupRef}
          data-landing=""
          aria-modal="true"
          className="nv-nav-sheet"
          // A tap focuses the sheet itself (no keyboard, no ring); a key or click lands on Close, where
          // the menu button was.
          initialFocus={(type) => (type === "touch" ? popupRef.current : closeRef.current)}
          finalFocus={() => pending.current?.kind !== "section"}
        >
          <div className="nv-nav-sheet-head">
            <div className="flex h-16 items-center justify-between pr-2 pl-5">
              <a
                href="#top"
                aria-label="Nivar home"
                onClick={choose}
                className="nv-nav-logo -mx-1 -my-2 inline-flex h-11 min-w-11 items-center justify-start overflow-hidden rounded-full px-1 py-2 focus-ring"
              >
                <Logo size="sm" />
              </a>
              <Dialog.Close ref={closeRef} aria-label="Close menu" className="nv-nav-menu focus-ring">
                <X aria-hidden />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            The sections of this page, Take a minute and the callback form.
          </Dialog.Description>

          <nav aria-label="Sections">
            <ul className="nv-nav-rows">
              {SHEET_LINKS.map((l, i) => (
                <li key={l.id} className="nv-nav-stagger" style={{ "--i": i } as CSSProperties}>
                  <a
                    href={`#${l.id}`}
                    onClick={choose}
                    aria-current={current === l.id ? "location" : undefined}
                    className="nv-nav-row focus-ring"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="nv-nav-dock nv-nav-stagger" style={{ "--i": SHEET_LINKS.length } as CSSProperties}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={takeAMinute}
              onPointerDown={prefetchQuietly}
              onFocus={prefetchQuietly}
              className={buttonClass("secondary", "w-full", "lg")}
            >
              <Pearl size={20} />
              Take a minute
            </button>
            <a href="#callback" onClick={choose} className={buttonClass("accent", "h-14 w-full text-[1.0625rem]", "lg")}>
              Request a callback
            </a>
            {bookingEnabled && (
              <Link href="/login" onClick={logIn} className={buttonClass("ghost", "w-full hover:bg-white/60", "md")}>
                Log in
              </Link>
            )}
            {/* On phones a second Close sits under the thumb, below where the bar's Menu tab is. */}
            <div className="nv-nav-dock-end">
              <p className="px-1 text-caption text-pretty text-ink-3">{SITE.emergency.short}</p>
              <Dialog.Close aria-label="Close menu" className="nv-nav-close focus-ring">
                <X aria-hidden />
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>

      <BottomBar current={current} jumpTo={jumpTo} />
      <ChromeSignalsStore />
    </Dialog.Root>
  );
}

function prefetchQuietly() {
  prefetchTakeAMinute().catch(() => {});
}
