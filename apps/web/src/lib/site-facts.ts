/** Operational facts shown to patients. Change them here only. */
export const SITE = {
  legalName: "Nivar Health",
  city: "Bangalore",
  hours: { short: "7 am to 9 pm", inSentence: "between 7 am and 9 pm" },
  callbackWithin: "30 minutes",
  report: {
    promise: "usually within the hour",
    chip: "Usually within the hour",
    strip: "Report usually within the hour",
  },
  payment: {
    line: "Pay securely in the app by UPI, card or net banking.",
    faq: "In the app, by UPI, card or net banking, when you confirm your booking. If the nurse does not arrive, we refund you in full.",
  },
  cancellation: "Free cancellation until the nurse sets off",
  /** Set when a real number exists. UI hides phone and WhatsApp entry points while null. */
  phone: null as { display: string; tel: string } | null,
  whatsapp: null as { display: string; href: string } | null,
  emergency: {
    short: "In an emergency, call 112 (or 108 for an ambulance).",
    full: "Nivar is not an emergency service. In an emergency, call 112 (or 108 for an ambulance).",
  },
} as const;
