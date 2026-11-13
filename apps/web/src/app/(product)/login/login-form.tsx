"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OTPField } from "@base-ui/react/otp-field";
import { ArrowLeft, ArrowRight, Info, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { FullScreenLoader } from "@/components/full-screen-loader";
import { SignedInNotice } from "@/components/signed-in-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, tokenStore } from "@/lib/api";
import { homePathForRole, safeNextPath, useAuth } from "@/lib/auth";
import { demoMode } from "@/lib/features";
import { formatPhone } from "@/lib/format";
import { checkPhone, formatPhone as groupDigits, phoneDigits } from "@/lib/phone";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
/** How long "We sent a new OTP." stands in for the resend countdown. */
const RESENT_NOTE_SECONDS = 4;
const DEMO_PHONE = "9876543210";

type Field = "phone" | "name" | "otp";

function destinationFor(user: User, next: string | null): string {
  const home = homePathForRole(user.role);
  const safe = safeNextPath(next);
  return safe && (safe === home || safe.startsWith(`${home}/`)) ? safe : home;
}

/**
 * What to say when a step fails. Only wording written here (or the app's own offline line) is ever
 * shown: the SMS provider's text can come back from the API and must not reach a patient.
 */
function signInError(err: unknown, step: "send" | "check"): string {
  const api = err instanceof ApiError ? err : null;
  if (api?.status === 0) return api.message;
  if (api?.code === "staff_account") {
    return "This number belongs to a Nivar staff account. Use Staff sign in below.";
  }
  if (api?.code === "validation_error") return "Check the mobile number and try again.";
  if (api?.code === "invalid_otp") {
    return "That OTP isn't right or has expired. Check the SMS and try again, or tap Resend OTP.";
  }
  if (api?.status === 429) return "Too many tries. Wait a minute, then try again.";
  return step === "send"
    ? "We couldn't send the OTP just now. Try again in a minute."
    : "We couldn't check the OTP just now. Try again in a minute.";
}

/** The id Base UI gives each OTP box: the root's id, then `-2`, `-3` and so on. */
const otpBoxId = (index: number) => (index === 0 ? "otp" : `otp-${index + 1}`);

const fieldError = "text-small text-destructive";
const submitButton = "h-14 w-full rounded-full text-base font-semibold sm:h-12";

export function CustomerLoginForm({ next, signedOut = false }: { next: string | null; signedOut?: boolean }) {
  const router = useRouter();
  const { user, loading, requestOtp, loginWithOtp } = useAuth();
  const hasSession = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.get() !== null,
    () => false,
  );

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [error, setError] = useState<{ field: Field; message: string } | null>(null);
  const [pending, setPending] = useState<"otp" | "verify" | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Outside the demo a signed-in patient has no use for this form: take them to the app.
  const alreadyIn = !demoMode && user?.role === "customer";
  useEffect(() => {
    if (alreadyIn && user && pending === null) router.replace(destinationFor(user, next));
  }, [alreadyIn, user, pending, next, router]);

  /**
   * Shows what is wrong and puts the cursor where it can be fixed. Nothing typed is cleared. For the
   * OTP that is the first empty box, or the last one when all six are filled.
   */
  const fail = (field: Field, message: string, otpDigits = otp.length) => {
    setError({ field, message });
    if (field === "phone") phoneRef.current?.focus();
    else if (field === "name") nameRef.current?.focus();
    else document.getElementById(otpBoxId(Math.min(otpDigits, OTP_LENGTH - 1)))?.focus();
  };

  const sendOtp = async (digits = phone, resend = false) => {
    if (pending) return;
    const check = checkPhone(digits);
    if (!check.ok) {
      fail("phone", check.message);
      return;
    }
    setError(null);
    setPending("otp");
    try {
      const res = await requestOtp(check.phone);
      setDemoOtp(demoMode ? (res.demoOtp ?? null) : null);
      setIsNewUser(Boolean(res.isNewUser));
      setOtp("");
      setStep("otp");
      setResendIn(RESEND_SECONDS);
      setResent(resend);
    } catch (err) {
      fail(resend ? "otp" : "phone", signInError(err, "send"));
    } finally {
      setPending(null);
    }
  };

  const verify = async (code = otp) => {
    if (pending) return;
    if (isNewUser && name.trim().length < 2) {
      fail("name", "Tell us your name so your nurse knows who to ask for.");
      return;
    }
    if (code.length !== OTP_LENGTH) {
      fail("otp", "Enter all 6 digits of the OTP.", code.length);
      return;
    }
    setError(null);
    setPending("verify");
    try {
      const signedIn = await loginWithOtp(phone, code, isNewUser ? name.trim() : undefined);
      router.replace(destinationFor(signedIn, next));
    } catch (err) {
      setPending(null);
      fail("otp", signInError(err, "check"), code.length);
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

  if (!demoMode && hasSession && (loading || alreadyIn) && pending === null) {
    return <FullScreenLoader label="One moment" />;
  }

  if (step === "phone") {
    const phoneError = error?.field === "phone" ? error.message : null;
    return (
      <div>
        {demoMode && <SignedInNotice roles={["customer"]} />}
        {signedOut && (
          <p
            role="status"
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-small text-foreground"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            You have been signed out. Sign in again to continue.
          </p>
        )}
        <h1 className="font-display text-[2rem] leading-tight font-semibold">Welcome to Nivar</h1>
        <p className="mt-2 text-base text-muted-foreground">Sign in or create an account with your mobile number.</p>
        {/* From 1024px the brand panel beside the form says this. */}
        <p className="mt-2 text-base text-muted-foreground lg:hidden">
          A registered nurse comes to your home, and a Nivar doctor joins on video when needed.
        </p>

        <form method="post" onSubmit={onPhoneSubmit} className="mt-8 flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Mobile number</Label>
            <div
              className={cn(
                "flex h-14 items-center overflow-hidden rounded-xl border border-input bg-card transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25 sm:h-12",
                phoneError && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
              )}
            >
              <span className="flex h-full items-center border-r border-input bg-muted/60 px-3.5 text-base font-medium text-foreground/80">
                +91
              </span>
              {/* No maxLength: a pasted "+91 98450 12345" must arrive whole for phoneDigits to read it. */}
              <input
                ref={phoneRef}
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                enterKeyHint="send"
                autoFocus
                placeholder="98765 43210"
                value={groupDigits(phone)}
                onChange={(e) => {
                  setPhone(phoneDigits(e.target.value));
                  setError(null);
                }}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "phone-error" : "phone-hint"}
                className="tabular h-full min-w-0 flex-1 bg-transparent px-3.5 text-body tracking-wide outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            {phoneError ? (
              <p id="phone-error" role="alert" className={fieldError}>
                {phoneError}
              </p>
            ) : (
              <p id="phone-hint" className="text-small text-foreground-2">
                10-digit mobile number
              </p>
            )}
          </div>

          <Button type="submit" disabled={pending !== null} aria-busy={pending === "otp"} className={submitButton}>
            {pending === "otp" ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden />
                Sending OTP…
              </>
            ) : (
              <>
                Get OTP
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>

          {demoMode && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setPhone(DEMO_PHONE);
                void sendOtp(DEMO_PHONE);
              }}
              className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-ring disabled:opacity-60"
            >
              <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Use demo patient, Rahul <span className="whitespace-nowrap">({formatPhone(DEMO_PHONE)})</span>
              </span>
            </button>
          )}
        </form>

        <p className="mt-8 flex items-start gap-2.5 text-small text-foreground-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          We use your number only for visit updates and reports.
        </p>
        <p className="mt-6 border-t border-border pt-6 text-small text-muted-foreground">
          Nivar doctor, nurse or admin?{" "}
          <Link
            href={next ? `/staff/login?next=${encodeURIComponent(next)}` : "/staff/login"}
            className="relative rounded-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 before:absolute before:-inset-x-2 before:-inset-y-3 hover:decoration-primary focus-ring"
          >
            Staff sign in
          </Link>
        </p>
      </div>
    );
  }

  const nameError = error?.field === "name" ? error.message : null;
  const otpError = error?.field === "otp" ? error.message : null;
  const justResent = resent && resendIn > RESEND_SECONDS - RESENT_NOTE_SECONDS;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setError(null);
        }}
        className="-ml-3 mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Change number
      </button>
      <h1 className="font-display text-[2rem] leading-tight font-semibold">
        {isNewUser ? "Create your account" : "Enter the OTP"}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        We sent a 6-digit OTP by SMS to{" "}
        <span className="tabular font-medium whitespace-nowrap text-foreground">{formatPhone(phone)}</span>
      </p>

      {demoOtp && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-2.5">
          <p className="text-small">
            <span className="text-muted-foreground">Demo OTP: </span>
            <span className="tabular font-semibold tracking-[0.2em] text-foreground">{demoOtp}</span>
          </p>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setOtp(demoOtp);
              setError(null);
              if (!isNewUser || name.trim().length >= 2) void verify(demoOtp);
            }}
            className="inline-flex min-h-11 items-center rounded-full bg-card px-4 text-sm font-semibold text-foreground shadow-soft ring-1 ring-border transition-colors hover:bg-muted focus-ring disabled:opacity-60"
          >
            Autofill
          </button>
        </div>
      )}

      <form method="post" onSubmit={onOtpSubmit} className="mt-6 flex flex-col gap-5" noValidate>
        {isNewUser && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Your full name</Label>
            <Input
              ref={nameRef}
              id="name"
              name="name"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              autoFocus
              placeholder="e.g. Rahul Mehta"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "name-error" : undefined}
              className="h-14 rounded-xl bg-card px-3.5 text-base sm:h-12 md:text-base"
            />
            {nameError && (
              <p id="name-error" role="alert" className={fieldError}>
                {nameError}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="otp">6-digit OTP</Label>
          {/* Never disabled: a disabled box drops focus and closes the keyboard. Edits made while a
              check is running are ignored instead. Pasting all six digits fills every box. */}
          <OTPField.Root
            id="otp"
            length={OTP_LENGTH}
            value={otp}
            onValueChange={(value) => {
              if (pending === "verify") return;
              setOtp(value);
              setError(null);
            }}
            className="grid grid-cols-6 gap-2 sm:gap-2.5"
          >
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <OTPField.Input
                key={i}
                autoFocus={i === 0 && !isNewUser}
                aria-label={i === 0 ? undefined : `Digit ${i + 1} of ${OTP_LENGTH}`}
                aria-invalid={otpError ? true : undefined}
                aria-describedby={otpError ? "otp-error" : undefined}
                className={cn(
                  "tabular h-14 w-full min-w-0 rounded-xl border border-input bg-card text-center text-[1.375rem] font-semibold text-foreground caret-primary transition-[box-shadow,border-color] outline-none focus:border-ring focus:ring-3 focus:ring-ring/25",
                  otpError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                )}
              />
            ))}
          </OTPField.Root>
          {otpError && (
            <p id="otp-error" role="alert" className={fieldError}>
              {otpError}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending !== null} aria-busy={pending === "verify"} className={submitButton}>
          {pending === "verify" ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden />
              Checking…
            </>
          ) : isNewUser ? (
            "Create account"
          ) : (
            "Verify and continue"
          )}
        </Button>

        <div className="flex min-h-11 flex-col items-center justify-center text-center text-sm text-muted-foreground">
          <p role="status">{justResent ? "We sent a new OTP." : ""}</p>
          {justResent ? null : resendIn > 0 ? (
            <p>
              Resend OTP in{" "}
              <span className="tabular font-medium text-foreground">0:{String(resendIn).padStart(2, "0")}</span>
            </p>
          ) : (
            <button
              type="button"
              disabled={pending !== null}
              aria-busy={pending === "otp"}
              onClick={() => void sendOtp(phone, true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-medium text-primary underline underline-offset-4 focus-ring disabled:opacity-50"
            >
              {pending === "otp" && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              Resend OTP
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
