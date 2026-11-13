"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LoaderCircle } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

/** Asks first-time patients (created by OTP without a name) for their name. */
export function NamePrompt() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = Boolean(user && user.role === "customer" && !user.name?.trim());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Enter your full name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { user: next } = await api.patch<{ user: User }>("/me", { name: name.trim() });
      setUser(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} disablePointerDismissal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[2px]" />
        {/* Phones: near the top, so the button stays above the keyboard. Wider screens: centred. */}
        <DialogPrimitive.Popup className="fixed top-[12dvh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-3xl bg-card p-6 shadow-2xl outline-none sm:top-1/2 sm:-translate-y-1/2">
          <LogoMark className="size-11" />
          <DialogPrimitive.Title className="mt-4 font-display text-2xl leading-tight font-semibold">
            Welcome to Nivar
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-small text-foreground-2">
            What should we call you? Your nurse and doctor will see this name.
          </DialogPrimitive.Description>
          <form method="post" onSubmit={save} className="mt-5 space-y-3" noValidate>
            <label htmlFor="welcome-name" className="sr-only">
              Your full name
            </label>
            <Input
              id="welcome-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Your full name"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="done"
              maxLength={80}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "welcome-name-error" : undefined}
              className="h-14 rounded-xl px-3.5 text-base sm:h-12 md:text-base"
            />
            {error && (
              <p id="welcome-name-error" role="alert" className="text-small text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="h-14 w-full rounded-full text-base font-semibold sm:h-12"
            >
              {saving && <LoaderCircle className="animate-spin" aria-hidden />} Continue
            </Button>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
