"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { CircleCheck, House, LoaderCircle, LogOut, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateLong, formatPhone } from "@/lib/format";
import type { Address, Gender, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { todayIST } from "@/server/time";
import {
  AddressForm,
  fieldErrorClass,
  fieldLabelClass,
  inputClass,
  saveEditedAddress,
  saveNewAddress,
} from "./address-form";
import { SHEET_BACKDROP, SHEET_POPUP, useBackToClose } from "./checkout-dialog";
import { GENDER_LABEL, HelpCard, PersonAvatar, SectionTitle, Surface, ageFromDob } from "./shared";

/** Round icon buttons a thumb can hit (44px). */
const iconButton = "size-11 shrink-0 rounded-full";

const addressAction =
  "flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-foreground-2 transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset";

export function ProfileView() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  /** The address form that is open: a new address, or the id of the saved one being corrected. */
  const [addressForm, setAddressForm] = useState<"new" | string | null>(null);
  const [toDelete, setToDelete] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useBackToClose(Boolean(toDelete), () => {
    if (deleting) return false;
    setToDelete(null);
  });

  if (!user) return null;
  const addresses = user.addresses ?? [];

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingName) return;
    if (!name.trim()) {
      setNameError("Enter your name.");
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const { user: next } = await api.patch<{ user: User }>("/me", { name: name.trim() });
      setUser(next);
      setEditingName(false);
      toast.success("Name updated");
    } catch (err) {
      // Shown under the field, with what was typed still in it.
      setNameError(`Couldn't update your name. ${errorMessage(err)}`);
    } finally {
      setSavingName(false);
    }
  };

  const deleteAddress = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { user: next } = await api.patch<{ user: User }>("/me", {
        addresses: addresses.filter((a) => a.id !== toDelete.id),
      });
      setUser(next);
      setToDelete(null);
      toast("Address removed");
    } catch (err) {
      setDeleteError(`Couldn't remove the address. ${errorMessage(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  const signOut = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="space-y-7">
      <h1 className="font-display text-[1.75rem] leading-tight font-semibold md:text-3xl">Profile</h1>

      <Surface className="p-4 sm:p-5">
        {editingName ? (
          <form method="post" onSubmit={saveName} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className={fieldLabelClass}>
                Your name
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                autoFocus
                maxLength={80}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="done"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "profile-name-error" : undefined}
                className={inputClass}
              />
              {nameError && (
                <p id="profile-name-error" role="alert" className={fieldErrorClass}>
                  {nameError}
                </p>
              )}
            </div>
            {/* Phones: Save first and full width, Cancel below it. Wider: side by side. */}
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingName(false)}
                className="h-12 w-full rounded-full text-small sm:w-auto sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingName}
                aria-busy={savingName}
                className="h-14 w-full rounded-full text-base font-semibold sm:h-12 sm:w-auto sm:flex-1 sm:text-small"
              >
                {savingName && <LoaderCircle className="animate-spin" aria-hidden />} Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-4">
            <PersonAvatar name={user.name || "?"} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{user.name || "Add your name"}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-small text-foreground-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="tabular whitespace-nowrap">{formatPhone(user.phone)}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
                Number verified
              </p>
            </div>
            <Button
              variant="outline"
              aria-label="Edit name"
              onClick={() => {
                setName(user.name);
                setNameError(null);
                setEditingName(true);
              }}
              className={iconButton}
            >
              <Pencil aria-hidden />
            </Button>
          </div>
        )}
      </Surface>

      <DetailsCard user={user} onSaved={setUser} />

      <section aria-labelledby="profile-addresses">
        <SectionTitle id="profile-addresses">Saved addresses</SectionTitle>
        <div className="space-y-2.5">
          {addresses.map((a) =>
            addressForm === a.id ? (
              <Surface key={a.id} className="p-4 sm:p-5">
                <p className="mb-4 text-small font-semibold">Edit this address</p>
                <AddressForm
                  initial={a}
                  onCancel={() => setAddressForm(null)}
                  onSave={async (draft) => {
                    setUser(await saveEditedAddress(user, a.id, draft));
                    setAddressForm(null);
                    toast.success("Address saved");
                  }}
                />
              </Surface>
            ) : (
              <Surface key={a.id} className="overflow-hidden">
                <div className="flex items-start gap-3.5 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
                    <House className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 text-small">
                    <p className="font-semibold">{a.label || "Home"}</p>
                    <p className="mt-0.5 text-foreground-2">{a.line1}</p>
                    <p className="text-foreground-2">{[a.area, a.city, a.pincode].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
                {/* Named buttons on a row of their own: the address keeps the card's full width. */}
                <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                  <button
                    type="button"
                    aria-label={`Edit ${a.label || "Home"} address`}
                    onClick={() => setAddressForm(a.id)}
                    className={addressAction}
                  >
                    <Pencil className="size-4 shrink-0" aria-hidden /> Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${a.label || "Home"} address`}
                    onClick={() => {
                      setDeleteError(null);
                      setToDelete(a);
                    }}
                    className={addressAction}
                  >
                    <Trash2 className="size-4 shrink-0" aria-hidden /> Remove
                  </button>
                </div>
              </Surface>
            ),
          )}
          {addressForm === "new" ? (
            <Surface className="p-4 sm:p-5">
              <p className="mb-4 text-small font-semibold">Add a new address</p>
              <AddressForm
                onCancel={() => setAddressForm(null)}
                onSave={async (draft) => {
                  setUser(await saveNewAddress(user, draft));
                  setAddressForm(null);
                  toast.success("Address saved");
                }}
              />
            </Surface>
          ) : (
            <button
              type="button"
              onClick={() => setAddressForm("new")}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-input p-4 text-left text-small font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="grid size-10 place-items-center rounded-xl border border-border bg-card text-primary">
                <Plus className="size-[18px]" aria-hidden />
              </span>
              Add new address
            </button>
          )}
        </div>
      </section>

      {/* scroll-mt: the account menu links here, and the sticky header must not cover the title. */}
      <section id="help" aria-labelledby="profile-help" className="scroll-mt-20 md:scroll-mt-24">
        <SectionTitle id="profile-help">Help</SectionTitle>
        <HelpCard />
      </section>

      <Button
        variant="outline"
        onClick={signOut}
        className="h-12 w-full rounded-full border-border bg-card text-small font-semibold"
      >
        <LogOut aria-hidden /> Sign out
      </Button>

      {/* The same sheet as cancelling a visit: from the bottom on phones, opening on "Keep address". */}
      <DialogPrimitive.Root
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && !deleting && setToDelete(null)}
        disablePointerDismissal={deleting}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className={SHEET_BACKDROP} />
          <DialogPrimitive.Popup className={SHEET_POPUP} initialFocus={keepRef}>
            <div className="overflow-y-auto px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pt-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
              <DialogPrimitive.Title className="text-lg leading-snug font-semibold">Remove this address?</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1.5 text-small text-foreground-2">
                {toDelete?.label || "Home"}: {toDelete?.line1}. Past bookings keep their address.
              </DialogPrimitive.Description>
              {deleteError && (
                <p role="alert" className={cn("mt-4", fieldErrorClass)}>
                  {deleteError}
                </p>
              )}
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                <Button
                  variant="destructive"
                  onClick={deleteAddress}
                  disabled={deleting}
                  aria-busy={deleting}
                  className="h-12 w-full rounded-full text-small font-semibold sm:order-2"
                >
                  {deleting && <LoaderCircle className="animate-spin" aria-hidden />} Remove
                </Button>
                <Button
                  ref={keepRef}
                  variant="outline"
                  onClick={() => setToDelete(null)}
                  disabled={deleting}
                  className="h-12 w-full rounded-full text-small font-semibold sm:order-1"
                >
                  Keep address
                </Button>
              </div>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

const GENDERS = Object.keys(GENDER_LABEL) as Gender[];

/**
 * Date of birth and gender: the booking form fills them in for "Myself", so they are asked once
 * here rather than on every booking. Both are optional.
 */
function DetailsCard({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
  const [editing, setEditing] = useState(false);
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedDob = user.dob?.slice(0, 10) ?? "";
  const age = ageFromDob(savedDob);

  const startEditing = () => {
    setDob(savedDob);
    setGender(user.gender ?? "");
    setError(null);
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (dob && (dob > todayIST() || ageFromDob(dob) === null)) {
      setError("Check the date of birth. It cannot be in the future or more than 120 years ago.");
      document.getElementById("profile-dob")?.focus();
      return;
    }
    const body: { dob?: string | null; gender?: Gender } = {};
    if (dob !== savedDob) body.dob = dob || null;
    if (gender && gender !== user.gender) body.gender = gender;
    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { user: next } = await api.patch<{ user: User }>("/me", body);
      onSaved(next);
      setEditing(false);
      toast.success("Details saved");
    } catch (err) {
      // Shown in the form, with what was chosen still in it.
      setError(`Couldn't save your details. ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profile-details">
      <SectionTitle id="profile-details">Your details</SectionTitle>
      <Surface className="p-4 sm:p-5">
        {editing ? (
          <form method="post" onSubmit={save} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="profile-dob" className={fieldLabelClass}>
                Date of birth
              </label>
              <Input
                id="profile-dob"
                type="date"
                value={dob}
                min="1900-01-01"
                max={todayIST()}
                autoComplete="bday"
                onChange={(e) => {
                  setDob(e.target.value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "profile-details-error" : undefined}
                className={inputClass}
              />
            </div>
            <fieldset>
              <legend className={fieldLabelClass}>Gender</legend>
              {/* Native radios: arrow keys move between them, and the chosen one shows in the brand colour. */}
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {GENDERS.map((g) => (
                  <label
                    key={g}
                    className={cn(
                      "flex h-12 cursor-pointer items-center justify-center rounded-full border border-input bg-card text-small font-medium transition-colors",
                      "has-checked:border-primary has-checked:bg-accent has-checked:font-semibold has-checked:text-primary",
                      "has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="profile-gender"
                      value={g}
                      checked={gender === g}
                      onChange={() => {
                        setGender(g);
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    {GENDER_LABEL[g]}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && (
              <p id="profile-details-error" role="alert" className={fieldErrorClass}>
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                className="h-12 w-full rounded-full text-small sm:w-auto sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="h-14 w-full rounded-full text-base font-semibold sm:h-12 sm:w-auto sm:flex-1 sm:text-small"
              >
                {saving && <LoaderCircle className="animate-spin" aria-hidden />} Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-2.5">
              <dl className="space-y-2.5 text-small">
                <div>
                  <dt className="text-sm text-muted-foreground">Date of birth</dt>
                  <dd className="font-medium">
                    {savedDob ? (
                      <>
                        {formatDateLong(savedDob)}
                        {age !== null && <span className="text-foreground-2"> ({age} years)</span>}
                      </>
                    ) : (
                      <span className="text-foreground-2">Not added</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Gender</dt>
                  <dd className="font-medium">
                    {user.gender ? GENDER_LABEL[user.gender] : <span className="text-foreground-2">Not added</span>}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">Used to fill in your bookings.</p>
            </div>
            <Button
              variant="outline"
              onClick={startEditing}
              aria-label="Edit your details"
              className="h-11 shrink-0 rounded-full px-4 text-sm font-semibold"
            >
              <Pencil aria-hidden /> Edit
            </Button>
          </div>
        )}
      </Surface>
    </section>
  );
}
