import type { Metadata } from "next";
import { BookingsList } from "../_components/bookings-list";

export const metadata: Metadata = { title: "My bookings" };

export default function BookingsPage() {
  return <BookingsList />;
}
