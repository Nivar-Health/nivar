"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, CircleCheck, LoaderCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buttonClass } from "./primitives";

const CITIES = ["Bangalore", "Mysuru", "Hyderabad", "Pune", "Chennai", "Other"];

type Fields = { name: string; phone: string; city: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const FIELD_ORDER: (keyof Fields)[] = ["name", "phone", "city", "message"];

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  else if (f.name.trim().length > 80) e.name = "Keep the name under 80 characters.";
  if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = "Enter a 10 digit mobile number, like 98450 12345.";
  if (!f.city) e.city = "Choose a city.";
  if (f.message.length > 1000) e.message = "Keep the message under 1,000 characters.";
  return e;
}

const FIELD =
  "h-12 w-full scroll-mt-28 rounded-[10px] border border-input bg-white px-3.5 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 hover:border-[#bdbdb6] focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/15 aria-invalid:border-danger aria-invalid:ring-danger/15";

export function CallbackForm() {
  const uid = useId();
  const [fields, setFields] = useState<Fields>({ name: "", phone: "", city: "Bangalore", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Fields | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formHeight, setFormHeight] = useState<number | null>(null);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (submitting) return;
    const found = validate(fields);
    setErrors(found);
    setServerError(null);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const message = fields.message.trim();
      await api.post(
        "/leads",
        { name: fields.name.trim(), phone: fields.phone, city: fields.city, ...(message ? { message } : {}) },
        { anonymous: true },
      );
      setFormHeight(formRef.current?.offsetHeight ?? null);
      setDone(fields);
    } catch (err) {
      setServerError(errorMessage(err, "We could not send your request. Please try again, or call us."));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const first = done.name.trim().split(/\s+/)[0];
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center px-2 text-center"
        style={{ minHeight: formHeight ?? 460 }}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-foreground">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <h3 className="font-display mt-5 text-[1.75rem] font-medium tracking-[-0.02em] text-foreground">
          Thanks, {first}. We will call you soon.
        </h3>
        <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
          A Nivar care coordinator will call you on{" "}
          <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
            +91 {done.phone.slice(0, 5)} {done.phone.slice(5)}
          </span>
          , usually within 30 minutes between 7 am and 9 pm.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setFields({ name: "", phone: "", city: "Bangalore", message: "" });
          }}
          className="mt-6 rounded-sm text-sm font-semibold text-foreground underline decoration-border underline-offset-[5px] outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Send another request
        </button>
      </div>
    );
  }

  const id = (k: string) => `${uid}-${k}`;
  const describe = (k: keyof Fields, hint?: boolean) =>
    [errors[k] ? id(`${k}-error`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <form method="post" ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-describedby={serverError ? id("server") : undefined}>
      <Field label="Your name" htmlFor={id("name")} error={errors.name} errorId={id("name-error")}>
        <input
          id={id("name")}
          name="name"
          autoComplete="name"
          placeholder="Full name"
          value={fields.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={describe("name")}
          className={FIELD}
        />
      </Field>

      <Field label="Mobile number" htmlFor={id("phone")} error={errors.phone} errorId={id("phone-error")}>
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-border pr-3 pl-3.5 text-base font-medium text-muted-foreground"
          >
            +91
          </span>
          <input
            id={id("phone")}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98450 12345"
            value={fields.phone.length > 5 ? `${fields.phone.slice(0, 5)} ${fields.phone.slice(5)}` : fields.phone}
            onChange={(e) => {
              let digits = e.target.value.replace(/\D/g, "");
              if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
              if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
              set("phone", digits.slice(0, 10));
            }}
            aria-invalid={!!errors.phone}
            aria-describedby={describe("phone")}
            className={cn(FIELD, "pl-[4.25rem] tabular-nums")}
          />
        </div>
      </Field>

      <Field label="City" htmlFor={id("city")} error={errors.city} errorId={id("city-error")}>
        <div className="relative">
          <select
            id={id("city")}
            name="city"
            value={fields.city}
            onChange={(e) => set("city", e.target.value)}
            aria-invalid={!!errors.city}
            aria-describedby={describe("city")}
            className={cn(FIELD, "appearance-none pr-10")}
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c === "Bangalore" ? c : c === "Other" ? "Another city" : `${c} (coming soon)`}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </Field>

      <Field
        label="Anything we should know?"
        optional
        htmlFor={id("message")}
        error={errors.message}
        errorId={id("message-error")}
      >
        <textarea
          id={id("message")}
          name="message"
          rows={3}
          placeholder="For example, monthly BP checks for my mother in Jayanagar"
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={!!errors.message}
          aria-describedby={describe("message")}
          className={cn(FIELD, "h-auto min-h-24 resize-y py-3 leading-relaxed")}
        />
      </Field>

      {serverError && (
        <p id={id("server")} role="alert" className="rounded-[10px] bg-danger/8 px-4 py-3 text-sm text-danger">
          {serverError}
        </p>
      )}

      <button type="submit" disabled={submitting} className={buttonClass("primary", "w-full")}>
        {submitting ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Sending
          </>
        ) : (
          "Request a callback"
        )}
      </button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        We only use your number to call you about this request.
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  errorId,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-sm font-medium text-foreground">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
