"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { House, LoaderCircle, LogOut, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPhone } from "@/lib/format";
import type { Address, User } from "@/lib/types";
import { AddressForm, inputClass, saveNewAddress } from "./address-form";
import { PersonAvatar, SectionTitle, Surface } from "./shared";

export function ProfileView() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;
  const addresses = user.addresses ?? [];

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingName(true);
    try {
      const { user: next } = await api.patch<{ user: User }>("/me", { name: name.trim() });
      setUser(next);
      setEditingName(false);
      toast.success("Name updated");
    } catch (err) {
      toast.error("Couldn't update your name", { description: errorMessage(err) });
    } finally {
      setSavingName(false);
    }
  };

  const deleteAddress = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const { user: next } = await api.patch<{ user: User }>("/me", {
        addresses: addresses.filter((a) => a.id !== toDelete.id),
      });
      setUser(next);
      setToDelete(null);
      toast("Address removed");
    } catch (err) {
      toast.error("Couldn't remove the address", { description: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  };

  const signOut = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-tight md:text-3xl">Profile</h1>

      <Surface className="p-4 sm:p-5">
        {editingName ? (
          <form onSubmit={saveName} className="space-y-3">
            <label htmlFor="profile-name" className="block text-xs font-medium text-muted-foreground">
              Your name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
              autoComplete="name"
              className={inputClass}
            />
            <div className="flex gap-2.5">
              <Button type="button" variant="outline" onClick={() => setEditingName(false)} className="h-11 w-full rounded-xl sm:w-auto sm:flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={savingName || !name.trim()} className="h-11 w-full rounded-xl sm:w-auto sm:flex-1 font-semibold">
                {savingName && <LoaderCircle className="animate-spin" aria-hidden />} Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-4">
            <PersonAvatar name={user.name || "?"} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{user.name || "Add your name"}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Phone className="size-3.5" aria-hidden />
                <span className="tabular">{formatPhone(user.phone)}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10.5px] font-medium text-foreground"><span className="size-1 rounded-full bg-success" aria-hidden />Verified</span>
              </p>
            </div>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Edit name"
              onClick={() => {
                setName(user.name);
                setEditingName(true);
              }}
              className="rounded-full"
            >
              <Pencil aria-hidden />
            </Button>
          </div>
        )}
      </Surface>

      <section aria-label="Saved addresses">
        <SectionTitle>Saved addresses</SectionTitle>
        <div className="space-y-2.5">
          {addresses.map((a) => (
            <Surface key={a.id} className="flex items-start gap-3.5 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground">
                <House className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{a.label || "Home"}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{a.line1}</p>
                <p className="text-[13px] text-muted-foreground">{[a.area, a.city, a.pincode].filter(Boolean).join(", ")}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label={`Remove ${a.label} address`}
                onClick={() => setToDelete(a)}
                className="-mt-1 -mr-1 rounded-full text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden />
              </Button>
            </Surface>
          ))}
          {adding ? (
            <Surface className="p-4 sm:p-5">
              <p className="mb-4 text-sm font-semibold">Add a new address</p>
              <AddressForm
                onCancel={() => setAdding(false)}
                onSave={async (draft) => {
                  const next = await saveNewAddress(user, draft);
                  setUser(next);
                  setAdding(false);
                  toast.success("Address saved");
                }}
              />
            </Surface>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-input p-4 text-left text-sm font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="grid size-10 place-items-center rounded-xl border border-border bg-card text-foreground">
                <Plus className="size-[18px]" aria-hidden />
              </span>
              Add new address
            </button>
          )}
        </div>
      </section>

      <Button
        variant="outline"
        onClick={signOut}
        className="h-12 w-full rounded-2xl border-border bg-card text-[15px] font-semibold text-destructive hover:bg-muted hover:text-destructive"
      >
        <LogOut aria-hidden /> Sign out
      </Button>

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Remove this address?</DialogTitle>
            <DialogDescription>
              {toDelete?.label}: {toDelete?.line1}. Past bookings keep their address.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-5 -mb-5 gap-2 rounded-b-2xl border-t bg-muted/40 p-4 sm:flex-row">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting} className="h-11 w-full rounded-xl sm:w-auto sm:flex-1">
              Keep
            </Button>
            <Button onClick={deleteAddress} disabled={deleting} className="h-11 w-full rounded-xl sm:w-auto sm:flex-1 bg-destructive text-white hover:bg-destructive/90">
              {deleting && <LoaderCircle className="animate-spin" aria-hidden />} Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
