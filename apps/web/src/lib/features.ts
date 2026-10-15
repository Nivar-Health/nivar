/**
 * Customer booking and sign-in are still in development. Set NEXT_PUBLIC_BOOKING_ENABLED=false
 * to take them off the landing page (its booking CTAs point at the callback form instead) and
 * send /login and /app back to the landing page. Inlined at build time, so a change needs a rebuild.
 */
export const bookingEnabled = process.env.NEXT_PUBLIC_BOOKING_ENABLED !== "false";
