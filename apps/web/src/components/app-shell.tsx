"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, ClipboardList, House, UserRound } from "lucide-react";
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
 * Patient shell. Mobile: top bar + bottom tab bar. Desktop: top bar with
 * inline nav and a centred content column.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = activeHref(
    pathname,
    TABS.map((t) => t.href),
  );
  useNotifications();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 md:h-16 md:px-6">
          <Link href="/app" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
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
                    "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
            ]}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:pt-8 md:pb-16">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 pb-safe shadow-[0_-8px_24px_-16px_rgb(19_35_33/0.18)] backdrop-blur-md md:hidden"
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
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors outline-none",
                    isActive ? "text-primary" : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-12 place-items-center rounded-full transition-colors",
                      isActive && "bg-secondary",
                    )}
                  >
                    <tab.icon className="size-[18px]" strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
