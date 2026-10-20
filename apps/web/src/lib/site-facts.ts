/**
 * The WhatsApp number, with country code (91...). Set NEXT_PUBLIC_WHATSAPP_NUMBER; a bare 10-digit
 * Indian mobile gets the 91 prefix. While it is unset the site hides WhatsApp entry points and its
 * WhatsApp CTAs fall back to the callback form.
 */
const whatsappDigits = (() => {
  const d = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
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
  hours: { short: "7 AM to 8 PM", range: "7 AM–8 PM", inSentence: "between 7 AM and 8 PM" },
  callbackWithin: "30 minutes",
  report: {
    /** Check-up reports only; other visits get a short visit summary. */
    checkup: "usually within the hour",
    channel: "on WhatsApp",
  },
  payment: {
    faq: "We tell you the full price before we confirm the visit, and our team shares the ways to pay on WhatsApp or on the call. If the nurse does not arrive, we refund you in full.",
  },
  cancellation: "Free cancellation until the nurse sets off",
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
