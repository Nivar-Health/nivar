"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Check, ChevronRight, CreditCard, Landmark, LoaderCircle, Lock, ShieldCheck, Smartphone, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { formatINR, formatPhone } from "@/lib/format";
import type { Booking, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

type Method = Exclude<PaymentMethod, "cash">;
type Phase = "form" | "processing" | "success" | "error";

const UPI_APPS = [
  { id: "gpay", name: "GPay", color: "bg-muted text-foreground" },
  { id: "phonepe", name: "PhonePe", color: "bg-muted text-foreground" },
  { id: "paytm", name: "Paytm", color: "bg-muted text-foreground" },
] as const;

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank", "Yes Bank"];

const METHODS: { id: Method; label: string; icon: typeof CreditCard }[] = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "netbanking", label: "Netbanking", icon: Landmark },
];

/**
 * Mock, Nivar-branded checkout (Razorpay-like). Always succeeds:
 * processing animation, POST /bookings/:id/pay, success, then `onPaid`.
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
  const [card, setCard] = useState({ number: "4111 1111 1111 1111", expiry: "12/29", cvv: "123", name: "Test Card" });
  const [bank, setBank] = useState(BANKS[0]);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
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
    }
    onOpenChange(next);
  };

  const pay = () => {
    if (!booking) return;
    setPhase("processing");
    setError(null);
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
            setError(errorMessage(err, "Payment could not be completed."));
            setPhase("error");
          }, wait),
        );
      });
  };

  const amount = booking?.amount ?? 0;
  const methodValid =
    method === "upi"
      ? upiApp !== "" || /^[\w.-]+@[\w]+$/.test(upiId)
      : method === "card"
        ? card.number.replace(/\s/g, "").length >= 12 && card.expiry.length >= 4 && card.cvv.length >= 3
        : Boolean(bank);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} disablePointerDismissal={busy}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[22px] bg-background text-foreground shadow-2xl outline-none transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:data-ending-style:translate-y-[-46%] sm:data-ending-style:opacity-0 sm:data-starting-style:translate-y-[-46%] sm:data-starting-style:opacity-0",
          )}
        >
          {/* Header */}
          <div className="relative overflow-hidden bg-primary px-5 pt-4 pb-5 text-primary-foreground">
            <div className="relative mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <LogoMark variant="light" className="size-10" />
                <div className="leading-tight">
                  <DialogPrimitive.Title className="text-[15px] font-semibold">Nivar Pay</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-primary-foreground/70">
                    {booking ? `Booking ${booking.code}` : "Secure checkout"}
                    {phone ? ` · ${formatPhone(phone)}` : ""}
                  </DialogPrimitive.Description>
                </div>
              </div>
              {!busy && (
                <DialogPrimitive.Close
                  aria-label="Close checkout"
                  className="-mt-1 -mr-1 grid size-8 place-items-center rounded-full text-primary-foreground/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>
              )}
            </div>
            <div className="relative mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-medium text-primary-foreground/65">Amount payable</p>
                <p className="tabular font-display text-[2rem] leading-none font-medium tracking-tight">{formatINR(amount)}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-primary-foreground/85">
                <ShieldCheck className="size-3.5" aria-hidden /> 100% secure
              </span>
            </div>
          </div>

          {phase === "processing" && <ProcessingView method={method} />}
          {phase === "success" && paid && <SuccessView booking={paid} />}
          {(phase === "form" || phase === "error") && (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-2">
                {phase === "error" && error && (
                  <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-background px-3.5 py-2.5 text-sm text-danger">
                    {error}
                  </div>
                )}
                <div role="tablist" aria-label="Payment method" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      role="tab"
                      type="button"
                      aria-selected={method === m.id}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        method === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <m.icon className="size-4" aria-hidden />
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 min-h-[212px]">
                  {method === "upi" && (
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Pay with a UPI app</p>
                        <div className="grid grid-cols-3 gap-2">
                          {UPI_APPS.map((app) => (
                            <button
                              key={app.id}
                              type="button"
                              onClick={() => setUpiApp(app.id)}
                              aria-pressed={upiApp === app.id}
                              className={cn(
                                "flex flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-3 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                upiApp === app.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                              )}
                            >
                              <span className={cn("grid size-9 place-items-center rounded-full text-[11px] font-bold", app.color)}>
                                {app.name.slice(0, 2)}
                              </span>
                              {app.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        <span className="h-px flex-1 bg-border" /> or enter UPI ID <span className="h-px flex-1 bg-border" />
                      </div>
                      <div>
                        <label htmlFor="upi-id" className="sr-only">
                          UPI ID
                        </label>
                        <Input
                          id="upi-id"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          onFocus={() => setUpiApp("")}
                          placeholder="yourname@bank"
                          className="h-11 rounded-xl bg-card px-3.5 text-[15px]"
                          autoComplete="off"
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
                          onChange={(e) => setCard({ ...card, number: e.target.value })}
                          className="tabular h-11 rounded-xl bg-card px-3.5 text-[15px] tracking-wider"
                          autoComplete="off"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Expiry" id="card-exp">
                          <Input
                            id="card-exp"
                            value={card.expiry}
                            onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                            className="tabular h-11 rounded-xl bg-card px-3.5 text-[15px]"
                            autoComplete="off"
                          />
                        </Field>
                        <Field label="CVV" id="card-cvv">
                          <Input
                            id="card-cvv"
                            type="password"
                            inputMode="numeric"
                            value={card.cvv}
                            onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                            className="tabular h-11 rounded-xl bg-card px-3.5 text-[15px]"
                            autoComplete="off"
                          />
                        </Field>
                      </div>
                      <Field label="Name on card" id="card-name">
                        <Input
                          id="card-name"
                          value={card.name}
                          onChange={(e) => setCard({ ...card, name: e.target.value })}
                          className="h-11 rounded-xl bg-card px-3.5 text-[15px]"
                          autoComplete="off"
                        />
                      </Field>
                      <p className="text-[11px] text-muted-foreground">Demo checkout. Test card details are prefilled.</p>
                    </div>
                  )}

                  {method === "netbanking" && (
                    <div role="radiogroup" aria-label="Bank" className="grid gap-1.5">
                      {BANKS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          role="radio"
                          aria-checked={bank === b}
                          onClick={() => setBank(b)}
                          className={cn(
                            "flex h-11 items-center gap-3 rounded-xl border bg-card px-3.5 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            bank === b ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                          )}
                        >
                          <span className="grid size-7 place-items-center rounded-full border border-border bg-card text-foreground">
                            <Landmark className="size-3.5" aria-hidden />
                          </span>
                          <span className="flex-1">{b}</span>
                          <span
                            className={cn(
                              "grid size-4 place-items-center rounded-full border",
                              bank === b ? "border-primary bg-primary" : "border-input",
                            )}
                          >
                            {bank === b && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button
                  onClick={pay}
                  disabled={!booking || !methodValid}
                  className="h-12 w-full rounded-xl text-[15px] font-semibold"
                >
                  <Lock className="size-4" aria-hidden />
                  {phase === "error" ? "Try again" : `Pay securely ${formatINR(amount)}`}
                  <ChevronRight className="size-4 opacity-70" aria-hidden />
                </Button>
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden />
                  Payments are encrypted. Demo mode, no money is charged.
                </p>
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
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
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
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center gap-5 px-6 py-10 text-center" aria-live="polite">
      <span className="relative grid size-20 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-primary/15 animate-pulse-ring" />
        <span className="absolute inset-0 rounded-full border-4 border-secondary" />
        <LoaderCircle className="absolute size-20 animate-spin text-primary [stroke-width:1.25]" aria-hidden />
        <Lock className="size-6 text-foreground" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">Processing payment</p>
        <p className="text-sm text-muted-foreground">{text}. Please don&apos;t close this window.</p>
      </div>
    </div>
  );
}

function SuccessView({ booking }: { booking: Booking }) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center gap-5 px-6 py-10 text-center" aria-live="polite">
      <span className="relative grid size-20 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-signal/25 animate-pulse-ring" />
        <span className="checkout-pop grid size-20 place-items-center rounded-full bg-signal text-white">
          <Check className="checkout-draw size-10" strokeWidth={3} aria-hidden />
        </span>
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-2xl">Payment successful</p>
        <p className="text-sm text-muted-foreground">
          {formatINR(booking.amount)} paid. Your booking is confirmed.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-muted px-4 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">Booking ID</p>
        <p className="tabular font-mono text-lg font-semibold tracking-wider text-foreground">{booking.code}</p>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Taking you to your visit
      </p>
      <style>{`
        .checkout-pop { animation: checkout-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .checkout-draw path { stroke-dasharray: 30; stroke-dashoffset: 30; animation: checkout-draw 0.45s 0.25s ease-out forwards; }
        @keyframes checkout-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes checkout-draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
