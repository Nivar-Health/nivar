import { Devices } from "@/components/landing/devices";
import { HowItWorksSteps } from "@/components/landing/how-it-works";
import { LiveSection } from "@/components/landing/live-section";
import { pageMetadata } from "@/components/landing/seo";

export const metadata = pageMetadata({
  title: "How it works",
  description:
    "Message us on WhatsApp, our doctor calls, a registered nurse arrives with a clinic-grade kit, and your report comes on WhatsApp. See the live ECG and stethoscope readings a Nivar doctor sees.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <>
      <HowItWorksSteps />
      <LiveSection />
      <Devices />
    </>
  );
}
