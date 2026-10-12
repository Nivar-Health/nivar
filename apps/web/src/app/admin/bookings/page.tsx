import { Suspense } from "react";
import type { Metadata } from "next";
import { TableSkeleton } from "../_components/admin-ui";
import { BookingsList } from "../_components/bookings-list";

export const metadata: Metadata = { title: "Bookings" };

export default function AdminBookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="overflow-hidden rounded-[14px] border border-border bg-card">
          <TableSkeleton rows={10} cols={7} />
        </div>
      }
    >
      <BookingsList />
    </Suspense>
  );
}
