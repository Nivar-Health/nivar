/**
 * Customer booking and sign-in are still in development; the public site books by WhatsApp, call
 * or callback either way. Set NEXT_PUBLIC_BOOKING_ENABLED=false to hide its "Log in" links and send
 * /login and /app back to the home page. Inlined at build time, so a change needs a rebuild.
 */
export const bookingEnabled = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "false";
