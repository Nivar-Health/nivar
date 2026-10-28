// disclosure.tsx: no "use client", no hooks; works in server and client trees.
import { ChevronDown } from "lucide-react";
import type { ReactNode, Ref, ToggleEventHandler } from "react";
import { cn } from "@/lib/utils";
import "./disclosure.css";

export type DisclosureProps = {
  /** Unique on the page and the deep-link target: faq-*, cred-*, pkg-<slug>, lab-tests, visit-prep, all-sources, callback-more, foot-*. */
  id: string;
  /** The row title. Phrasing content. With titleTag it is rendered inside that heading (FAQ only). */
  title: ReactNode;
  titleTag?: "h3";
  /** 13px/500 line under the title: proof, contents, progress. Phrasing content. Not with titleTag. */
  meta?: ReactNode;
  /** Right-hand value before the chevron, e.g. a price or "Optional". Phrasing content. */
  value?: ReactNode;
  /** Decorative lead, rendered aria-hidden: a 22px icon ("icon") or a 40px glyph tile ("tile"). */
  lead?: ReactNode;
  leadSize?: "icon" | "tile";
  variant?: "ruled" | "card" | "dark"; // default "ruled"
  /** "phone": collapsible below 640px only. From 640px `head` replaces the summary and the content always shows. */
  collapse?: "always" | "phone";
  head?: ReactNode;
  /** Server-rendered state only. Open later only imperatively (ref.current.open = true) on a user action, never from matchMedia. */
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  onToggle?: ToggleEventHandler<HTMLDetailsElement>; // client trees only
  ref?: Ref<HTMLDetailsElement>;
  children: ReactNode;
};

const has = (node: ReactNode) => node !== undefined && node !== null && node !== false && node !== "";

/**
 * The page's one drop-down (spec §1.10): a native <details>, so it opens without JavaScript, find-in-page
 * opens it, and closed text stays in the HTML. No `name`, so several can be open at once. Deep links
 * open it through DisclosureHash (disclosure-hash.tsx).
 */
export function Disclosure({
  id,
  title,
  titleTag,
  meta,
  value,
  lead,
  leadSize = "icon",
  variant = "ruled",
  collapse = "always",
  head,
  defaultOpen = false,
  className,
  bodyClassName,
  onToggle,
  ref,
  children,
}: DisclosureProps) {
  const phone = collapse === "phone";
  return (
    <details
      ref={ref}
      id={id}
      open={defaultOpen || undefined}
      data-lead={has(lead) ? leadSize : undefined}
      onToggle={onToggle}
      // A visitor may open it before hydration, and the hash opener or the phone-only sync may set `open`
      // and data-nv-forced on it: React must neither report nor undo that.
      suppressHydrationWarning
      className={cn("nv-disc", `nv-disc--${variant}`, phone && "nv-disc--phone", className)}
    >
      <summary className="nv-disc-sum">
        {has(lead) && (
          <span aria-hidden className="nv-disc-lead">
            {lead}
          </span>
        )}
        {titleTag ? (
          <h3 className="nv-disc-text nv-disc-title">{title}</h3>
        ) : (
          <span className="nv-disc-text">
            <span className="nv-disc-title">{title}</span>
            {has(meta) && <span className="nv-disc-meta">{meta}</span>}
          </span>
        )}
        {has(value) && <span className="nv-disc-value">{value}</span>}
        <ChevronDown aria-hidden className="nv-disc-chev" strokeWidth={2.25} />
      </summary>
      {phone && <div className="nv-disc-head">{head}</div>}
      <div className={cn("nv-disc-body", bodyClassName)}>{children}</div>
    </details>
  );
}
