import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { StaffLoginForm } from "./staff-login-form";

export const metadata: Metadata = {
  title: "Staff sign in",
  description: "Sign in to the Nivar care console for doctors, nurses and admins.",
};

export default async function StaffLoginPage({ searchParams }: PageProps<"/staff/login">) {
  const { next } = await searchParams;
  return (
    <AuthLayout
      eyebrow="Nivar care console"
      headline={
        <>
          Every visit, from dispatch <span className="text-white/55">to diagnosis.</span>
        </>
      }
      points={[
        "Admins assign a nurse and a doctor to each booking in a click",
        "Nurses stream ECG and stethoscope readings straight from the home",
        "Doctors watch live, consult over video and publish the report",
      ]}
      footnote={
        <>
          For Nivar employees. Patients sign in{" "}
          <Link href="/login" className="font-medium text-white/85 underline-offset-4 hover:underline">
            here
          </Link>
          .
        </>
      }
    >
      <StaffLoginForm next={typeof next === "string" ? next : null} />
    </AuthLayout>
  );
}
