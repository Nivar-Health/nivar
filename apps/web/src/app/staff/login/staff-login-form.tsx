"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, ShieldUser, Stethoscope, UserRoundCog } from "lucide-react";
import { SignedInNotice } from "@/components/signed-in-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { homePathForRole, safeNextPath, useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEMO_PASSWORD = "nivar123";

const DEMO_ACCOUNTS = [
  { role: "Admin", name: "Operations", email: "admin@nivar.health", icon: UserRoundCog },
  { role: "Doctor", name: "Dr. Ananya Rao", email: "ananya@nivar.health", icon: Stethoscope },
  { role: "Nurse", name: "Priya Nair", email: "priya@nivar.health", icon: ShieldUser },
] as const;

function destinationFor(user: User, next: string | null): string {
  const home = homePathForRole(user.role);
  const safe = safeNextPath(next);
  return safe && (safe === home || safe.startsWith(`${home}/`)) ? safe : home;
}

export function StaffLoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const { loginStaff, logout } = useAuth();
  const submitRef = useRef<HTMLButtonElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your work email and password.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const user = await loginStaff(email.trim().toLowerCase(), password);
      if (user.role === "customer") {
        logout();
        setError("This sign in is for Nivar staff. Patients sign in with their mobile number.");
        setPending(false);
        return;
      }
      router.replace(destinationFor(user, next));
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign you in. Please try again."));
      setPending(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
    submitRef.current?.focus();
  };

  return (
    <div>
      <SignedInNotice roles={["admin", "doctor", "nurse"]} />
      <h2 className="font-display text-[2rem] leading-tight font-medium tracking-tight">Staff sign in</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">Use your Nivar work account.</p>

      <div className="mt-7">
        <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Demo accounts
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((acc) => {
            const selected = email === acc.email;
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                aria-pressed={selected}
                title={`${acc.name} (${acc.email})`}
                className={cn(
                  "group flex min-w-0 flex-col items-start gap-2 rounded-xl border bg-card p-2.5 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  selected
                    ? "border-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_14%,transparent)]"
                    : "border-border hover:border-primary/40 hover:shadow-soft",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-lg transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                  )}
                >
                  <acc.icon className="size-4" />
                </span>
                <span className="w-full min-w-0">
                  <span className="block text-sm leading-tight font-semibold">{acc.role}</span>
                  <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                    {acc.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="you@nivar.health"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            className="h-12 rounded-xl bg-card px-3.5 text-[15px] md:text-[15px]"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "staff-error" : undefined}
              className="h-12 rounded-xl bg-card pr-11 pl-3.5 text-[15px] md:text-[15px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p id="staff-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          ref={submitRef}
          type="submit"
          disabled={pending}
          className="mt-1 h-12 w-full rounded-xl text-[15px] font-semibold shadow-lift"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        Booking a check-up?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Patient sign in
        </Link>
      </p>
    </div>
  );
}
