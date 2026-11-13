"use client";

import { useId, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haversineKm } from "@/components/live/geo";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SITE } from "@/lib/site-facts";
import type { Address, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BANGALORE_AREAS } from "./shared";

const LABELS = ["Home", "Work", "Parents", "Other"];

/** A phone's location is kept only when it is this close to the centre of the chosen area. */
const MAX_KM_FROM_AREA = 5;
/** With no area chosen yet, the nearest area we know is filled in when it is this close. */
const MAX_KM_TO_NEAREST = 8;

export type AddressDraft = Omit<Address, "id"> & { id?: string };

/** Saves a new address onto the user's profile and returns the updated user. */
export async function saveNewAddress(user: User, draft: AddressDraft): Promise<User> {
  const addresses = [...(user.addresses ?? []), draft];
  const { user: next } = await api.patch<{ user: User }>("/me", { addresses });
  return next;
}

/** Saves a correction to one of the user's saved addresses and returns the updated user. */
export async function saveEditedAddress(user: User, id: string, draft: AddressDraft): Promise<User> {
  const addresses = (user.addresses ?? []).map((a) => (a.id === id ? { ...draft, id } : a));
  const { user: next } = await api.patch<{ user: User }>("/me", { addresses });
  return next;
}

// 16px text: a smaller field makes iPhones zoom the page on focus and leave it zoomed.
export const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-input bg-card pr-10 pl-3.5 text-base outline-none transition-colors focus-visible:border-ring focus-ring";

export const inputClass = "h-12 rounded-xl bg-card px-3.5 text-base md:text-base";

/** The label over a field, and the words under it when it needs fixing. */
export const fieldLabelClass = "block text-sm font-medium text-foreground";
export const fieldErrorClass = "text-small font-medium text-destructive";

type Field = "line1" | "area" | "pincode";

/**
 * Address form: label, house and street, area, pincode and, only when the person says they are at
 * the address, the phone's location. Pass `initial` to correct a saved address.
 */
export function AddressForm({
  onSave,
  onCancel,
  submitLabel = "Save address",
  cancelLabel = "Cancel",
  initial,
  formId,
  hideSubmit = false,
}: {
  onSave: (draft: AddressDraft) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  initial?: AddressDraft;
  /** Lets a button outside the form submit it (`<button type="submit" form={formId}>`). */
  formId?: string;
  /** Hide the form's own buttons when an outside button submits it. */
  hideSubmit?: boolean;
}) {
  const { user } = useAuth();
  const uid = useId();
  // A second address should not be another "Home": start on the first name not in use.
  const [label, setLabel] = useState(() => {
    if (initial?.label) return initial.label;
    const used = new Set((user?.addresses ?? []).map((a) => a.label));
    return LABELS.find((l) => !used.has(l)) ?? "Other";
  });
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");
  // A saved pin is kept while the area stays the same; a new one is taken only on request.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const refs = useRef<Partial<Record<Field, HTMLElement | null>>>({});

  const areaInfo = BANGALORE_AREAS.find((a) => a.name === area);
  const problems: Partial<Record<Field, string>> = {};
  if (line1.trim().length <= 3) problems.line1 = "Add the flat or house number and street.";
  if (!area) problems.area = "Choose your area.";
  if (pincode !== "" && !/^\d{6}$/.test(pincode)) problems.pincode = "A pincode has 6 digits.";
  const firstProblem = (["line1", "area", "pincode"] as const).find((f) => problems[f]);
  const shown = (f: Field) => (touched ? problems[f] : undefined);

  const tooFar = (name: string) => `That location is far from ${name}, so we will use the area instead.`;

  const useLocation = () => {
    if (!navigator.geolocation) {
      setLocNote("Location is not available on this device. Pick your area instead.");
      return;
    }
    setLocating(true);
    setLocNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (areaInfo) {
          // The person may be somewhere else (booking for a parent): never pin the nurse there.
          if (haversineKm(here, areaInfo) > MAX_KM_FROM_AREA) setLocNote(tooFar(areaInfo.name));
          else setCoords(here);
          return;
        }
        const nearest = BANGALORE_AREAS.map((a) => ({ a, km: haversineKm(here, a) })).sort((x, y) => x.km - y.km)[0];
        if (nearest && nearest.km < MAX_KM_TO_NEAREST) {
          // The area is a good guess a little further out; the pin itself only when it is close.
          if (nearest.km <= MAX_KM_FROM_AREA) setCoords(here);
          else setLocNote(tooFar(nearest.a.name));
          setArea(nearest.a.name);
          setPincode((prev) => prev || nearest.a.pincode);
        } else {
          setLocNote("That location is outside the areas listed here. Choose the area of the home below instead.");
        }
      },
      (err) => {
        setLocating(false);
        setLocNote(
          err.code === err.PERMISSION_DENIED
            ? "Location is switched off for this site. Choose your area below instead."
            : "Couldn't get your location. Pick your area instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const onArea = (next: string) => {
    setArea(next);
    const info = BANGALORE_AREAS.find((a) => a.name === next);
    if (info && (!pincode || BANGALORE_AREAS.some((a) => a.pincode === pincode))) setPincode(info.pincode);
    // A pin taken for one area must not follow the address to another.
    if (info && coords && haversineKm(coords, info) > MAX_KM_FROM_AREA) {
      setCoords(null);
      setLocNote(tooFar(info.name));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (saving) return;
    if (firstProblem) {
      const el = refs.current[firstProblem];
      el?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Correcting an address keeps its saved pin while the area is unchanged.
      const kept = initial && initial.area === area ? { lat: initial.lat, lng: initial.lng } : undefined;
      const point = coords ?? kept ?? (areaInfo ? { lat: areaInfo.lat, lng: areaInfo.lng } : undefined);
      await onSave({
        label: label.trim() || "Home",
        line1: line1.trim(),
        area,
        city: initial?.city ?? "Bangalore",
        pincode: pincode.trim(),
        lat: point?.lat ?? 12.9716,
        lng: point?.lng ?? 77.5946,
      });
    } catch (err) {
      setError(errorMessage(err, "Couldn't save this address."));
      setSaving(false);
    }
  };

  const id = (name: string) => `${uid}-${name}`;

  return (
    <form id={formId} method="post" onSubmit={submit} className="space-y-4" noValidate>
      {coords ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary bg-muted px-3.5 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground">
            <Check className="size-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1">
            <span className="block text-small font-semibold text-foreground">Location added</span>
            <span className="block text-small text-foreground-2">Your nurse will see this pin.</span>
          </p>
          <button
            type="button"
            onClick={() => setCoords(null)}
            className="-mr-1.5 inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-foreground underline underline-offset-4 outline-none focus-ring"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={useLocation}
          disabled={locating}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-input bg-card px-3.5 py-3 text-left transition-colors outline-none hover:bg-muted focus-ring"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground">
            {locating ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-small font-semibold text-foreground">
              {locating ? "Finding your location…" : "I am at this address now"}
            </span>
            <span className="block text-small text-foreground-2">
              Use my phone&apos;s location to help the nurse find the door.
            </span>
          </span>
        </button>
      )}
      {locNote && (
        <p role="status" className="-mt-1.5 text-small text-warning-ink">
          {locNote}
        </p>
      )}

      <div className="space-y-1.5">
        <span id={id("label")} className={fieldLabelClass}>
          Save as
        </span>
        <div role="group" aria-labelledby={id("label")} className="flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLabel(l)}
              aria-pressed={label === l}
              className={cn(
                "h-11 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-ring",
                label === l
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={id("line1")} className={fieldLabelClass}>
          Flat / house no., building, street
        </label>
        <Input
          id={id("line1")}
          ref={(el) => {
            refs.current.line1 = el;
          }}
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Flat 12B, Prestige Lakeside"
          aria-invalid={shown("line1") ? true : undefined}
          aria-describedby={shown("line1") ? id("line1-error") : undefined}
          className={inputClass}
          autoComplete="street-address"
          enterKeyHint="next"
        />
        {shown("line1") && (
          <p id={id("line1-error")} className={fieldErrorClass}>
            {problems.line1}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem] sm:gap-3">
        <div className="space-y-1.5">
          <label htmlFor={id("area")} className={fieldLabelClass}>
            Area
          </label>
          <div className="relative">
            <select
              id={id("area")}
              ref={(el) => {
                refs.current.area = el;
              }}
              value={area}
              onChange={(e) => onArea(e.target.value)}
              aria-invalid={shown("area") ? true : undefined}
              aria-describedby={shown("area") ? id("area-error") : undefined}
              className={cn(selectClass, !area && "text-muted-foreground", "aria-invalid:border-destructive")}
            >
              <option value="" disabled>
                Select area
              </option>
              {BANGALORE_AREAS.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          </div>
          {shown("area") && (
            <p id={id("area-error")} className={fieldErrorClass}>
              {problems.area}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id("pin")} className={fieldLabelClass}>
            Pincode
          </label>
          <Input
            id={id("pin")}
            ref={(el) => {
              refs.current.pincode = el;
            }}
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="560102"
            aria-invalid={shown("pincode") ? true : undefined}
            aria-describedby={shown("pincode") ? id("pin-error") : undefined}
            className={cn(inputClass, "tabular w-36 sm:w-full")}
            autoComplete="postal-code"
            enterKeyHint="done"
          />
          {shown("pincode") && (
            <p id={id("pin-error")} className={fieldErrorClass}>
              {problems.pincode}
            </p>
          )}
        </div>
      </div>
      <p className="flex items-start gap-2 text-small text-foreground-2">
        <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
        <span>
          We visit homes in {SITE.area}, {SITE.city}.
        </span>
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-background px-3.5 py-2.5 text-small text-destructive">
          {error}
        </p>
      )}

      {!hideSubmit && (
        // Phones: the main action first and full width, the way out below it. Wider: side by side.
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} className="h-12 w-full rounded-full text-small sm:w-auto sm:flex-1">
              {cancelLabel}
            </Button>
          )}
          <Button type="submit" disabled={saving} className="h-14 w-full rounded-full text-base font-semibold sm:h-12 sm:w-auto sm:flex-1 sm:text-small">
            {saving && <LoaderCircle className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      )}
      {hideSubmit && onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} className="h-12 w-full rounded-full text-small">
          {cancelLabel}
        </Button>
      )}
    </form>
  );
}
