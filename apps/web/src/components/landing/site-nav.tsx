"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { Container, ctaClass } from "./primitives";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#devices", label: "Devices" },
  { href: "#doctors", label: "Doctors" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300",
        scrolled || open
          ? "border-b border-ink/8 bg-ivory/88 shadow-[0_8px_24px_-20px_rgb(19_35_33/0.5)] backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6 lg:h-[72px]">
        <Link
          href="/"
          className="-m-1 rounded-lg p-1 outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
          aria-label="Nivar home"
        >
          <Logo size="md" />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-3.5 py-2 text-[0.9rem] font-medium text-ink/75 transition-colors outline-none hover:bg-ink/5 hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/30"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className={ctaClass("ghost", "md", "hidden sm:inline-flex")}>
            Log in
          </Link>
          <Link href="/app/book" className={ctaClass("primary", "md", "max-[359px]:hidden")}>
            Book a check-up
          </Link>
          <button
            type="button"
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-ink outline-none hover:bg-ink/5 focus-visible:ring-3 focus-visible:ring-primary/30 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-ink/8 lg:hidden"
      >
        <Container className="py-3">
          <nav aria-label="Mobile">
            <ul className="flex flex-col">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center rounded-xl px-3 text-base font-medium text-ink outline-none hover:bg-ink/5 focus-visible:ring-3 focus-visible:ring-primary/30"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink/8 pt-4 pb-2">
            <Link href="/login" className={ctaClass("secondary", "lg")}>
              Log in
            </Link>
            <Link href="/app/book" className={ctaClass("primary", "lg")}>
              Book a check-up
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
