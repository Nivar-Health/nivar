"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Menu, Phone, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { bookingEnabled } from "@/lib/features";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { ButtonLink, CALLBACK_HREF, buttonClass } from "./primitives";

const LINKS = [
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/why-nivar", label: "Why Nivar Health?" },
  { href: "/#faq", label: "FAQ" },
];

const SHEET_LINK = "border-b border-border py-4 text-h4 text-foreground focus-ring";

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  // The sheet locks page scroll and restores it on close, which undoes a jump to an anchor made
  // while it is open. Links to an anchor on this page close the sheet first and scroll once it has
  // finished closing; links to another page just close it.
  const pendingAnchor = useRef<string | null>(null);

  const closeAndScroll = (e: MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute("href") ?? "";
    const [path, hash] = href.split("#");
    if (hash && (path === "" || path === pathname)) {
      e.preventDefault();
      pendingAnchor.current = `#${hash}`;
    }
    setOpen(false);
  };

  const scrollToPendingAnchor = (isOpen: boolean) => {
    const href = pendingAnchor.current;
    if (isOpen || !href) return;
    pendingAnchor.current = null;
    history.pushState(null, "", href);
    // The scroll lock releases in the same tick that reports the close as complete.
    requestAnimationFrame(() => document.getElementById(href.slice(1))?.scrollIntoView());
  };

  /** The page a link points to is the one on screen (anchors on the home page never count). */
  const isCurrent = (href: string) => !href.includes("#") && pathname === href;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={cn(
          "mx-auto flex h-16 max-w-[1220px] items-center justify-between gap-4 rounded-full border pr-2 pl-5 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-calm",
          scrolled
            ? "border-border bg-white/90 shadow-[0_12px_32px_-18px_rgb(1_43_54/0.35)]"
            : "border-white/70 bg-white/60 shadow-[0_8px_24px_-20px_rgb(1_43_54/0.3)]",
        )}
      >
        <Link href="/" className="-m-1 rounded-full p-1 focus-ring" aria-label="Nivar home">
          <Logo size="sm" />
        </Link>

        {/* lg, not md: at 768 the four links, Log in and the CTA do not fit on one line. */}
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isCurrent(l.href) ? "page" : undefined}
                  className="nav-link flex h-10 items-center rounded-full px-3.5 text-[0.9375rem] font-medium whitespace-nowrap text-foreground-2 transition-colors hover:bg-aqua/70 hover:text-foreground focus-ring aria-[current=page]:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          {SITE.phone && (
            <a href={`tel:${SITE.phone.tel}`} className={buttonClass("ghost", "hidden lg:inline-flex", "sm")}>
              <Phone aria-hidden />
              {SITE.phone.display}
            </a>
          )}
          {bookingEnabled && (
            <Link href="/login" className={buttonClass("ghost", "hidden hover:bg-aqua/70 sm:inline-flex", "sm")}>
              Log in
            </Link>
          )}
          <ButtonLink href={CALLBACK_HREF} variant="accent" size="sm">
            Request a callback
          </ButtonLink>

          <Sheet open={open} onOpenChange={setOpen} onOpenChangeComplete={scrollToPendingAnchor}>
            <SheetTrigger
              aria-label="Open menu"
              className={buttonClass("ghost", "size-11 px-0 hover:bg-aqua lg:hidden [&_svg]:size-5")}
            >
              <Menu aria-hidden />
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-full gap-0 bg-background data-[side=right]:w-full sm:max-w-sm"
            >
              <div className="flex h-16 items-center justify-between border-b border-border pr-3 pl-6">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <Logo size="sm" />
                <SheetClose aria-label="Close menu" className={buttonClass("ghost", "size-11 px-0 [&_svg]:size-5")}>
                  <X aria-hidden />
                </SheetClose>
              </div>
              {/* Plain links (not SheetClose renders, which add role="button"): they close the sheet themselves. */}
              <nav aria-label="Mobile" className="flex flex-col px-6">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={closeAndScroll}
                    aria-current={isCurrent(l.href) ? "page" : undefined}
                    className={SHEET_LINK}
                  >
                    {l.label}
                  </Link>
                ))}
                {bookingEnabled && (
                  <Link href="/login" onClick={() => setOpen(false)} className={SHEET_LINK}>
                    Log in
                  </Link>
                )}
              </nav>
              <div className="mt-auto flex flex-col gap-4 p-6">
                <ButtonLink href={CALLBACK_HREF} variant="accent" size="lg" className="w-full" onClick={closeAndScroll}>
                  Request a callback
                </ButtonLink>
                {SITE.phone && (
                  <a href={`tel:${SITE.phone.tel}`} className={buttonClass("secondary", "w-full", "lg")}>
                    <Phone aria-hidden />
                    Call {SITE.phone.display}
                  </a>
                )}
                <p className="text-caption text-muted-foreground">{SITE.emergency.short}</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
