import type { Metadata } from "next";
import { TodayView } from "./_components/today-view";

export const metadata: Metadata = { title: "Today's visits" };

export default function NurseHomePage() {
  return <TodayView />;
}
