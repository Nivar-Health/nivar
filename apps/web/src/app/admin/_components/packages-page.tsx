"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Loader2, PackageOpen, Pencil, Plus, Radio, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { Package, Service } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorState, PageHeader, Panel } from "./admin-ui";
import { PackageDialog } from "./package-dialog";
import { useAdminResource } from "./use-admin-data";

interface CatalogData {
  packages: Package[];
  services: Service[];
}

function PackageCard({
  pkg,
  services,
  onEdit,
  onToggle,
  busy,
}: {
  pkg: Package;
  services: Service[];
  onEdit: () => void;
  onToggle: (v: boolean) => void;
  busy: boolean;
}) {
  const discount = pkg.mrp > pkg.price ? Math.round(((pkg.mrp - pkg.price) / pkg.mrp) * 100) : 0;
  const names = pkg.serviceCodes.map((c) => services.find((s) => s.code === c)?.name ?? c);
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[14px] border bg-card shadow-soft",
        pkg.popular ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-[15px] leading-tight font-semibold", !pkg.isActive && "text-muted-foreground")}>{pkg.name}</h3>
            {pkg.popular && (
              <span className="rounded-full bg-saffron/15 px-2 py-px text-[10.5px] font-semibold tracking-wide text-[#9A5B07] uppercase">
                Popular
              </span>
            )}
            {!pkg.isActive && (
              <span className="rounded bg-muted px-1.5 py-px text-[10.5px] font-medium text-muted-foreground">Hidden</span>
            )}
          </div>
          {pkg.tagline && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{pkg.tagline}</p>}
        </div>
        <Switch
          checked={pkg.isActive}
          disabled={busy}
          onCheckedChange={onToggle}
          aria-label={`${pkg.isActive ? "Hide" : "Show"} ${pkg.name}`}
          className="mt-0.5"
        />
      </div>
      <div className="flex items-baseline gap-2 px-4 pt-3">
        <span className="text-2xl font-semibold tracking-tight">{formatINR(pkg.price)}</span>
        {discount > 0 && (
          <>
            <span className="text-sm text-muted-foreground line-through">{formatINR(pkg.mrp)}</span>
            <span className="text-xs font-semibold text-emerald-700">{discount}% off</span>
          </>
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-1 px-4 pt-3 pb-4">
        {names.map((n) => (
          <li key={n} className="flex items-center gap-2 text-[13px] text-foreground/85">
            <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
            {n}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border/70 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">{pkg.serviceCodes.length} tests</span>
        <Button size="sm" variant="ghost" onClick={onEdit} className="-mr-1.5">
          <Pencil />
          Edit
        </Button>
      </div>
    </article>
  );
}

function PriceCell({ service, onSaved }: { service: Service; onSaved: (s: Service) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(service.price));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const price = Number(value);
    if (!value || !(price >= 0)) {
      toast.error("Enter a valid price");
      return;
    }
    if (price === service.price) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<{ service: Service }>(`/admin/services/${service.code}`, { price });
      onSaved(res.service);
      toast.success(`${service.name} now ${formatINR(res.service.price)}`, {
        description: `Was ${formatINR(service.price)}. New bookings use the new price.`,
      });
      setEditing(false);
    } catch (err) {
      toast.error("Couldn't update the price", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(service.price));
          setEditing(true);
        }}
        className="group inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm font-semibold tabular outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={`Edit price of ${service.name}`}
      >
        {formatINR(service.price)}
        <Pencil className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    );
  }
  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
        <Input
          autoFocus
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="h-8 w-24 pl-6 text-right tabular"
          aria-label={`Price of ${service.name}`}
          disabled={saving}
        />
      </div>
      <Button type="submit" size="icon-sm" aria-label="Save price" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <Check />}
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(false)} disabled={saving}>
        <X />
      </Button>
    </form>
  );
}

export function PackagesPage() {
  const { data, error, reload } = useAdminResource<CatalogData>("/admin/packages");
  const [patches, setPatches] = useState<{ packages: Record<string, Package>; services: Record<string, Service> }>({
    packages: {},
    services: {},
  });
  const [dialog, setDialog] = useState<{ open: boolean; pkg: Package | null; n: number }>({ open: false, pkg: null, n: 0 });
  const [busy, setBusy] = useState<string | null>(null);

  const packages = useMemo(() => {
    const list = (data?.packages ?? []).map((p) => patches.packages[p.id] ?? p);
    for (const p of Object.values(patches.packages)) if (!list.some((x) => x.id === p.id)) list.push(p);
    return list.sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
  }, [data, patches.packages]);
  const services = useMemo(
    () => (data?.services ?? []).map((s) => patches.services[s.code] ?? s),
    [data, patches.services],
  );

  const savePackage = (p: Package) => setPatches((x) => ({ ...x, packages: { ...x.packages, [p.id]: p } }));

  const toggle = async (pkg: Package, isActive: boolean) => {
    setBusy(pkg.id);
    savePackage({ ...pkg, isActive });
    try {
      const res = await api.patch<{ package: Package }>(`/admin/packages/${pkg.id}`, { isActive });
      savePackage(res.package);
      toast.success(`${pkg.name} ${isActive ? "is live" : "hidden"}`, {
        description: isActive ? "Customers can book it again." : "Customers won't see it in the booking flow.",
      });
    } catch (err) {
      savePackage(pkg);
      toast.error("Couldn't update the package", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const activeCount = packages.filter((p) => p.isActive).length;

  return (
    <>
      <PageHeader
        title="Packages and pricing"
        description={data ? `${activeCount} of ${packages.length} packages live · ${services.length} individual tests` : "What customers can book, and for how much"}
        actions={
          <Button className="h-9 px-3.5" onClick={() => setDialog((d) => ({ open: true, pkg: null, n: d.n + 1 }))} disabled={!data}>
            <Plus />
            New package
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 min-[1400px]:grid-cols-4">
        {!data
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72 rounded-[14px]" />)
          : packages.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                services={services}
                busy={busy === p.id}
                onToggle={(v) => toggle(p, v)}
                onEdit={() => setDialog((d) => ({ open: true, pkg: p, n: d.n + 1 }))}
              />
            ))}
      </div>

      <Panel
        title="Individual tests"
        description="Click a price to edit it. Packages keep their own price."
        icon={<PackageOpen />}
        className="mt-6"
      >
        {!data ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : (
          <Table className="min-w-[720px]">
            <TableHeader className="bg-muted/40 [&_tr]:border-border/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-xs font-medium text-muted-foreground">Test</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Equipment</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Duration</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">In packages</TableHead>
                <TableHead className="pr-5 text-right text-xs font-medium text-muted-foreground">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => {
                const inPkgs = packages.filter((p) => p.serviceCodes.includes(s.code)).length;
                return (
                  <TableRow key={s.code} className="border-border/70 hover:bg-muted/30">
                    <TableCell className="max-w-[28rem] py-3 pl-5 whitespace-normal">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-px font-mono text-[11px] font-semibold text-muted-foreground">{s.code}</span>
                        <span className="text-[13px] font-medium">{s.name}</span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>
                    </TableCell>
                    <TableCell className="py-3 text-[13px]">
                      {s.requiresDevice ? (
                        <span className="inline-flex items-center gap-1.5">
                          {s.requiresDevice === "ecg" ? <Radio className="size-3.5 text-primary" /> : <Stethoscope className="size-3.5 text-primary" />}
                          {s.requiresDevice === "ecg" ? "Smart ECG" : "Digital stethoscope"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Standard kit</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 tabular">
                        <Clock className="size-3.5" />
                        {s.durationMin} min
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-[13px] text-muted-foreground tabular">
                      {inPkgs} of {packages.length}
                    </TableCell>
                    <TableCell className="py-2 pr-4 text-right">
                      <PriceCell
                        service={s}
                        onSaved={(svc) => setPatches((x) => ({ ...x, services: { ...x.services, [svc.code]: svc } }))}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <PackageDialog
        key={dialog.n}
        pkg={dialog.pkg}
        services={services}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={savePackage}
      />
    </>
  );
}
