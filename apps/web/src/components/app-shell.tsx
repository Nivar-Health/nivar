"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, CircleHelp, ClipboardList, House, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/user-menu";
import { useNotifications } from "@/lib/socket";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/book", label: "Book", icon: CalendarPlus },
  { href: "/app/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/app/profile", label: "Profile", icon: UserRound },
] as const;

/** Picks the most specific nav href that matches the current path. */
export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

/**
 * A ref for a fixed bar: tells the browser how much of the window the bar covers, so a field reached
 * with Tab is never left underneath it. A bar that is hidden (display: none) or back in the page's
 * flow covers nothing.
 */
export function useScrollPadding(edge: "top" | "bottom") {
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const root = document.documentElement.style;
      const prop = edge === "top" ? "scrollPaddingTop" : "scrollPaddingBottom";
      const set = () => {
        const r = el.getBoundingClientRect();
        const pinned = ["fixed", "sticky"].includes(getComputedStyle(el).position);
        const covered = !pinned || r.height === 0 ? 0 : edge === "top" ? r.bottom : window.innerHeight - r.top;
        root[prop] = covered > 0 ? `${Math.ceil(covered) + 8}px` : "";
      };
      set();
      const observer = new ResizeObserver(set);
      observer.observe(el);
      window.addEventListener("resize", set);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", set);
        root[prop] = "";
      };
    },
    [edge],
  );
}

/**
 * Patient shell. Mobile: top bar + bottom tab bar. Desktop: top bar with
 * inline nav and a centred content column.
 *
 * Booking is one focused task with a bar of its own (price and Continue), so on phones the tab bar
 * steps aside there: one bar at the bottom, and no way out under the thumb beside Continue.
 *
 * The header and the tab bar are direct children of the root on purpose: the report's print styles
 * find them there. `print:hidden` keeps them off paper as well.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = activeHref(
    pathname,
    TABS.map((t) => t.href),
  );
  const booking = active === "/app/book";
  useNotifications();
  const headerRef = useScrollPadding("top");
  const tabBarRef = useScrollPadding("bottom");

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-card focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-sm focus-visible:font-semibold focus-visible:shadow-lift focus-ring"
      >
        Skip to content
      </a>
      <header ref={headerRef} className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70 print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 md:h-16 md:px-6">
          <Link href="/app" aria-label="Nivar, home" className="flex h-11 items-center rounded-md focus-ring">
            <Logo size="sm" />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {TABS.map((tab) => {
              const isActive = active === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    isActive
                      ? "bg-accent font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-4" aria-hidden />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <UserMenu
            links={[
              { href: "/app/profile", label: "Profile", icon: <UserRound /> },
              { href: "/app/bookings", label: "My bookings", icon: <ClipboardList /> },
              { href: "/app/profile#help", label: "Help", icon: <CircleHelp /> },
            ]}
          />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-2xl flex-1 px-4 pt-5 outline-none md:px-6 md:pt-8 md:pb-16",
          booking ? "pb-[calc(1.5rem+env(safe-area-inset-bottom))]" : "pb-[calc(6rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </main>

      {!booking && (
        <nav
          ref={tabBarRef}
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 pb-safe backdrop-blur-md md:hidden print:hidden"
        >
          <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
            {TABS.map((tab) => {
              const isActive = active === tab.href;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset",
                      isActive ? "font-semibold text-primary" : "font-medium text-muted-foreground active:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-7 w-14 place-items-center rounded-full transition-colors",
                        isActive && "bg-accent",
                      )}
                    >
                      <tab.icon className="size-5" strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                    </span>
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
