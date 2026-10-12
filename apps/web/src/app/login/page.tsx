import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { CustomerLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Nivar with your mobile number to book and track home health check-ups.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <AuthLayout
      eyebrow="Home health check-ups"
      headline={
        <>
          Doctor-grade check-ups, <span className="text-white/55">at your doorstep.</span>
        </>
      }
      points={[
        "A certified Nivar nurse visits with a smart ECG and stethoscope",
        "A Nivar doctor watches your readings live and consults over video",
        "Your report and prescription, usually within 60 minutes",
      ]}
      footnote="Now serving Bangalore, 7 AM to 8 PM, every day"
    >
      <CustomerLoginForm next={typeof next === "string" ? next : null} />
    </AuthLayout>
  );
}
