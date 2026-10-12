"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { activeHref } from "@/components/app-shell";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar, UserMenu } from "@/components/user-menu";
import { useAuth } from "@/lib/auth";
import { useNotifications, useSocketConnected } from "@/lib/socket";
import { cn } from "@/lib/utils";

export interface StaffNavItem {
  href: string;
  label: string;
  /** A rendered icon element, e.g. <LayoutDashboard />. */
  icon: ReactNode;
}

function NavList({
  items,
  active,
  onNavigate,
}: {
  items: StaffNavItem[];
  active: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive = active === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group/nav relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:size-[18px] [&_svg]:shrink-0",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-primary transition-opacity",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <span className={cn(isActive ? "text-primary" : "text-muted-foreground group-hover/nav:text-foreground")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RealtimeStatus({ className }: { className?: string }) {
  const connected = useSocketConnected();
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {connected ? (
        <span className="live-dot size-1.5 text-success" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
      )}
      {connected ? "Live updates on" : "Connecting to live updates"}
    </div>
  );
}

function UserCard({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-card p-2.5 shadow-soft">
      <UserAvatar name={user.name} src={user.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-tight font-semibold">{user.name}</p>
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {user.specialization ?? user.email}
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              onClick={onSignOut}
              className="text-muted-foreground hover:text-destructive"
            />
          }
        >
          <LogOut />
        </TooltipTrigger>
        <TooltipContent side="top">Sign out</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Shell for nurse, doctor and admin.
 * Desktop: fixed sidebar with logo, role label, nav, live status and user card.
 * Mobile: top bar with a slide-in menu, or a bottom tab bar (`mobileNav="bottom"`).
 */
export function StaffShell({
  roleLabel,
  nav,
  children,
  mobileNav = "menu",
  width = "wide",
}: {
  roleLabel: string;
  nav: StaffNavItem[];
  children: ReactNode;
  mobileNav?: "menu" | "bottom";
  /** narrow: phone-first column (nurse), wide: dashboards, full: edge to edge workspaces. */
  width?: "narrow" | "wide" | "full";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = activeHref(
    pathname,
    nav.map((n) => n.href),
  );
  useNotifications();

  const signOut = () => {
    logout();
    router.replace("/staff/login");
  };

  const homeHref = nav[0]?.href ?? "/";
  const useBottomNav = mobileNav === "bottom" && nav.length > 1;
  const useMenu = !useBottomNav && nav.length > 1;

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <Link href={homeHref} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <Logo size="sm" />
          </Link>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-secondary-foreground uppercase">
            {roleLabel}
          </span>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pt-3">
          <NavList items={nav} active={active} />
        </nav>
        <div className="flex flex-col gap-3 p-3">
          <RealtimeStatus className="px-2" />
          {user && <UserCard onSignOut={signOut} />}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2">
              {useMenu && (
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger
                    render={<Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-1.5" />}
                  >
                    <Menu className="size-5" />
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <div className="flex h-14 items-center gap-2 px-4">
                      <Logo size="sm" />
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-secondary-foreground uppercase">
                        {roleLabel}
                      </span>
                    </div>
                    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pt-2">
                      <NavList items={nav} active={active} onNavigate={() => setMenuOpen(false)} />
                    </nav>
                    <div className="flex flex-col gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                      <RealtimeStatus className="px-2" />
                      {user && <UserCard onSignOut={signOut} />}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <Link href={homeHref} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                <Logo size="sm" />
              </Link>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-secondary-foreground uppercase">
                {roleLabel}
              </span>
            </div>
            <UserMenu />
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full flex-1 px-4 pt-5 md:px-6 md:pt-8 lg:px-8",
            width === "narrow" && "max-w-2xl",
            width === "wide" && "max-w-7xl",
            width === "full" && "max-w-none",
            useBottomNav ? "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12" : "pb-12",
          )}
        >
          {children}
        </main>

        {useBottomNav && (
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 pb-safe backdrop-blur-md lg:hidden"
          >
            <ul
              className="mx-auto grid h-16 max-w-md"
              style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
            >
              {nav.map((item) => {
                const isActive = active === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium [&_svg]:size-[18px]",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
