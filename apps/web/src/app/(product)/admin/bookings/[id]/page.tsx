import type { Metadata } from "next";
import { BookingDetail } from "../../_components/booking-detail";

export const metadata: Metadata = { title: "Booking" };

export default async function AdminBookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  return <BookingDetail id={id} />;
}
