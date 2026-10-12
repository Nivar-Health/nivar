"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ButtonLink, Container, buttonClass } from "./primitives";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#what-we-test", label: "What we test" },
  { href: "#pricing", label: "Pricing" },
  { href: "#for-families", label: "For families" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-white transition-colors duration-200",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="-m-1 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Nivar home"
        >
          <Logo size="sm" />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-7">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-md text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden h-11 items-center rounded-full px-4 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
          >
            Log in
          </Link>
          <ButtonLink href="/app/book" className="h-10 px-4">
            Book a check-up
          </ButtonLink>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(buttonClass("ghost", "size-10 px-0 md:hidden"))}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
              <div className="border-b border-border p-6">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
                <Logo size="sm" />
              </div>
              <nav aria-label="Mobile" className="flex flex-col px-6">
                {LINKS.map((l) => (
                  <SheetClose
                    key={l.href}
                    render={<a href={l.href} />}
                    nativeButton={false}
                    className="border-b border-border py-4 text-[1.0625rem] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {l.label}
                  </SheetClose>
                ))}
                <SheetClose
                  render={<Link href="/login" />}
                  nativeButton={false}
                  className="border-b border-border py-4 text-[1.0625rem] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Log in
                </SheetClose>
              </nav>
              <div className="mt-auto p-6">
                <ButtonLink href="/app/book" className="w-full">
                  Book a check-up
                </ButtonLink>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  );
}
