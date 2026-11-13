"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, ChevronRight, CreditCard, Landmark, LoaderCircle, Smartphone, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { demoMode } from "@/lib/features";
import { formatINR, formatPhone } from "@/lib/format";
import type { Booking, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

type Method = Exclude<PaymentMethod, "cash">;
type Phase = "form" | "processing" | "success" | "error";

const UPI_APPS = [
  { id: "gpay", name: "GPay" },
  { id: "phonepe", name: "PhonePe" },
  { id: "paytm", name: "Paytm" },
] as const;

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank", "Yes Bank"];

const METHODS: { id: Method; label: string; icon: typeof CreditCard }[] = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "netbanking", label: "Net banking", icon: Landmark },
];

/** The test card a demonstration pays with. Real patients start from empty fields. */
const DEMO_CARD = { number: "4111 1111 1111 1111", expiry: "12/29", cvv: "123", name: "Test Card" };
const EMPTY_CARD = { number: "", expiry: "", cvv: "", name: "" };

const FIELD = "h-12 rounded-xl bg-card px-3.5 text-base md:text-base";

// ---------------------------------------------------------------------------
// Pieces the other patient screens share
// ---------------------------------------------------------------------------

/** A sheet from the bottom edge on phones, a centred card from 640px. Animates transform and opacity only. */
export const SHEET_BACKDROP =
  "fixed inset-0 z-50 bg-foreground/45 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0";
export const SHEET_POPUP = cn(
  "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-background text-foreground shadow-2xl outline-none transition-[transform,opacity] duration-300 ease-calm data-ending-style:translate-y-full data-starting-style:translate-y-full",
  "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-ending-style:translate-y-[-46%] sm:data-ending-style:opacity-0 sm:data-starting-style:translate-y-[-46%] sm:data-starting-style:opacity-0",
);

/** Marks something that exists only while the product is being demonstrated. */
export function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full border border-current px-2 text-sm font-semibold", className)}>
      Demo
    </span>
  );
}

let pendingPop: number | null = null;

/**
 * While `open`, the phone's Back button closes the layer instead of leaving the page: opening adds
 * one history entry, and Back takes it away again. Return false from `onBack` to stay open (a
 * payment in flight); the entry is then put back.
 */
export function useBackToClose(open: boolean, onBack: () => boolean | void) {
  const back = useEffectEvent(onBack);
  useEffect(() => {
    if (!open) return;
    const isOurs = () => Boolean((window.history.state as { nvLayer?: boolean } | null)?.nvLayer);
    const add = () => window.history.pushState({ nvLayer: true }, "");
    if (pendingPop !== null) {
      // The same layer is opening again straight away: keep the entry it already has.
      window.clearTimeout(pendingPop);
      pendingPop = null;
    } else if (!isOurs()) {
      add();
    }
    const onPop = () => {
      if (back() === false) add();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by a tap, Escape or a finished payment: take our entry away, once nothing reopens.
      pendingPop = window.setTimeout(() => {
        pendingPop = null;
        if (isOurs()) window.history.back();
      }, 0);
    };
  }, [open]);
}

/** Arrow keys move through a group of choice buttons (tabs, radios) and choose as they go. */
export function chooseWithArrowKeys(e: React.KeyboardEvent<HTMLElement>) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  const items = [
    ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled), button[role="tab"]:not(:disabled)'),
  ];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (at === -1) return;
  e.preventDefault();
  const next = items[(at + step + items.length) % items.length];
  next.focus();
  next.click();
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/**
 * Mock checkout (no payment gateway behind it yet). Always succeeds: processing, POST
 * /bookings/:id/pay, success, then `onPaid`. A bottom sheet on phones, a centred card from 640px.
 */
export function CheckoutDialog({
  booking,
  open,
  onOpenChange,
  onPaid,
  phone,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid: (booking: Booking) => void;
  phone?: string;
}) {
  const [method, setMethod] = useState<Method>("upi");
  const [upiApp, setUpiApp] = useState<string>("gpay");
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState(demoMode ? DEMO_CARD : EMPTY_CARD);
  const [bank, setBank] = useState(BANKS[0]);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [paid, setPaid] = useState<Booking | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const busy = phase === "processing" || phase === "success";

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    if (!next) {
      setPhase("form");
      setError(null);
      setProblem(null);
    }
    onOpenChange(next);
  };

  useBackToClose(open, () => {
    if (busy) return false;
    handleOpenChange(false);
  });

  const methodProblem =
    method === "upi"
      ? upiApp !== "" || /^[\w.-]+@[\w]+$/.test(upiId.trim())
        ? null
        : "Choose a UPI app, or enter your UPI ID in the form name@bank."
      : method === "card"
        ? card.number.replace(/\s/g, "").length >= 12 && card.expiry.length >= 4 && card.cvv.length >= 3
          ? null
          : "Enter the card number, the expiry date and the CVV."
        : null;

  const pay = () => {
    if (!booking) return;
    if (methodProblem) {
      setProblem(methodProblem);
      return;
    }
    setPhase("processing");
    setError(null);
    setProblem(null);
    const started = Date.now();
    api
      .post<{ booking: Booking }>(`/bookings/${booking.id}/pay`, { method })
      .then(({ booking: next }) => {
        const wait = Math.max(0, 1700 - (Date.now() - started));
        timers.current.push(
          window.setTimeout(() => {
            setPaid(next);
            setPhase("success");
            timers.current.push(window.setTimeout(() => onPaid(next), 1600));
          }, wait),
        );
      })
      .catch((err) => {
        const wait = Math.max(0, 900 - (Date.now() - started));
        timers.current.push(
          window.setTimeout(() => {
            setError(errorMessage(err, "Try again."));
            setPhase("error");
          }, wait),
        );
      });
  };

  const amount = booking?.amount ?? 0;
  const choose = (m: Method) => {
    setMethod(m);
    setProblem(null);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} disablePointerDismissal={busy}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={SHEET_BACKDROP} />
        <DialogPrimitive.Popup className={SHEET_POPUP}>
          {/* Header */}
          <div className="relative overflow-hidden bg-primary px-5 pt-3 pb-5 text-primary-foreground sm:pt-4">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-primary-foreground/25 sm:hidden" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LogoMark variant="light" className="size-10 shrink-0" />
                <div className="min-w-0 leading-tight">
                  <DialogPrimitive.Title className="text-base font-semibold">Payment</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="tabular text-sm text-primary-foreground/80">
                    {booking ? `Booking ${booking.code}` : "Checkout"}
                    {phone ? ` · ${formatPhone(phone)}` : ""}
                  </DialogPrimitive.Description>
                </div>
              </div>
              {!busy && (
                <DialogPrimitive.Close
                  aria-label="Close checkout"
                  className="-mt-1.5 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-full text-primary-foreground/85 transition-colors outline-none hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                >
                  <X className="size-5" aria-hidden />
                </DialogPrimitive.Close>
              )}
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-primary-foreground/80">Amount payable</p>
              <p className="tabular font-display text-[2rem] leading-none font-medium tracking-tight">{formatINR(amount)}</p>
            </div>
          </div>

          {phase === "processing" && <ProcessingView method={method} />}
          {phase === "success" && paid && <SuccessView booking={paid} />}
          {(phase === "form" || phase === "error") && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-3">
                {phase === "error" && (
                  // No gateway is behind this mock, so a failure never takes money. A real gateway must say what it knows.
                  <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-background px-3.5 py-2.5 text-small">
                    <p className="font-semibold text-destructive">The payment did not go through. No money was taken.</p>
                    {error && <p className="mt-0.5 text-foreground-2">{error}</p>}
                  </div>
                )}
                <div
                  role="tablist"
                  aria-label="Payment method"
                  onKeyDown={chooseWithArrowKeys}
                  className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1"
                >
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      role="tab"
                      type="button"
                      aria-selected={method === m.id}
                      onClick={() => choose(m.id)}
                      className={cn(
                        "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        method === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {/* Three labels and their icons do not fit across a 360px phone. */}
                      <m.icon className="hidden size-4 shrink-0 min-[24rem]:block" aria-hidden />
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 min-h-[13.5rem]">
                  {method === "upi" && (
                    <div className="space-y-4">
                      <div>
                        <p id="upi-apps" className="mb-2 text-sm font-medium text-foreground">
                          Pay with a UPI app
                        </p>
                        <div role="group" aria-labelledby="upi-apps" className="grid grid-cols-3 gap-2">
                          {UPI_APPS.map((app) => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => {
                                setUpiApp(app.id);
                                setProblem(null);
                              }}
                              aria-pressed={upiApp === app.id}
                              className={cn(
                                "flex flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                upiApp === app.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                              )}
                            >
                              <span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-bold text-foreground" aria-hidden>
                                {app.name.slice(0, 2)}
                              </span>
                              {app.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                        <span className="h-px flex-1 bg-border" /> or enter UPI ID <span className="h-px flex-1 bg-border" />
                      </div>
                      <div>
                        <label htmlFor="upi-id" className="sr-only">
                          UPI ID
                        </label>
                        <Input
                          id="upi-id"
                          value={upiId}
                          onChange={(e) => {
                            setUpiId(e.target.value);
                            // Typing an ID is the choice; an app stays chosen until then.
                            if (e.target.value.trim()) setUpiApp("");
                            setProblem(null);
                          }}
                          placeholder="yourname@bank"
                          aria-invalid={problem && method === "upi" ? true : undefined}
                          aria-describedby={problem ? "pay-problem" : undefined}
                          className={FIELD}
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          autoComplete="off"
                          enterKeyHint="done"
                        />
                      </div>
                    </div>
                  )}

                  {method === "card" && (
                    <div className="space-y-3">
                      <Field label="Card number" id="card-number">
                        <Input
                          id="card-number"
                          inputMode="numeric"
                          value={card.number}
                          onChange={(e) => {
                            setCard({ ...card, number: e.target.value });
                            setProblem(null);
                          }}
                          aria-describedby={problem ? "pay-problem" : undefined}
                          className={cn(FIELD, "tabular tracking-wider")}
                          autoComplete="off"
                          enterKeyHint="next"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Expiry" id="card-exp">
                          <Input
                            id="card-exp"
                            inputMode="numeric"
                            placeholder="MM/YY"
                            value={card.expiry}
                            onChange={(e) => {
                              setCard({ ...card, expiry: e.target.value });
                              setProblem(null);
                            }}
                            className={cn(FIELD, "tabular")}
                            autoComplete="off"
                            enterKeyHint="next"
                          />
                        </Field>
                        <Field label="CVV" id="card-cvv">
                          <Input
                            id="card-cvv"
                            type="password"
                            inputMode="numeric"
                            value={card.cvv}
                            onChange={(e) => {
                              setCard({ ...card, cvv: e.target.value });
                              setProblem(null);
                            }}
                            className={cn(FIELD, "tabular")}
                            autoComplete="off"
                            enterKeyHint="next"
                          />
                        </Field>
                      </div>
                      <Field label="Name on card" id="card-name">
                        <Input
                          id="card-name"
                          value={card.name}
                          onChange={(e) => setCard({ ...card, name: e.target.value })}
                          className={FIELD}
                          autoComplete="off"
                          enterKeyHint="done"
                        />
                      </Field>
                      {demoMode && (
                        <p className="flex items-center gap-2 text-small text-foreground-2">
                          <DemoTag /> Test card details are filled in.
                        </p>
                      )}
                    </div>
                  )}

                  {method === "netbanking" && (
                    <div role="radiogroup" aria-label="Bank" onKeyDown={chooseWithArrowKeys} className="grid gap-2">
                      {BANKS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          role="radio"
                          aria-checked={bank === b}
                          onClick={() => setBank(b)}
                          className={cn(
                            "flex h-12 items-center gap-3 rounded-xl border bg-card px-3.5 text-left text-small font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            bank === b ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                          )}
                        >
                          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground">
                            <Landmark className="size-3.5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{b}</span>
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border-2",
                              bank === b ? "border-primary bg-primary" : "border-input",
                            )}
                          >
                            {bank === b && <span className="size-2 rounded-full bg-primary-foreground" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {problem && (
                  <p id="pay-problem" role="alert" className="mb-2.5 text-small font-medium text-destructive">
                    {problem}
                  </p>
                )}
                <Button onClick={pay} disabled={!booking} className="h-14 w-full rounded-full text-base font-semibold">
                  {phase === "error" ? "Try again" : `Pay ${formatINR(amount)}`}
                  <ChevronRight className="size-4 opacity-70" aria-hidden />
                </Button>
                {demoMode && (
                  <p className="mt-3 flex items-center justify-center gap-2 text-small text-foreground-2">
                    <DemoTag /> No money is charged.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ProcessingView({ method }: { method: Method }) {
  const text =
    method === "upi"
      ? "Waiting for UPI confirmation"
      : method === "card"
        ? "Authorising your card"
        : "Connecting to your bank";
  const Icon = METHODS.find((m) => m.id === method)?.icon ?? CreditCard;
  return (
    <div className="flex min-h-[21rem] flex-col items-center justify-center gap-5 px-6 py-10 text-center" aria-live="polite">
      <span className="relative grid size-20 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-primary/15 animate-pulse-ring" />
        <span className="absolute inset-0 rounded-full border-4 border-secondary" />
        <LoaderCircle className="absolute size-20 animate-spin text-primary [stroke-width:1.25]" aria-hidden />
        <Icon className="size-6 text-foreground" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold">Processing payment</p>
        <p className="text-small text-foreground-2">{text}. Please keep this screen open.</p>
      </div>
    </div>
  );
}

function SuccessView({ booking }: { booking: Booking }) {
  return (
    <div className="flex min-h-[21rem] flex-col items-center justify-center gap-5 px-6 py-10 text-center" aria-live="polite">
      <span className="relative grid size-20 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-success/25 animate-pulse-ring" />
        <span className="checkout-pop grid size-20 place-items-center rounded-full bg-success text-primary-foreground">
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </span>
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-2xl">Payment successful</p>
        <p className="text-small text-foreground-2">
          <span className="tabular">{formatINR(booking.amount)}</span> paid. Your booking is confirmed.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-muted px-4 py-2.5">
        <p className="text-sm font-medium text-muted-foreground">Booking ID</p>
        <p className="tabular font-mono text-lg font-semibold tracking-wider text-foreground">{booking.code}</p>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Taking you to your visit
      </p>
      <style>{`
        .checkout-pop { animation: checkout-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes checkout-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
