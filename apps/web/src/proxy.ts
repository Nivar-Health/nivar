import { NextResponse, type NextRequest } from "next/server";
import { bookingEnabled } from "@/lib/features";

/** With booking switched off, the customer sign-in and app are not reachable; see lib/features. */
export function proxy(request: NextRequest) {
  if (bookingEnabled) return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/login", "/app", "/app/:path*"],
};
