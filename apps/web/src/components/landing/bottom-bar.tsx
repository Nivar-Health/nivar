"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PhoneIncoming } from "lucide-react";
import type { JSX, MouseEvent as ReactMouseEvent } from "react";
import { TabGlyph, type GlyphKind } from "./bar-icons";
import { WhatsAppIcon, whatsappHref } from "./whatsapp";

export type TabId = "services" | "check-ups" | "health-tips" | "nurses";
type Slot = TabId | "key" | "menu";

const TABS: Readonly<Record<TabId, { href: `#${string}`; label: string; glyph: GlyphKind }>> = {
  services: { href: "#services", label: "Services", glyph: "services" },
  "check-ups": { href: "#check-ups", label: "Check-ups", glyph: "check-ups" },
  "health-tips": { href: "#health-tips", label: "Health tips", glyph: "health" },
  nurses: { href: "#nurses", label: "Your nurse", glyph: "nurse" },
};

/** Left to right. Founder question 1, the other way: replace "health-tips" with "nurses". */
export const BAR_SLOTS: readonly Slot[] = ["services", "check-ups", "key", "health-tips", "menu"];

const SECTION_TAB: Readonly<Record<string, TabId | "menu">> = {
  services: "services",
  "how-it-works": "services",
  nurses: "nurses",
  compare: "nurses",
  "check-ups": "check-ups",
  "health-tips": "health-tips",
  faq: "menu",
};

/** The slot that carries the mark: the section's own tab when the bar has it, else Menu; null at the hero and the form. */
export function barMark(section: string | null): TabId | "menu" | null {
  const tab = section ? SECTION_TAB[section] : undefined;
  if (!tab) return null;
  return tab !== "menu" && BAR_SLOTS.includes(tab) ? tab : "menu";
}

/** A click that opens a new tab or window, or isn't the main button: the browser's, not ours. */
export const modified = (e: MouseEvent | ReactMouseEvent) =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * The phone bar (below 640px): four tabs around the one action, rendered by SiteNav inside the sheet's
 * Dialog.Root, so Menu is a second trigger of the same sheet. Where it shows is CSS on the chrome
 * signals (site-nav.css); this only renders, marks and jumps. Tabs replace the URL's hash rather than
 * pushing one, so Back still leaves the page.
 */
export function BottomBar({
  current,
  jumpTo,
}: {
  /** The section in the reading band (useCurrentSection), or null. */
  current: string | null;
  /** Scrolls to a hash without a history entry and focuses its heading once settled; false without a target. */
  jumpTo: (hash: `#${string}`) => boolean;
}): JSX.Element {
  const mark = barMark(current);
  const wa = whatsappHref();

  const onJump = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (modified(e)) return;
    if (jumpTo(e.currentTarget.hash as `#${string}`)) e.preventDefault();
  };

  const cell = (slot: Slot) => {
    if (slot === "menu") {
      // Base UI gives whichever trigger opened the sheet aria-expanded, and focus returns to it.
      return (
        <Dialog.Trigger id="nv-menu-bar" className="nv-tabbar-cell" data-on={mark === "menu" ? "" : undefined}>
          <TabGlyph kind="menu" />
          <span className="nv-tabbar-label">Menu</span>
          <span aria-hidden className="nv-tabbar-ind" />
        </Dialog.Trigger>
      );
    }
    if (slot === "key") {
      // No data-need: a prefill would focus a field, and a keyboard would open mid-scroll.
      return wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" data-wa="" className="nv-tabbar-cell nv-tabbar-keycell">
          <span className="nv-tabbar-key">
            <WhatsAppIcon />
            <span className="nv-tabbar-label">
              Chat<span className="sr-only"> on WhatsApp (opens WhatsApp)</span>
            </span>
          </span>
        </a>
      ) : (
        <a href="#callback" onClick={onJump} className="nv-tabbar-cell nv-tabbar-keycell">
          <span className="nv-tabbar-key">
            <PhoneIncoming aria-hidden strokeWidth={2} />
            <span className="nv-tabbar-label">
              <span className="sr-only">Request a </span>Callback
            </span>
          </span>
        </a>
      );
    }
    const tab = TABS[slot];
    return (
      <a
        href={tab.href}
        onClick={onJump}
        aria-current={mark === slot ? "location" : undefined}
        className="nv-tabbar-cell"
      >
        <TabGlyph kind={tab.glyph} />
        <span className="nv-tabbar-label">{tab.label}</span>
        <span aria-hidden className="nv-tabbar-ind" />
      </a>
    );
  };

  return (
    <nav aria-label="Primary" className="nv-tabbar">
      <ul role="list" className="nv-tabbar-list">
        {BAR_SLOTS.map((slot) => (
          <li key={slot}>{cell(slot)}</li>
        ))}
      </ul>
    </nav>
  );
}
