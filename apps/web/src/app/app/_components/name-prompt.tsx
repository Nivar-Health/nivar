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
    if (!name.trim()) return;
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
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px]" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 shadow-2xl outline-none">
          <LogoMark className="size-11" />
          <DialogPrimitive.Title className="mt-4 font-display text-2xl leading-tight font-medium tracking-tight">
            Welcome to Nivar
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            What should we call you? Your nurse and doctor will see this name.
          </DialogPrimitive.Description>
          <form onSubmit={save} className="mt-5 space-y-3">
            <label htmlFor="welcome-name" className="sr-only">
              Your full name
            </label>
            <Input
              id="welcome-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              maxLength={80}
              className="h-12 rounded-xl px-3.5 text-[15px] md:text-[15px]"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={saving || !name.trim()} className="h-12 w-full rounded-xl text-[15px] font-semibold">
              {saving && <LoaderCircle className="animate-spin" aria-hidden />} Continue
            </Button>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
