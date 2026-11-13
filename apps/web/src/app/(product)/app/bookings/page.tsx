import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingsList } from "../_components/bookings-list";

export const metadata: Metadata = { title: "My bookings" };

export default function BookingsPage() {
  // The list reads its tab from the URL (useSearchParams), which needs a Suspense boundary on a
  // prerendered page. It never suspends in the browser, so there is nothing to show meanwhile.
  return (
    <Suspense fallback={null}>
      <BookingsList />
    </Suspense>
  );
}
