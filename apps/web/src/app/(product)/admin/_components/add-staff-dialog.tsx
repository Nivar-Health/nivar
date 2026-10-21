"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { StaffMember } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Nivar hubs nurses start their day from (Bangalore neighbourhood centroids). */
export const HUBS = [
  { label: "Nivar Hub, HSR Layout", lat: 12.9116, lng: 77.6474 },
  { label: "Nivar Hub, Koramangala", lat: 12.9352, lng: 77.6245 },
  { label: "Nivar Hub, Indiranagar", lat: 12.9719, lng: 77.6412 },
  { label: "Nivar Hub, Whitefield", lat: 12.9698, lng: 77.75 },
  { label: "Nivar Hub, Jayanagar", lat: 12.9308, lng: 77.5838 },
  { label: "Nivar Hub, Malleshwaram", lat: 13.0035, lng: 77.571 },
  { label: "Nivar Hub, Hebbal", lat: 13.0358, lng: 77.597 },
];

const SPECIALIZATIONS = ["General Physician", "Cardiologist", "Diabetologist", "Internal Medicine", "Geriatrician"];

type Role = "nurse" | "doctor";

interface Form {
  name: string;
  email: string;
  phone: string;
  password: string;
  qualifications: string;
  yearsExperience: string;
  hub: string;
  specialization: string;
  registrationNo: string;
}

const EMPTY: Form = {
  name: "",
  email: "",
  phone: "",
  password: "",
  qualifications: "",
  yearsExperience: "",
  hub: HUBS[0].label,
  specialization: SPECIALIZATIONS[0],
  registrationNo: "",
};

function validate(f: Form, role: Role): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.name.trim()) e.name = "Name is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email";
  const digits = f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  if (f.phone.trim() && !/^[6-9]\d{9}$/.test(digits)) e.phone = "Enter a 10 digit Indian mobile number";
  if (f.password.length < 6) e.password = "At least 6 characters";
  if (f.yearsExperience && !(Number(f.yearsExperience) >= 0 && Number(f.yearsExperience) <= 60))
    e.yearsExperience = "0 to 60 years";
  if (role === "doctor" && !f.registrationNo.trim()) e.registrationNo = "Medical council registration is required";
  return e;
}

function Field({
  label,
  error,
  children,
  htmlFor,
  hint,
  className,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  htmlFor: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Remount (change `key`) on each open to start from a blank form. */
export function AddStaffDialog({
  open,
  onOpenChange,
  defaultRole,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole: Role;
  onCreated: (member: StaffMember) => void;
}) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = touched ? validate(form, role) : {};

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (Object.keys(validate(form, role)).length) return;
    setSaving(true);
    const hub = HUBS.find((h) => h.label === form.hub);
    const body = {
      role,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim() || undefined,
      qualifications: form.qualifications.trim() || undefined,
      yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
      ...(role === "nurse"
        ? { baseLocation: hub ? { lat: hub.lat, lng: hub.lng, label: hub.label } : undefined }
        : { specialization: form.specialization, registrationNo: form.registrationNo.trim() }),
    };
    try {
      const res = await api.post<{ staff: StaffMember }>("/admin/staff", body);
      toast.success(`${res.staff.name} added`, {
        description: `They can sign in at /staff/login with ${res.staff.email}.`,
      });
      onCreated(res.staff);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError && (err.status === 409 || /duplicate|exists/i.test(err.message))
          ? "Someone already uses this email or phone number."
          : errorMessage(err);
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
        <form method="post" onSubmit={submit} noValidate>
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-lg">Add staff member</DialogTitle>
            <DialogDescription>Full-time Nivar employees only. They sign in with this email and password.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
              {(["nurse", "doctor"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    role === r ? "border-foreground bg-muted text-foreground" : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-lg [&_svg]:size-4",
                      role === r ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {r === "nurse" ? <UserRound /> : <Stethoscope />}
                  </span>
                  {r === "nurse" ? "Nurse" : "Doctor"}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="s-name" error={errors.name} className="sm:col-span-2">
                <Input id="s-name" value={form.name} onChange={set("name")} placeholder={role === "doctor" ? "Dr. Kiran Rao" : "Anjali Menon"} aria-invalid={!!errors.name} className="h-9" autoComplete="off" />
              </Field>
              <Field label="Work email" htmlFor="s-email" error={errors.email}>
                <Input id="s-email" type="email" value={form.email} onChange={set("email")} placeholder="name@nivar.health" aria-invalid={!!errors.email} className="h-9" autoComplete="off" />
              </Field>
              <Field label="Mobile" htmlFor="s-phone" error={errors.phone} hint=" (optional)">
                <Input id="s-phone" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="98450 12345" aria-invalid={!!errors.phone} className="h-9" autoComplete="off" />
              </Field>
              <Field label="Temporary password" htmlFor="s-password" error={errors.password}>
                <Input id="s-password" type="text" value={form.password} onChange={set("password")} placeholder="At least 6 characters" aria-invalid={!!errors.password} className="h-9" autoComplete="new-password" />
              </Field>
              <Field label="Experience" htmlFor="s-exp" error={errors.yearsExperience} hint=" (years)">
                <Input id="s-exp" type="number" min={0} max={60} value={form.yearsExperience} onChange={set("yearsExperience")} placeholder="5" aria-invalid={!!errors.yearsExperience} className="h-9" />
              </Field>
              <Field label="Qualifications" htmlFor="s-qual" className="sm:col-span-2">
                <Input
                  id="s-qual"
                  value={form.qualifications}
                  onChange={set("qualifications")}
                  placeholder={role === "doctor" ? "MBBS, MD (General Medicine)" : "B.Sc Nursing, BLS certified"}
                  className="h-9"
                />
              </Field>
              {role === "nurse" ? (
                <Field label="Home hub" htmlFor="s-hub" className="sm:col-span-2">
                  <Select value={form.hub} onValueChange={(v) => v && setForm((f) => ({ ...f, hub: v as string }))}>
                    <SelectTrigger id="s-hub" className="h-9 w-full">
                      <SelectValue>{(v: string) => v.replace("Nivar Hub, ", "")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {HUBS.map((h) => (
                        <SelectItem key={h.label} value={h.label}>
                          {h.label.replace("Nivar Hub, ", "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <>
                  <Field label="Specialization" htmlFor="s-spec">
                    <Select value={form.specialization} onValueChange={(v) => v && setForm((f) => ({ ...f, specialization: v as string }))}>
                      <SelectTrigger id="s-spec" className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPECIALIZATIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Registration no." htmlFor="s-reg" error={errors.registrationNo}>
                    <Input id="s-reg" value={form.registrationNo} onChange={set("registrationNo")} placeholder="KMC 12345" aria-invalid={!!errors.registrationNo} className="h-9" />
                  </Field>
                </>
              )}
            </div>
            {serverError && (
              <p className="rounded-lg bg-destructive/8 px-3 py-2 text-[13px] text-destructive">{serverError}</p>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 px-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-w-32">
              {saving && <Loader2 className="animate-spin" />}
              Add {role}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
