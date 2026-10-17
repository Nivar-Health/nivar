import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { SITE } from "@/lib/site-facts";
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
          {/* nowrap: never break "check-ups" at its hyphen, and keep the serif phrase on one line. */}
          Doctor-grade <span className="whitespace-nowrap">check-ups,</span>{" "}
          <span className="font-accent font-normal whitespace-nowrap text-heading-accent">at your doorstep.</span>
        </>
      }
      points={[
        "A certified Nivar nurse visits with a smart ECG and stethoscope",
        "A Nivar doctor watches your readings live and consults over video",
        `Your report and prescription, ${SITE.report.promise}`,
      ]}
      footnote={`Now serving ${SITE.city}, ${SITE.hours.short}, every day`}
    >
      <CustomerLoginForm next={typeof next === "string" ? next : null} />
    </AuthLayout>
  );
}
