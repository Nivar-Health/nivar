import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { SITE } from "@/lib/site-facts";
import { CustomerLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Nivar with your mobile number to book and track home health check-ups.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reason } = await searchParams;
  return (
    <AuthLayout
      eyebrow="Home health check-ups"
      // The form's own title is this page's h1 at every width.
      headlineAs="p"
      headline={
        <>
          {/* nowrap: never break "check-ups" at its hyphen, and keep "at home," together. */}
          Health <span className="whitespace-nowrap">check-ups</span>{" "}
          <span className="whitespace-nowrap">at home,</span>{" "}
          <span className="block font-accent font-normal text-heading-accent">with a doctor on video.</span>
        </>
      }
      points={[
        "A registered Nivar nurse comes to your home with a smart ECG and stethoscope",
        "A Nivar doctor sees your readings and joins on video when needed",
        `Your report and prescription, ${SITE.report.checkup}`,
      ]}
      footnote={`Now serving ${SITE.area}, ${SITE.hours.short}`}
    >
      <CustomerLoginForm next={typeof next === "string" ? next : null} signedOut={reason === "expired"} />
    </AuthLayout>
  );
}
