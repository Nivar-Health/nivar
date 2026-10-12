import { Activity, House, Lock, MonitorSmartphone, Stethoscope } from "lucide-react";
import { Container, SectionHeading } from "./primitives";
import { LiveDevices } from "./live-devices";

const DEVICES = [
  {
    icon: Activity,
    name: "Nivar Smart ECG",
    body: "A resting Lead II ECG, sampled 250 times a second. Your doctor sees every beat as it happens, and a 10 second strip is saved to your report.",
  },
  {
    icon: Stethoscope,
    name: "Nivar Smart Stethoscope",
    body: "Digital auscultation of heart and lungs. The nurse places it, and the doctor listens in from the clinic, exactly as if they were in the room.",
  },
];

export function Devices() {
  return (
    <section
      id="devices"
      aria-labelledby="devices-title"
      className="relative isolate scroll-mt-20 overflow-hidden bg-[#0B2B26] py-20 text-ivory sm:py-24 lg:py-32"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-ecg-grid-dark opacity-70" />
      <div
        aria-hidden
        className="absolute -top-40 right-[-10%] -z-10 h-[520px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgb(59_227_180/0.14),transparent)]"
      />
      <Container className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
        <div>
          <SectionHeading
            id="devices-title"
            tone="light"
            title="Your heartbeat, on your doctor's screen, live."
            lede="Our nurses carry two connected devices. They stream to the doctor in real time, so the reading is reviewed while you are still sitting there, not days later."
          />

          <ul className="mt-10 space-y-6">
            {DEVICES.map(({ icon: Icon, name, body }) => (
              <li key={name} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#3BE3B4]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold text-white">{name}</h3>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-ivory/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <ol className="flex items-center justify-between gap-2 text-center text-[0.78rem] text-ivory/80 sm:text-sm" aria-label="How readings travel">
              <FlowNode icon={House} label="Your home" />
              <FlowLink />
              <FlowNode icon={Lock} label="Encrypted stream" />
              <FlowLink />
              <FlowNode icon={MonitorSmartphone} label="Nivar doctor" />
            </ol>
          </div>
        </div>

        <div className="relative">
          <p className="mb-3 flex items-center gap-2 text-sm text-ivory/70">
            <span className="live-dot text-[#3BE3B4]" aria-hidden />
            A live demo of the doctor&apos;s screen. Tap Listen to hear the heartbeat.
          </p>
          <LiveDevices />
        </div>
      </Container>
    </section>
  );
}

function FlowNode({ icon: Icon, label }: { icon: typeof House; label: string }) {
  return (
    <li className="flex min-w-0 flex-col items-center gap-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-[#3BE3B4]/12 text-[#3BE3B4]">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="leading-tight">{label}</span>
    </li>
  );
}

function FlowLink() {
  return (
    <li aria-hidden className="relative -mt-6 h-px min-w-6 flex-1 overflow-hidden bg-white/12">
      <span className="absolute inset-y-0 left-0 w-1/3 animate-[landing-flow_1.8s_linear_infinite] bg-gradient-to-r from-transparent via-[#3BE3B4] to-transparent" />
    </li>
  );
}
