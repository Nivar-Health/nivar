"use client";

import { useState } from "react";
import { Check, ChevronDown, LoaderCircle, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haversineKm } from "@/components/live/geo";
import { api, errorMessage } from "@/lib/api";
import type { Address, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BANGALORE_AREAS } from "./shared";

const LABELS = ["Home", "Work", "Parents", "Other"];

export type AddressDraft = Omit<Address, "id"> & { id?: string };

/** Saves a new address onto the user's profile and returns the updated user. */
export async function saveNewAddress(user: User, draft: AddressDraft): Promise<User> {
  const addresses = [...(user.addresses ?? []), draft];
  const { user: next } = await api.patch<{ user: User }>("/me", { addresses });
  return next;
}

export const selectClass =
  "h-11 w-full appearance-none rounded-xl border border-input bg-card pr-10 pl-3.5 text-[15px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const inputClass = "h-11 rounded-xl bg-card px-3.5 text-[15px] md:text-[15px]";

/** New address form: label, house + street, area (Bangalore), pincode, optional GPS. */
export function AddressForm({
  onSave,
  onCancel,
  submitLabel = "Save address",
  cancelLabel = "Cancel",
}: {
  onSave: (draft: AddressDraft) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const areaInfo = BANGALORE_AREAS.find((a) => a.name === area);
  const pinValid = pincode === "" || /^\d{6}$/.test(pincode);
  const valid = line1.trim().length > 3 && Boolean(area) && pinValid;

  const useLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Location is not available on this device. Pick your area instead.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(here);
        // Fill the nearest known area (within Bangalore) to help the form along.
        const nearest = BANGALORE_AREAS.map((a) => ({ a, km: haversineKm(here, a) })).sort((x, y) => x.km - y.km)[0];
        if (nearest && nearest.km < 8) {
          setArea((prev) => prev || nearest.a.name);
          setPincode((prev) => prev || nearest.a.pincode);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Pick your area and we will use its centre."
            : "Couldn't get your location. Pick your area instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const point = coords ?? (areaInfo ? { lat: areaInfo.lat, lng: areaInfo.lng } : undefined);
      await onSave({
        label: label.trim() || "Home",
        line1: line1.trim(),
        area,
        city: "Bangalore",
        pincode: pincode.trim(),
        lat: point?.lat ?? 12.9716,
        lng: point?.lng ?? 77.5946,
      });
    } catch (err) {
      setError(errorMessage(err, "Couldn't save this address."));
      setSaving(false);
    }
  };

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <button
        type="button"
        onClick={useLocation}
        disabled={locating}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          coords ? "border-foreground bg-muted" : "border-input bg-card hover:bg-muted",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground">
          {locating ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : coords ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <LocateFixed className="size-4" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {coords ? "Location captured" : locating ? "Finding you..." : "Use my current location"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {coords
              ? `GPS ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} so your nurse finds you faster`
              : "Helps your nurse navigate to your door"}
          </span>
        </span>
      </button>
      {locError && <p className="-mt-2 text-xs text-saffron">{locError}</p>}

      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground">Save as</span>
        <div className="flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLabel(l)}
              aria-pressed={label === l}
              className={cn(
                "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
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
        <label htmlFor="addr-line1" className="block text-xs font-medium text-muted-foreground">
          Flat / house no., building, street
        </label>
        <Input
          id="addr-line1"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Flat 12B, Prestige Lakeside"
          aria-invalid={touched && line1.trim().length <= 3 ? true : undefined}
          className={inputClass}
          autoComplete="street-address"
        />
      </div>

      <div className="grid grid-cols-[1fr_8.5rem] gap-3">
        <div className="space-y-1.5">
          <label htmlFor="addr-area" className="block text-xs font-medium text-muted-foreground">
            Area
          </label>
          <div className="relative">
            <select
              id="addr-area"
              value={area}
              onChange={(e) => {
                const next = e.target.value;
                setArea(next);
                const info = BANGALORE_AREAS.find((a) => a.name === next);
                if (info && (!pincode || BANGALORE_AREAS.some((a) => a.pincode === pincode))) setPincode(info.pincode);
              }}
              aria-invalid={touched && !area ? true : undefined}
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
        </div>
        <div className="space-y-1.5">
          <label htmlFor="addr-pin" className="block text-xs font-medium text-muted-foreground">
            Pincode
          </label>
          <Input
            id="addr-pin"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="560038"
            aria-invalid={!pinValid ? true : undefined}
            className={cn(inputClass, "tabular")}
            autoComplete="postal-code"
          />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5" aria-hidden /> Bangalore, Karnataka. We currently serve these areas.
      </p>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-background px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="h-11 flex-1 rounded-xl text-sm">
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={saving} className="h-11 flex-1 rounded-xl text-sm font-semibold">
          {saving && <LoaderCircle className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
