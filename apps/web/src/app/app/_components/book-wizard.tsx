"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  House,
  LoaderCircle,
  Lock,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EXPRESS_SLOT, formatINR, slotLabel, todayISO } from "@/lib/format";
import type { Booking, Catalog, Gender, Package, Relation, ServiceCode, Slot, SlotsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddressForm, inputClass, saveNewAddress } from "./address-form";
import { CheckoutDialog } from "./checkout-dialog";
import {
  ErrorState,
  GENDER_LABEL,
  RELATION_LABEL,
  Surface,
  ageFromDob,
  serviceIcon,
  serviceMap,
  useCatalog,
} from "./shared";

const STEPS = [
  { title: "Choose tests", short: "Tests" },
  { title: "Who is this for?", short: "Patient" },
  { title: "Visit address", short: "Address" },
  { title: "Pick a date and time", short: "Schedule" },
  { title: "Review and pay", short: "Pay" },
] as const;

type PatientMode = "self" | "family";

interface FamilyDraft {
  name: string;
  age: string;
  gender: Gender | "";
  relation: Exclude<Relation, "self"> | "";
}

function validAge(v: string): boolean {
  const n = Number(v);
  return v.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 120;
}

// ---------------------------------------------------------------------------

export function BookWizard({
  initialPackage,
  initialTest,
}: {
  initialPackage: string | null;
  initialTest: string | null;
}) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { catalog, error: catalogError, reload: reloadCatalog } = useCatalog();

  const [step, setStep] = useState(0);
  const [pkgRef, setPkgRef] = useState<string | null>(initialPackage);
  const [extraCodes, setExtraCodes] = useState<string[]>(initialTest ? [initialTest] : []);

  const [mode, setMode] = useState<PatientMode>("self");
  const [selfName, setSelfName] = useState(() => user?.name ?? "");
  const [selfAge, setSelfAge] = useState(() => String(ageFromDob(user?.dob) ?? ""));
  const [selfGender, setSelfGender] = useState<Gender | "">(() => user?.gender ?? "");
  const [family, setFamily] = useState<FamilyDraft>({ name: "", age: "", gender: "", relation: "" });
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const [addressId, setAddressId] = useState<string | null>(() => user?.addresses?.[0]?.id ?? null);
  const [addingAddress, setAddingAddress] = useState(() => (user?.addresses?.length ?? 0) === 0);

  const [date, setDate] = useState(() => todayISO());
  const [slot, setSlot] = useState<string | null>(null);

  const [placing, setPlacing] = useState(false);
  const [created, setCreated] = useState<{ booking: Booking; signature: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // ---- derived: tests and price (mirrors the API's pricing) ----
  const services = useMemo(() => serviceMap(catalog), [catalog]);
  const pkg: Package | null = useMemo(
    () => catalog?.packages.find((p) => p.id === pkgRef || p.slug === pkgRef) ?? null,
    [catalog, pkgRef],
  );
  const included: ServiceCode[] = pkg?.serviceCodes ?? [];
  const extras = (extraCodes.filter((c) => c in services && !included.includes(c as ServiceCode)) as ServiceCode[]);
  const extrasTotal = extras.reduce((sum, c) => sum + (services[c]?.price ?? 0), 0);
  const total = (pkg?.price ?? 0) + extrasTotal;
  const mrpTotal = (pkg?.mrp ?? 0) + extrasTotal;
  const savings = Math.max(0, mrpTotal - total);
  const testCount = new Set([...included, ...extras]).size;

  const addresses = user?.addresses ?? [];
  const address = addresses.find((a) => a.id === addressId) ?? null;

  const patient =
    mode === "self"
      ? { name: selfName.trim(), age: selfAge, gender: selfGender, relation: "self" as Relation }
      : { name: family.name.trim(), age: family.age, gender: family.gender, relation: family.relation as Relation };
  const patientValid =
    patient.name.length > 0 && validAge(patient.age) && patient.gender !== "" && (mode === "self" || family.relation !== "");

  const stepValid = [
    testCount > 0,
    patientValid,
    Boolean(address) && !addingAddress,
    Boolean(date && slot),
    true,
  ];

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const goNext = () => {
    if (!stepValid[step]) {
      setTouched(true);
      return;
    }
    setTouched(false);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      scrollTop();
    } else {
      void placeAndPay();
    }
  };

  const goBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setStep(step - 1);
    scrollTop();
  };

  const jump = (to: number) => {
    setStep(to);
    scrollTop();
  };

  const togglePackage = (p: Package) => {
    setPkgRef((cur) => (cur === p.id || cur === p.slug ? null : p.id));
  };

  const toggleTest = (code: ServiceCode) => {
    setExtraCodes((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  };

  // ---- place booking + checkout ----
  const body = {
    patient: { name: patient.name, age: Number(patient.age), gender: patient.gender, relation: patient.relation },
    address: address ?? undefined,
    packageId: pkg?.id ?? null,
    serviceCodes: extras,
    scheduledDate: date,
    slot,
    notes: notes.trim(),
  };
  const signature = JSON.stringify(body);

  async function placeAndPay() {
    if (created && created.signature === signature && created.booking.status === "pending_payment") {
      setCheckoutOpen(true);
      return;
    }
    setPlacing(true);
    try {
      const stale = created?.booking;
      const { booking } = await api.post<{ booking: Booking }>("/bookings", body);
      setCreated({ booking, signature });
      setCheckoutOpen(true);
      // A previous unpaid draft with different details is no longer wanted.
      if (stale && stale.status === "pending_payment") {
        api.post(`/bookings/${stale.id}/cancel`, { reason: "Booking details changed before payment" }).catch(() => {});
      }
    } catch (err) {
      toast.error("Couldn't place your booking", { description: errorMessage(err) });
    } finally {
      setPlacing(false);
    }
  }

  const onCheckoutChange = (open: boolean) => {
    setCheckoutOpen(open);
    if (!open && created) {
      toast("Booking saved, payment pending", {
        description: `${created.booking.code} is held for you. Complete payment any time from My bookings.`,
        action: { label: "View", onClick: () => router.push(`/app/bookings/${created.booking.id}`) },
      });
    }
  };

  const onPaid = (booking: Booking) => {
    window.scrollTo({ top: 0 });
    router.push(`/app/bookings/${booking.id}`);
  };

  // ---- render ----
  if (catalogError && !catalog) {
    return <ErrorState title="Couldn't load tests" message={catalogError} onRetry={reloadCatalog} className="mt-6" />;
  }

  const isLast = step === STEPS.length - 1;
  const ctaLabel = isLast ? `Pay ${formatINR(total)}` : "Continue";

  return (
    <div className="lg:-mx-44">
      <WizardHeader step={step} onBack={goBack} />

      <div className="mt-5 grid items-start gap-6 pb-28 md:pb-24 lg:grid-cols-[minmax(0,1fr)_20rem] lg:pb-0">
        <div key={step} className="min-w-0 animate-fade-up">
          {step === 0 &&
            (catalog ? (
              <TestsStep
                catalog={catalog}
                pkg={pkg}
                extras={extras}
                onTogglePackage={togglePackage}
                onToggleTest={toggleTest}
                invalid={touched && testCount === 0}
              />
            ) : (
              <TestsSkeleton />
            ))}

          {step === 1 && (
            <PatientStep
              mode={mode}
              setMode={setMode}
              selfName={selfName}
              setSelfName={setSelfName}
              selfAge={selfAge}
              setSelfAge={setSelfAge}
              selfGender={selfGender}
              setSelfGender={setSelfGender}
              family={family}
              setFamily={setFamily}
              notes={notes}
              setNotes={setNotes}
              touched={touched}
            />
          )}

          {step === 2 && (
            <div className="space-y-3">
              {addresses.length > 0 && (
                <div role="radiogroup" aria-label="Saved addresses" className="grid gap-2.5">
                  {addresses.map((a) => {
                    const selected = a.id === addressId && !addingAddress;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setAddressId(a.id);
                          setAddingAddress(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3.5 rounded-2xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                          selected ? "border-primary shadow-lift ring-1 ring-primary" : "border-border hover:border-primary/40",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-xl",
                            selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                          )}
                        >
                          <House className="size-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{a.label || "Home"}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                            {a.line1}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted-foreground">
                            {[a.area, a.city, a.pincode].filter(Boolean).join(", ")}
                          </span>
                        </span>
                        <RadioDot checked={selected} />
                      </button>
                    );
                  })}
                </div>
              )}

              {addingAddress ? (
                <Surface className="p-4 sm:p-5">
                  <p className="mb-4 text-sm font-semibold">Add a new address</p>
                  <AddressForm
                    submitLabel="Save and use"
                    onCancel={addresses.length ? () => setAddingAddress(false) : undefined}
                    onSave={async (draft) => {
                      if (!user) return;
                      const next = await saveNewAddress(user, draft);
                      setUser(next);
                      const last = next.addresses?.[next.addresses.length - 1];
                      if (last) setAddressId(last.id);
                      setAddingAddress(false);
                      toast.success("Address saved");
                    }}
                  />
                </Surface>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingAddress(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-transparent p-4 text-left text-sm font-semibold text-primary transition-colors outline-none hover:bg-secondary/50 focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-secondary">
                    <Plus className="size-[18px]" aria-hidden />
                  </span>
                  Add new address
                </button>
              )}
              {touched && !stepValid[2] && (
                <p className="text-sm text-destructive">
                  {addingAddress ? "Save the new address to continue." : "Choose where the nurse should visit."}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <ScheduleStep
              date={date}
              slot={slot}
              onDate={(d) => {
                setDate(d);
                setSlot(null);
              }}
              onSlot={setSlot}
              invalid={touched && !slot}
            />
          )}

          {step === 4 && (
            <ReviewStep
              catalog={catalog}
              pkg={pkg}
              extras={extras}
              total={total}
              mrpTotal={mrpTotal}
              patient={patient}
              notes={notes}
              address={address}
              date={date}
              slot={slot}
              onEdit={jump}
            />
          )}
        </div>

        {/* Desktop summary */}
        <aside className="sticky top-24 hidden lg:block">
          <Summary
            catalog={catalog}
            pkg={pkg}
            extras={extras}
            total={total}
            savings={savings}
            testCount={testCount}
            date={step >= 3 || slot ? date : null}
            slot={slot}
          />
          <Button
            onClick={goNext}
            disabled={placing || (isLast && !catalog)}
            className="mt-3 h-12 w-full rounded-xl text-[15px] font-semibold shadow-lift"
          >
            {placing ? <LoaderCircle className="animate-spin" aria-hidden /> : isLast ? <Lock aria-hidden /> : null}
            {ctaLabel}
            {!isLast && !placing && <ArrowRight aria-hidden />}
          </Button>
          {step > 0 && (
            <Button variant="ghost" onClick={goBack} className="mt-1.5 h-10 w-full rounded-xl text-muted-foreground">
              <ChevronLeft aria-hidden /> Back to {STEPS[step - 1].short.toLowerCase()}
            </Button>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden /> Free cancellation until the nurse arrives
          </p>
        </aside>
      </div>

      {/* Mobile / tablet sticky bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-card/95 shadow-[0_-10px_30px_-18px_rgb(19_35_33/0.35)] backdrop-blur-md md:bottom-0 md:pb-safe lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            {testCount > 0 ? (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="tabular text-lg leading-none font-semibold">{formatINR(total)}</span>
                  {savings > 0 && (
                    <span className="tabular text-xs text-muted-foreground line-through">{formatINR(mrpTotal)}</span>
                  )}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {pkg ? pkg.name : `${testCount} test${testCount === 1 ? "" : "s"}`}
                  {pkg && extras.length ? ` + ${extras.length} add-on${extras.length === 1 ? "" : "s"}` : ""}
                  {savings > 0 && !isLast ? ` · Save ${formatINR(savings)}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a package or tests</p>
            )}
          </div>
          <Button
            onClick={goNext}
            disabled={placing || (isLast && !catalog)}
            className="h-12 shrink-0 rounded-xl px-5 text-[15px] font-semibold shadow-lift"
          >
            {placing ? <LoaderCircle className="animate-spin" aria-hidden /> : isLast ? <Lock aria-hidden /> : null}
            {ctaLabel}
            {!isLast && !placing && <ArrowRight aria-hidden />}
          </Button>
        </div>
      </div>

      <CheckoutDialog
        booking={created?.booking ?? null}
        open={checkoutOpen}
        onOpenChange={onCheckoutChange}
        onPaid={onPaid}
        phone={user?.phone}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WizardHeader({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={step === 0 ? "Go back" : `Back to ${STEPS[step - 1].short}`}
          className="-ml-1.5 grid size-9 shrink-0 place-items-center rounded-full text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="font-display text-[1.6rem] leading-tight font-medium tracking-tight md:text-3xl">
            {STEPS[step].title}
          </h1>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Booking steps">
        {STEPS.map((s, i) => (
          <li key={s.short} aria-current={i === step ? "step" : undefined}>
            <span
              className={cn(
                "block h-1.5 rounded-full transition-colors duration-300",
                i < step ? "bg-primary" : i === step ? "bg-saffron" : "bg-border",
              )}
            />
            <span
              className={cn(
                "mt-1.5 hidden text-[11px] font-medium sm:block",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.short}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
        checked ? "border-primary bg-primary" : "border-input bg-card",
      )}
    >
      {checked && <span className="size-2 rounded-full bg-primary-foreground" />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 1: tests
// ---------------------------------------------------------------------------

function TestsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}

function TestsStep({
  catalog,
  pkg,
  extras,
  onTogglePackage,
  onToggleTest,
  invalid,
}: {
  catalog: Catalog;
  pkg: Package | null;
  extras: ServiceCode[];
  onTogglePackage: (p: Package) => void;
  onToggleTest: (c: ServiceCode) => void;
  invalid: boolean;
}) {
  const services = serviceMap(catalog);
  return (
    <div className="space-y-7">
      <section aria-label="Packages">
        <p className="mb-3 text-sm text-muted-foreground">
          Doctor-reviewed packages, done at home by a Nivar nurse.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.packages.map((p) => {
            const selected = pkg?.id === p.id;
            const save = p.mrp - p.price;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onTogglePackage(p)}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  selected
                    ? "border-primary shadow-lift ring-1 ring-primary"
                    : "border-border shadow-soft hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {p.popular && (
                      <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-saffron/20 px-2 py-0.5 text-[11px] font-semibold text-saffron-foreground">
                        <Sparkles className="size-3" aria-hidden /> Most popular
                      </span>
                    )}
                    <p className="text-[15px] leading-snug font-semibold">{p.name}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.tagline}</p>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.serviceCodes.map((c) => {
                    const Icon = serviceIcon(c);
                    return (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                      >
                        <Icon className="size-3" aria-hidden />
                        {services[c]?.shortName ?? c}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                  <p className="flex items-baseline gap-2">
                    <span className="tabular text-xl leading-none font-semibold">{formatINR(p.price)}</span>
                    {p.mrp > p.price && (
                      <span className="tabular text-[13px] text-muted-foreground line-through">{formatINR(p.mrp)}</span>
                    )}
                  </p>
                  {save > 0 && (
                    <span className="tabular rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Save {formatINR(save)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Individual tests">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {pkg ? "Add more tests" : "Or pick individual tests"}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Surface className="divide-y divide-border overflow-hidden">
          {catalog.services.map((s) => {
            const inPkg = pkg?.serviceCodes.includes(s.code) ?? false;
            const checked = inPkg || extras.includes(s.code);
            const Icon = serviceIcon(s);
            return (
              <button
                key={s.code}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-disabled={inPkg}
                onClick={() => !inPkg && onToggleTest(s.code)}
                className={cn(
                  "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-muted",
                  inPkg ? "cursor-default" : "hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    checked ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
                    {s.description}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  {inPkg ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                      Included
                    </span>
                  ) : (
                    <span className="tabular text-sm font-semibold">{formatINR(s.price)}</span>
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 place-items-center rounded-md border-2 transition-colors",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                      inPkg && "opacity-50",
                    )}
                  >
                    {checked && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                </span>
              </button>
            );
          })}
        </Surface>
        {invalid && <p className="mt-2 text-sm text-destructive">Choose a package or at least one test.</p>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: patient
// ---------------------------------------------------------------------------

function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  invalid,
  label,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  invalid?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
            value === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : cn("bg-card hover:border-primary/40", invalid ? "border-destructive" : "border-border"),
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const GENDER_OPTIONS = (["male", "female", "other"] as const).map((g) => ({ value: g, label: GENDER_LABEL[g] }));
const RELATION_OPTIONS = (["parent", "spouse", "child", "other"] as const).map((r) => ({
  value: r,
  label: r === "other" ? "Other" : RELATION_LABEL[r],
}));

function PatientStep(props: {
  mode: PatientMode;
  setMode: (m: PatientMode) => void;
  selfName: string;
  setSelfName: (v: string) => void;
  selfAge: string;
  setSelfAge: (v: string) => void;
  selfGender: Gender | "";
  setSelfGender: (g: Gender) => void;
  family: FamilyDraft;
  setFamily: (f: FamilyDraft) => void;
  notes: string;
  setNotes: (v: string) => void;
  touched: boolean;
}) {
  const { mode, setMode, family, setFamily, touched } = props;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Who is this for">
        {(
          [
            { id: "self", label: "Myself", sub: props.selfName || "You", icon: UserRound },
            { id: "family", label: "Family member", sub: "Parent, spouse, child", icon: UsersRound },
          ] as const
        ).map((o) => {
          const selected = mode === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(o.id)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                selected ? "border-primary shadow-lift ring-1 ring-primary" : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex w-full items-start justify-between">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-xl",
                    selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                  )}
                >
                  <o.icon className="size-[18px]" aria-hidden />
                </span>
                <RadioDot checked={selected} />
              </span>
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Surface className="space-y-4 p-4 sm:p-5">
        {mode === "self" ? (
          <>
            <FieldRow label="Your name" htmlFor="p-name">
              <Input
                id="p-name"
                value={props.selfName}
                onChange={(e) => props.setSelfName(e.target.value)}
                placeholder="Full name"
                aria-invalid={touched && !props.selfName.trim() ? true : undefined}
                className={inputClass}
                autoComplete="name"
              />
            </FieldRow>
            <FieldRow label="Age" htmlFor="p-age">
              <Input
                id="p-age"
                inputMode="numeric"
                value={props.selfAge}
                onChange={(e) => props.setSelfAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Years"
                aria-invalid={touched && !validAge(props.selfAge) ? true : undefined}
                className={cn(inputClass, "tabular w-28")}
              />
            </FieldRow>
            <FieldRow label="Gender">
              <ChoiceChips
                label="Gender"
                value={props.selfGender}
                options={GENDER_OPTIONS}
                onChange={props.setSelfGender}
                invalid={touched && !props.selfGender}
              />
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="Relation">
              <ChoiceChips
                label="Relation"
                value={family.relation}
                options={RELATION_OPTIONS}
                onChange={(relation) => setFamily({ ...family, relation })}
                invalid={touched && !family.relation}
              />
            </FieldRow>
            <FieldRow label="Patient's name" htmlFor="f-name">
              <Input
                id="f-name"
                value={family.name}
                onChange={(e) => setFamily({ ...family, name: e.target.value })}
                placeholder="Full name"
                aria-invalid={touched && !family.name.trim() ? true : undefined}
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label="Age" htmlFor="f-age">
              <Input
                id="f-age"
                inputMode="numeric"
                value={family.age}
                onChange={(e) => setFamily({ ...family, age: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                placeholder="Years"
                aria-invalid={touched && !validAge(family.age) ? true : undefined}
                className={cn(inputClass, "tabular w-28")}
              />
            </FieldRow>
            <FieldRow label="Gender">
              <ChoiceChips
                label="Gender"
                value={family.gender}
                options={GENDER_OPTIONS}
                onChange={(gender) => setFamily({ ...family, gender })}
                invalid={touched && !family.gender}
              />
            </FieldRow>
          </>
        )}
      </Surface>

      <div className="space-y-1.5">
        <label htmlFor="p-notes" className="text-sm font-semibold">
          Symptoms or notes for the doctor <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="p-notes"
          value={props.notes}
          onChange={(e) => props.setNotes(e.target.value)}
          placeholder="E.g. occasional chest tightness after climbing stairs, on BP medication since 2022"
          rows={3}
          maxLength={2000}
          className="min-h-24 rounded-xl bg-card px-3.5 py-3 text-[15px] md:text-[15px]"
        />
      </div>
      {touched && (
        <p className="text-sm text-destructive">Please fill in the patient&apos;s name, age and gender.</p>
      )}
    </div>
  );
}

function FieldRow({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: schedule
// ---------------------------------------------------------------------------

function nextDays(n: number): { iso: string; top: string; bottom: string }[] {
  const start = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(start, i);
    return {
      iso: format(d, "yyyy-MM-dd"),
      top: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE"),
      bottom: format(d, "d MMM"),
    };
  });
}

const SLOT_GROUPS = [
  { label: "Morning", from: 7, to: 12 },
  { label: "Afternoon", from: 12, to: 16 },
  { label: "Evening", from: 16, to: 21 },
];

function shortSlot(slot: string): string {
  const h = Number(slot.slice(0, 2));
  const fmt = (x: number) => `${x % 12 === 0 ? 12 : x % 12}`;
  const per = (x: number) => (x >= 12 ? "PM" : "AM");
  return per(h) === per(h + 1) ? `${fmt(h)} - ${fmt(h + 1)} ${per(h + 1)}` : `${fmt(h)} ${per(h)} - ${fmt(h + 1)} ${per(h + 1)}`;
}

function ScheduleStep({
  date,
  slot,
  onDate,
  onSlot,
  invalid,
}: {
  date: string;
  slot: string | null;
  onDate: (d: string) => void;
  onSlot: (s: string) => void;
  invalid: boolean;
}) {
  const days = useMemo(() => nextDays(7), []);
  const [state, setState] = useState<{ date: string; slots: Slot[] | null; error: string | null }>({
    date: "",
    slots: null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<SlotsResponse>(`/slots?date=${date}`, { signal: controller.signal, anonymous: true })
      .then((res) => setState({ date, slots: res.slots, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setState({ date, slots: null, error: errorMessage(err) });
      });
    return () => controller.abort();
  }, [date, nonce]);

  const loading = state.date !== date;
  const slots = state.date === date ? state.slots : null;
  const express = slots?.find((s) => s.slot === EXPRESS_SLOT && s.available);
  const hourly = slots?.filter((s) => s.slot !== EXPRESS_SLOT) ?? [];
  const anyHourly = hourly.some((s) => s.available);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary" aria-hidden /> Date
        </p>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
          <div role="radiogroup" aria-label="Date" className="flex gap-2">
            {days.map((d) => {
              const selected = d.iso === date;
              return (
                <button
                  key={d.iso}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onDate(d.iso)}
                  className={cn(
                    "flex h-16 w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-lift"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span className={cn("text-[11px] font-medium", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {d.top}
                  </span>
                  <span className="tabular mt-0.5 text-sm font-semibold">{d.bottom}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {date === todayISO() && <Skeleton className="h-[92px] rounded-2xl" />}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        </div>
      ) : state.error ? (
        <ErrorState title="Couldn't load time slots" message={state.error} onRetry={() => setNonce((n) => n + 1)} />
      ) : (
        <div className="space-y-6">
          {express && (
            <button
              type="button"
              role="radio"
              aria-checked={slot === EXPRESS_SLOT}
              onClick={() => onSlot(EXPRESS_SLOT)}
              className={cn(
                "group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 p-4 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-saffron/50",
                slot === EXPRESS_SLOT
                  ? "border-saffron bg-[#FFF4E2] shadow-[0_18px_40px_-20px_rgb(242_163_58/0.7)]"
                  : "border-saffron/50 bg-[#FFFAF1] hover:border-saffron",
              )}
            >
              <span aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-32 rounded-full bg-saffron/15" />
              <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-saffron text-ink shadow-sm">
                <Zap className="size-6 fill-current" aria-hidden />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold">Express visit</span>
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                    Fastest
                  </span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-balance text-[#7A4A0E]">
                  Nurse at your door within 60 minutes
                </span>
              </span>
              <span className="relative">
                <RadioDot checked={slot === EXPRESS_SLOT} />
              </span>
            </button>
          )}

          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-primary" aria-hidden />
              {express ? "Or pick a time slot" : "Time slot"}
            </p>
            {!anyHourly && (
              <p className="mb-3 rounded-xl bg-muted px-3.5 py-2.5 text-[13px] text-muted-foreground">
                {express
                  ? "All of today's regular slots are booked or have passed. Express is still available, or pick tomorrow."
                  : "No slots left on this day. Please pick another date."}
              </p>
            )}
            <div role="radiogroup" aria-label="Time slot" className={cn("space-y-4", !anyHourly && "hidden")}>
              {SLOT_GROUPS.map((g) => {
                const items = hourly.filter((s) => {
                  const h = Number(s.slot.slice(0, 2));
                  return h >= g.from && h < g.to;
                });
                if (!items.length) return null;
                return (
                  <div key={g.label}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{g.label}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {items.map((s) => {
                        const selected = slot === s.slot;
                        return (
                          <button
                            key={s.slot}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={!s.available}
                            onClick={() => onSlot(s.slot)}
                            title={s.available ? slotLabel(s.slot) : "Unavailable"}
                            className={cn(
                              "tabular h-11 rounded-xl border text-[13px] font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                              selected
                                ? "border-primary bg-primary text-primary-foreground shadow-lift"
                                : s.available
                                  ? "border-border bg-card hover:border-primary/50"
                                  : "cursor-not-allowed border-transparent bg-muted/70 text-muted-foreground/60 line-through decoration-muted-foreground/40",
                            )}
                          >
                            {shortSlot(s.slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {invalid && <p className="text-sm text-destructive">Pick a time for your visit.</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: review
// ---------------------------------------------------------------------------

function ReviewStep({
  catalog,
  pkg,
  extras,
  total,
  mrpTotal,
  patient,
  notes,
  address,
  date,
  slot,
  onEdit,
}: {
  catalog: Catalog | null;
  pkg: Package | null;
  extras: ServiceCode[];
  total: number;
  mrpTotal: number;
  patient: { name: string; age: string; gender: Gender | ""; relation: Relation };
  notes: string;
  address: { label: string; line1: string; area: string; city: string; pincode: string } | null;
  date: string;
  slot: string | null;
  onEdit: (step: number) => void;
}) {
  const services = serviceMap(catalog);
  const isExpress = slot === EXPRESS_SLOT;
  const discount = mrpTotal - total;
  return (
    <div className="space-y-3">
      <ReviewCard title="Tests" icon={Sparkles} onEdit={() => onEdit(0)}>
        {pkg && (
          <p className="text-sm font-semibold">
            {pkg.name}
            <span className="ml-1.5 font-normal text-muted-foreground">({pkg.serviceCodes.length} tests)</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...(pkg?.serviceCodes ?? []), ...extras].map((c) => {
            const Icon = serviceIcon(c);
            return (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
              >
                <Icon className="size-3" aria-hidden />
                {services[c]?.shortName ?? c}
              </span>
            );
          })}
        </div>
      </ReviewCard>

      <ReviewCard title="Patient" icon={UserRound} onEdit={() => onEdit(1)}>
        <p className="text-sm font-semibold">{patient.name}</p>
        <p className="text-[13px] text-muted-foreground">
          {[`${patient.age} yrs`, patient.gender ? GENDER_LABEL[patient.gender] : null, RELATION_LABEL[patient.relation]]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {notes.trim() && (
          <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-[13px] leading-snug text-muted-foreground">
            &ldquo;{notes.trim()}&rdquo;
          </p>
        )}
      </ReviewCard>

      <ReviewCard title="Address" icon={MapPin} onEdit={() => onEdit(2)}>
        {address && (
          <>
            <p className="text-sm font-semibold">{address.label}</p>
            <p className="text-[13px] leading-snug text-muted-foreground">
              {address.line1}, {[address.area, address.city, address.pincode].filter(Boolean).join(", ")}
            </p>
          </>
        )}
      </ReviewCard>

      <ReviewCard title="Schedule" icon={isExpress ? Zap : CalendarDays} onEdit={() => onEdit(3)} accent={isExpress}>
        <p className="text-sm font-semibold">
          {isExpress ? "Express visit, today" : `${format(new Date(`${date}T00:00:00`), "EEEE, d MMMM")}`}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {isExpress ? "Nurse at your door within 60 minutes of payment" : slotLabel(slot)}
        </p>
      </ReviewCard>

      <Surface className="p-4">
        <p className="mb-3 text-sm font-semibold">Price details</p>
        <dl className="space-y-2 text-sm">
          {pkg && (
            <PriceRow label={pkg.name} value={formatINR(pkg.mrp)} />
          )}
          {extras.map((c) => (
            <PriceRow key={c} label={services[c]?.name ?? c} value={formatINR(services[c]?.price ?? 0)} />
          ))}
          {discount > 0 && <PriceRow label="Package discount" value={`−${formatINR(discount)}`} tone="success" />}
          <PriceRow label="Home visit" value="Free" tone="success" />
          <div className="my-2 border-t border-dashed border-border" />
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">Total payable</dt>
            <dd className="tabular text-lg font-semibold">{formatINR(total)}</dd>
          </div>
        </dl>
        {discount > 0 && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800">
            You save {formatINR(discount)} on this booking
          </p>
        )}
      </Surface>
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden /> Free cancellation until the nurse arrives.
      </p>
    </div>
  );
}

function PriceRow({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular font-medium", tone === "success" && "text-emerald-700")}>{value}</dd>
    </div>
  );
}

function ReviewCard({
  title,
  icon: Icon,
  onEdit,
  children,
  accent,
}: {
  title: string;
  icon: typeof MapPin;
  onEdit: () => void;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Surface className={cn("flex gap-3.5 p-4", accent && "border-saffron/60 bg-[#FFFAF1]")}>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          accent ? "bg-saffron text-ink" : "bg-secondary text-primary",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title.toLowerCase()}`}
        className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Pencil className="size-3.5" aria-hidden />
      </button>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Desktop summary card
// ---------------------------------------------------------------------------

function Summary({
  catalog,
  pkg,
  extras,
  total,
  savings,
  testCount,
  date,
  slot,
}: {
  catalog: Catalog | null;
  pkg: Package | null;
  extras: ServiceCode[];
  total: number;
  savings: number;
  testCount: number;
  date: string | null;
  slot: string | null;
}) {
  const services = serviceMap(catalog);
  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-border bg-secondary/50 px-4 py-3">
        <p className="text-sm font-semibold">Your booking</p>
        <p className="text-xs text-muted-foreground">
          {testCount ? `${testCount} test${testCount === 1 ? "" : "s"} at home` : "Nothing selected yet"}
        </p>
      </div>
      <div className="space-y-2.5 px-4 py-3.5 text-sm">
        {!pkg && extras.length === 0 && (
          <p className="py-2 text-center text-[13px] text-muted-foreground">Pick a package or tests to see your total.</p>
        )}
        {pkg && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{pkg.name}</span>
            <span className="tabular shrink-0">{formatINR(pkg.price)}</span>
          </div>
        )}
        {extras.map((c) => (
          <div key={c} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-muted-foreground">+ {services[c]?.name ?? c}</span>
            <span className="tabular shrink-0">{formatINR(services[c]?.price ?? 0)}</span>
          </div>
        ))}
        {date && slot && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-2 text-[13px]">
            {slot === EXPRESS_SLOT ? (
              <Zap className="size-3.5 fill-saffron text-saffron" aria-hidden />
            ) : (
              <CalendarDays className="size-3.5 text-primary" aria-hidden />
            )}
            {slot === EXPRESS_SLOT
              ? "Express, within 60 min"
              : `${format(new Date(`${date}T00:00:00`), "EEE, d MMM")}, ${slotLabel(slot)}`}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between border-t border-dashed border-border px-4 py-3.5">
        <span className="text-sm font-semibold">Total</span>
        <span className="text-right">
          <span className="tabular block text-xl leading-none font-semibold">{formatINR(total)}</span>
          {savings > 0 && (
            <span className="tabular mt-1 block text-xs font-medium text-emerald-700">You save {formatINR(savings)}</span>
          )}
        </span>
      </div>
    </Surface>
  );
}

