import { istParts } from "@/server/time";

/**
 * The WhatsApp number, with country code (91...). Set NEXT_PUBLIC_WHATSAPP_NUMBER; a bare 10-digit
 * Indian mobile gets the 91 prefix, as does one written with a trunk 0. While it is unset the site
 * hides WhatsApp entry points and its WhatsApp CTAs fall back to the callback form. A value that is
 * not an Indian mobile counts as unset: a wa.me link to a wrong number would sit on every button.
 */
const whatsappDigits = (() => {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
  const d = raw.replace(/\D/g, "").replace(/^0+/, "");
  const full = d.length === 10 ? `91${d}` : d;
  if (!full || /^91[6-9]\d{9}$/.test(full)) return full;
  if (typeof window === "undefined") {
    console.warn(`NEXT_PUBLIC_WHATSAPP_NUMBER "${raw}" is not an Indian mobile number; WhatsApp stays hidden.`);
  }
  return "";
})();

/** Operational facts shown to patients. Change them here only. */
export const SITE = {
  legalName: "Nivar Health",
  /** Production origin, for share previews and canonical links. NEXT_PUBLIC_SITE_URL overrides it. */
  url: "https://www.nivarhealth.in",
  city: "Bengaluru",
  area: "HSR Layout and nearby",
  /** Service area and hours in one phrase, for badges and footers. */
  areaAndHours: "HSR Layout and nearby, 7 AM to 8 PM",
  hours: {
    short: "7 AM to 8 PM",
    range: "7 AM–8 PM",
    inSentence: "between 7 AM and 8 PM",
    /** The same hours as numbers, in India time (minutes after midnight), for copy that follows the clock. */
    opensAt: 7 * 60,
    closesAt: 20 * 60,
    opensAtLabel: "7 AM",
  },
  callbackWithin: "30 minutes",
  /** The same promise as a number, for a clock time ("We will call you by 10:42 AM"). */
  callbackWithinMinutes: 30,
  /** Who makes the first call after a request. One phrase, used wherever the page says who calls. */
  firstCall: { who: "a care coordinator", whoCapital: "A care coordinator" },
  report: {
    /** Check-up reports only; other visits get a short visit summary. */
    checkup: "usually within the hour",
    channel: "on WhatsApp",
  },
  payment: {
    faq: "We tell you the full price before we confirm the visit, and our team shares the ways to pay on WhatsApp or on the call. If the nurse does not arrive, we refund you in full.",
  },
  /** One cancellation rule for the site and the web app. `until` completes "…free of charge until …". */
  cancellation: "Free cancellation until the nurse is on the way",
  cancellationUntil: "the nurse is on the way",
  /** Set when a real number exists. UI hides phone entry points while null. */
  phone: null as { display: string; tel: string } | null,
  whatsapp: whatsappDigits ? { number: whatsappDigits } : null,
  /**
   * The Medical Lead, shown in "Safe hands, at home" with their permission. The card stays hidden
   * while null. `photo` is a path under /public, ideally a 4:5 portrait.
   */
  medicalLead: null as {
    name: string;
    credentials: string;
    registration?: string;
    photo?: string;
    background: string;
  } | null,
  emergency: {
    short: "In an emergency, call 112 (or 108 for an ambulance).",
    full: "Nivar is not an emergency service. In an emergency, call 112 (or 108 for an ambulance).",
  },
} as const;

/** "10:42 AM", or "7 AM" on the hour, for minutes after midnight. */
export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h % 12 || 12;
  return `${h12}${min ? `:${String(min).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * What a callback request sent at `at` can be promised, in India time. `open`: a call by a clock time.
 * `closing`: inside the last stretch before closing, so the call may come before then or after opening.
 * `closed`: the call comes after opening. Never names a day: the working days are not confirmed.
 */
export type CallbackPromise =
  | { state: "open"; by: string }
  | { state: "closing"; closesAt: string; opensAt: string }
  | { state: "closed"; opensAt: string };

export function callbackPromiseAt(at: Date = new Date()): CallbackPromise {
  return callbackPromiseFor(istParts(at).minutes);
}

/** The same, for minutes after midnight in India. */
export function callbackPromiseFor(minutes: number): CallbackPromise {
  const { opensAt, closesAt } = SITE.hours;
  const within = SITE.callbackWithinMinutes;
  const opens = clockLabel(opensAt);
  if (minutes >= opensAt && minutes + within <= closesAt) return { state: "open", by: clockLabel(minutes + within) };
  if (minutes >= opensAt && minutes < closesAt) return { state: "closing", closesAt: clockLabel(closesAt), opensAt: opens };
  return { state: "closed", opensAt: opens };
}
