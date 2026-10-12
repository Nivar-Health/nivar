"use client";

import { useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { Package, Service, ServiceCode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Form {
  name: string;
  tagline: string;
  description: string;
  price: string;
  mrp: string;
  serviceCodes: ServiceCode[];
  popular: boolean;
  isActive: boolean;
}

function fromPackage(p: Package | null): Form {
  return {
    name: p?.name ?? "",
    tagline: p?.tagline ?? "",
    description: p?.description ?? "",
    price: p ? String(p.price) : "",
    mrp: p ? String(p.mrp) : "",
    serviceCodes: p?.serviceCodes ?? [],
    popular: p?.popular ?? false,
    isActive: p?.isActive ?? true,
  };
}

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.name.trim()) e.name = "Name is required";
  if (!f.serviceCodes.length) e.serviceCodes = "Include at least one test";
  const price = Number(f.price);
  if (!f.price || !(price > 0)) e.price = "Enter a price";
  if (f.mrp && Number(f.mrp) < price) e.mrp = "MRP must be at least the price";
  return e;
}

function Field({ label, htmlFor, error, children, hint }: { label: string; htmlFor?: string; error?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RupeeInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input type="number" inputMode="numeric" min={0} {...props} className={cn("h-9 pl-7 tabular", props.className)} />
    </div>
  );
}

/** Create (pkg = null) or edit a package. Remount with a new `key` per open. */
export function PackageDialog({
  pkg,
  services,
  open,
  onOpenChange,
  onSaved,
}: {
  pkg: Package | null;
  services: Service[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: Package) => void;
}) {
  const [form, setForm] = useState<Form>(() => fromPackage(pkg));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = touched ? validate(form) : {};
  const worth = services.filter((s) => form.serviceCodes.includes(s.code)).reduce((n, s) => n + s.price, 0);
  const price = Number(form.price) || 0;
  const mrp = Number(form.mrp) || 0;
  const discount = mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const toggleCode = (code: ServiceCode) =>
    setForm((f) => ({
      ...f,
      serviceCodes: f.serviceCodes.includes(code) ? f.serviceCodes.filter((c) => c !== code) : [...f.serviceCodes, code],
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate(form)).length) return;
    setSaving(true);
    const order = services.map((s) => s.code);
    const body = {
      name: form.name.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      price,
      mrp: form.mrp ? mrp : price,
      serviceCodes: [...form.serviceCodes].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      popular: form.popular,
      isActive: form.isActive,
    };
    try {
      const res = pkg
        ? await api.patch<{ package: Package }>(`/admin/packages/${pkg.id}`, body)
        : await api.post<{ package: Package }>("/admin/packages", body);
      toast.success(pkg ? `${res.package.name} updated` : `${res.package.name} created`, {
        description: `${formatINR(res.package.price)} · ${res.package.serviceCodes.length} tests${res.package.isActive ? "" : " · hidden from customers"}`,
      });
      onSaved(res.package);
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't save the package", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[600px]">
        <form onSubmit={submit} noValidate>
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-lg">{pkg ? `Edit ${pkg.name}` : "New package"}</DialogTitle>
            <DialogDescription>Changes go live on the website and booking flow immediately.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="p-name" error={errors.name}>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" aria-invalid={!!errors.name} placeholder="Heart Check" />
              </Field>
              <Field label="Tagline" htmlFor="p-tagline">
                <Input id="p-tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className="h-9" placeholder="One line on the card" />
              </Field>
            </div>
            <Field label="Description" htmlFor="p-desc">
              <Textarea id="p-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20" />
            </Field>

            <Field label="Included tests" error={errors.serviceCodes}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {services.map((s) => {
                  const on = form.serviceCodes.includes(s.code);
                  return (
                    <button
                      key={s.code}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleCode(s.code)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                        on ? "border-primary bg-secondary/60" : "border-border hover:border-foreground/20",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-[4px] border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                        )}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[13px] font-medium">{s.name}</span>
                        <span className="text-[11px] text-muted-foreground tabular">{formatINR(s.price)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Price"
                htmlFor="p-price"
                error={errors.price}
                hint={worth ? `Tests worth ${formatINR(worth)} individually` : undefined}
              >
                <RupeeInput id="p-price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} aria-invalid={!!errors.price} />
              </Field>
              <Field
                label="MRP"
                htmlFor="p-mrp"
                error={errors.mrp}
                hint={discount ? `Shown as ${discount}% off` : "Leave equal to price for no discount"}
              >
                <RupeeInput id="p-mrp" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} aria-invalid={!!errors.mrp} />
              </Field>
            </div>

            <div className="grid divide-y divide-border/70 rounded-xl border border-border">
              <label className="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
                <span>
                  <span className="block text-[13px] font-medium">Mark as popular</span>
                  <span className="block text-xs text-muted-foreground">Highlighted with a badge on the website</span>
                </span>
                <Switch checked={form.popular} onCheckedChange={(v) => setForm({ ...form, popular: v })} />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 px-3.5 py-3">
                <span>
                  <span className="block text-[13px] font-medium">Active</span>
                  <span className="block text-xs text-muted-foreground">Inactive packages are hidden from customers</span>
                </span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </label>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 px-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-w-28">
              {saving && <Loader2 className="animate-spin" />}
              {pkg ? "Save changes" : "Create package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
