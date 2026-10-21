import type { JSX, ReactNode } from "react";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { CALLBACK_HREF, buttonClass, inr, type ButtonSize } from "./primitives";

export const WHATSAPP_MESSAGE = "Hi Nivar, I'd like to book a home visit.";

/** A wa.me link with a prefilled message, or null while no WhatsApp number is set (site-facts.ts). */
export function whatsappHref(message: string = WHATSAPP_MESSAGE): string | null {
  if (!SITE.whatsapp) return null;
  return `https://wa.me/${SITE.whatsapp.number}?text=${encodeURIComponent(message)}`;
}

/** The WhatsApp glyph (Simple Icons, 24 grid). Decorative: the link around it carries the name. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={cn("shrink-0", className)}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/** A WhatsApp link that opens the app (or WhatsApp Web) in a new tab. */
export function WhatsAppLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens WhatsApp)</span>
    </a>
  );
}

/** Who a visit is for: the callback form's "For" pills (callback-form.tsx WHO_FOR). */
export type WhoFor = "Myself" | "A parent" | "A child" | "Someone else";

/**
 * Prefill for the callback form. Its click listener reads these from any `a[data-need], a[data-for]`:
 * `data-for` picks the "For" pill, `data-need` fills an empty note and `data-need-label` names the
 * "Asking about" chip. Undefined values leave the attribute out.
 */
function prefill(need?: string, needLabel?: string, forWho?: WhoFor) {
  return { "data-need": need, "data-need-label": needLabel, "data-for": forWho };
}

/**
 * The page's pair of calls to action: "WhatsApp us" (WhatsApp green) and "Request a callback".
 * While no WhatsApp number is set, only the callback button shows, in the accent colour.
 * `tone="dark"` swaps the secondary button for the light pill used on teal panels.
 * `need`, `needLabel` and `forWho` prefill the callback form (data-need, data-need-label, data-for).
 */
export function ContactCtas({
  message,
  size = "lg",
  tone = "light",
  className,
  buttonClassName,
  need,
  needLabel,
  forWho,
}: {
  message?: string;
  size?: ButtonSize;
  tone?: "light" | "dark";
  className?: string;
  buttonClassName?: string;
  need?: string;
  needLabel?: string;
  forWho?: WhoFor;
}) {
  const href = whatsappHref(message);
  const callback = href ? (tone === "dark" ? "inverse" : "secondary") : "accent";
  return (
    <div className={cn("flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap", className)}>
      {href && (
        <WhatsAppLink href={href} className={buttonClass("whatsapp", buttonClassName, size)}>
          <WhatsAppIcon className="size-5!" />
          WhatsApp us
        </WhatsAppLink>
      )}
      {/* A plain in-page anchor (spec §2.2): next/link skips the scroll when the URL already ends in #callback. */}
      <a href={CALLBACK_HREF} className={buttonClass(callback, buttonClassName, size)} {...prefill(need, needLabel, forWho)}>
        Request a callback
      </a>
    </div>
  );
}

/**
 * One service's call to action (spec §3.2):
 * - WhatsApp set: [Ask on WhatsApp], sr " about {name}"; the message asks the price (from null) or
 *   books ("I'd like to book {ask} at home.").
 * - No WhatsApp, from null: [Get the price], sr " for {name}", need "Please tell me the price for {ask} at home."
 * - No WhatsApp, priced: [Request this visit], sr ": {name}", need "I'd like to book {ask} at home ({priceLabel})."
 * Without WhatsApp it is a plain `<a href="#callback">` that prefills the form, so it works without JS.
 * `needLabel` defaults to `name`; `priceLabel` to "from ₹{from}". `label`, `need` and `needLabel` apply
 * to the callback variant only (a custom `label` replaces the visible text and the sr suffix).
 */
export function CareCta({
  name,
  ask,
  from,
  priceLabel,
  forWho,
  tone = "light",
  size = "md",
  fullWidth = false,
  need,
  needLabel,
  label,
  className,
}: {
  name: string;
  ask: string;
  from: number | null;
  priceLabel?: string;
  forWho?: WhoFor;
  tone?: "light" | "dark";
  size?: "md" | "lg";
  fullWidth?: boolean;
  need?: string;
  needLabel?: string;
  label?: string;
  className?: string;
}): JSX.Element {
  const width = fullWidth && "w-full";
  const wa = whatsappHref(
    from === null ? `Hi Nivar, what's the price for ${ask} at home?` : `Hi Nivar, I'd like to book ${ask} at home.`,
  );
  if (wa) {
    return (
      <WhatsAppLink href={wa} className={buttonClass("whatsapp", cn(width, className), size)}>
        <WhatsAppIcon className="size-4.5!" />
        Ask on WhatsApp<span className="sr-only"> about {name}</span>
      </WhatsAppLink>
    );
  }
  const priced = from !== null;
  const composed = priced
    ? `I'd like to book ${ask} at home (${priceLabel ?? `from ${inr(from)}`}).`
    : `Please tell me the price for ${ask} at home.`;
  return (
    <a
      href={CALLBACK_HREF}
      className={buttonClass(tone === "dark" ? "inverse" : "secondary", cn(width, className), size)}
      {...prefill(need ?? composed, needLabel ?? name, forWho)}
    >
      {label ?? (
        <>
          {priced ? "Request this visit" : "Get the price"}
          <span className="sr-only">{priced ? `: ${name}` : ` for ${name}`}</span>
        </>
      )}
    </a>
  );
}

/**
 * "WhatsApp us": a 56px circle on phones, a labelled pill from sm. On its own it is fixed to the
 * corner; `docked` drops the fixed positioning for the corner cluster (take-a-minute/cluster.tsx).
 * Renders nothing while no WhatsApp number is set.
 */
export function WhatsAppFab({ docked = false, className }: { docked?: boolean; className?: string } = {}) {
  const href = whatsappHref();
  if (!href) return null;
  return (
    <WhatsAppLink
      href={href}
      className={cn(
        "inline-flex h-14 items-center gap-2.5 rounded-full bg-whatsapp px-4 text-base font-semibold text-whatsapp-ink shadow-[0_16px_32px_-12px_rgb(7_59_40/0.55)] ring-1 ring-whatsapp-ink/10 transition-[background-color,translate,scale] duration-180 ease-standard select-none hover:-translate-y-0.5 hover:bg-whatsapp-hover focus-ring active:scale-[0.97] active:bg-whatsapp-hover active:duration-90 motion-reduce:active:scale-100 sm:pr-5",
        !docked && "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 sm:right-6 sm:bottom-6",
        className,
      )}
    >
      <WhatsAppIcon className="size-6" />
      <span className="sr-only sm:not-sr-only">WhatsApp us</span>
    </WhatsAppLink>
  );
}
