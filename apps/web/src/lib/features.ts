/**
 * Customer booking and sign-in are still in development; the public site books by WhatsApp, call
 * or callback either way. Set NEXT_PUBLIC_BOOKING_ENABLED=false to hide its "Log in" links and send
 * /login and /app back to the home page. Inlined at build time, so a change needs a rebuild.
 */
export const bookingEnabled = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "false";

/**
 * Demo aids: the demo accounts on the sign-in pages, the demo one-time code, the simulated nurse
 * drive and the prefilled test card. They stay on while the product is being shown and tested. Set
 * NEXT_PUBLIC_DEMO_MODE=false at launch to hide them from patients and staff. Inlined at build time.
 */
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
