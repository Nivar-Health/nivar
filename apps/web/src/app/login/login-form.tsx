"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OTPField } from "@base-ui/react/otp-field";
import { ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { SignedInNotice } from "@/components/signed-in-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { homePathForRole, safeNextPath, useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const DEMO_PHONE = "9876543210";

function destinationFor(user: User, next: string | null): string {
  const home = homePathForRole(user.role);
  const safe = safeNextPath(next);
  return safe && (safe === home || safe.startsWith(`${home}/`)) ? safe : home;
}

function displayPhone(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function CustomerLoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const { requestOtp, loginWithOtp } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"otp" | "verify" | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendOtp = async (target = phone) => {
    if (!/^[6-9]\d{9}$/.test(target)) {
      setError("Enter a valid 10 digit Indian mobile number.");
      return;
    }
    setError(null);
    setPending("otp");
    try {
      const res = await requestOtp(target);
      setDemoOtp(res.demoOtp ?? null);
      setIsNewUser(Boolean(res.isNewUser));
      setOtp("");
      setStep("otp");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the code. Please try again."));
    } finally {
      setPending(null);
    }
  };

  const verify = async (code = otp) => {
    if (pending) return;
    if (code.length !== OTP_LENGTH) {
      setError("Enter the 6 digit code.");
      return;
    }
    if (isNewUser && name.trim().length < 2) {
      setError("Tell us your name so your nurse knows who to ask for.");
      return;
    }
    setError(null);
    setPending("verify");
    try {
      const user = await loginWithOtp(phone, code, isNewUser ? name.trim() : undefined);
      router.replace(destinationFor(user, next));
    } catch (err) {
      setError(errorMessage(err, "That code didn't work. Please try again."));
      setOtp("");
      setPending(null);
    }
  };

  const onPhoneSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendOtp();
  };

  const onOtpSubmit = (e: FormEvent) => {
    e.preventDefault();
    void verify();
  };

  if (step === "phone") {
    return (
      <div>
        <SignedInNotice roles={["customer"]} />
        <h2 className="font-display text-[2rem] leading-tight font-medium tracking-tight">Welcome to Nivar</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Sign in or create an account with your mobile number.
        </p>

        <form onSubmit={onPhoneSubmit} className="mt-8 flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Mobile number</Label>
            <div
              className={cn(
                "flex h-12 items-center overflow-hidden rounded-xl border border-input bg-card transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25",
                error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
              )}
            >
              <span className="flex h-full items-center border-r border-input bg-muted/60 px-3.5 text-[15px] font-medium text-foreground/80">
                +91
              </span>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="98765 43210"
                maxLength={11}
                value={displayPhone(phone)}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(-10));
                  setError(null);
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "phone-error" : undefined}
                className="tabular h-full min-w-0 flex-1 bg-transparent px-3.5 text-[17px] tracking-wide outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            {error && (
              <p id="phone-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={pending !== null || phone.length !== 10}
            className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-lift"
          >
            {pending === "otp" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <>
                Get OTP
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setPhone(DEMO_PHONE);
              void sendOtp(DEMO_PHONE);
            }}
            className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Sparkles className="size-3.5 text-muted-foreground" />
            Use demo patient, Rahul ({formatPhone(DEMO_PHONE)})
          </button>
        </form>

        <div className="mt-10 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" />
          We only use your number for visit updates and reports. No spam, ever.
        </div>
        <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
          Nivar doctor, nurse or admin?{" "}
          <Link
            href={next ? `/staff/login?next=${encodeURIComponent(next)}` : "/staff/login"}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Staff sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setError(null);
        }}
        className="-ml-2 mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Change number
      </button>
      <h2 className="font-display text-[2rem] leading-tight font-medium tracking-tight">
        {isNewUser ? "Create your account" : "Enter the code"}
      </h2>
      <p className="mt-2 text-[15px] text-muted-foreground">
        We sent a 6 digit code to{" "}
        <span className="tabular font-medium whitespace-nowrap text-foreground">{formatPhone(phone)}</span>
      </p>

      {demoOtp && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Demo OTP: </span>
            <span className="tabular font-semibold tracking-[0.2em] text-foreground">{demoOtp}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setOtp(demoOtp);
              setError(null);
              if (!isNewUser || name.trim().length >= 2) void verify(demoOtp);
            }}
            className="rounded-lg bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-soft ring-1 ring-border transition-colors hover:bg-muted"
          >
            Autofill
          </button>
        </div>
      )}

      <form onSubmit={onOtpSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        {isNewUser && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Your full name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              autoFocus
              placeholder="e.g. Rahul Mehta"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="h-12 rounded-xl bg-card px-3.5 text-[15px] md:text-[15px]"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="otp">One-time code</Label>
          <OTPField.Root
            id="otp"
            length={OTP_LENGTH}
            value={otp}
            onValueChange={(value) => {
              setOtp(value);
              setError(null);
            }}
            onValueComplete={(value) => {
              if (!isNewUser || name.trim().length >= 2) void verify(value);
            }}
            disabled={pending === "verify"}
            aria-describedby={error ? "otp-error" : undefined}
            className="grid grid-cols-6 gap-2 sm:gap-2.5"
          >
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <OTPField.Input
                key={i}
                autoFocus={i === 0 && !isNewUser}
                aria-label={i === 0 ? undefined : `Digit ${i + 1} of ${OTP_LENGTH}`}
                aria-invalid={Boolean(error)}
                className={cn(
                  "tabular aspect-square w-full min-w-0 rounded-xl border border-input bg-card text-center text-[22px] font-semibold text-foreground caret-primary transition-[box-shadow,border-color] outline-none focus:border-ring focus:ring-3 focus:ring-ring/25 disabled:opacity-60 sm:aspect-auto sm:h-14",
                  error && "border-destructive focus:border-destructive focus:ring-destructive/20",
                )}
              />
            ))}
          </OTPField.Root>
          {error && (
            <p id="otp-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={pending !== null || otp.length !== OTP_LENGTH}
          className="h-12 w-full rounded-xl text-[15px] font-semibold shadow-lift"
        >
          {pending === "verify" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : isNewUser ? (
            "Create account"
          ) : (
            "Verify and continue"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {resendIn > 0 ? (
            <>
              Resend code in <span className="tabular font-medium text-foreground">0:{String(resendIn).padStart(2, "0")}</span>
            </>
          ) : (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void sendOtp()}
              className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          )}
        </p>
      </form>
    </div>
  );
}
