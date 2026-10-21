import type { Metadata } from "next";
import { BookingDetail } from "../../_components/booking-detail";

export const metadata: Metadata = { title: "Your visit" };

export default async function BookingPage({ params }: PageProps<"/app/bookings/[id]">) {
  const { id } = await params;
  return <BookingDetail key={id} id={id} />;
}
