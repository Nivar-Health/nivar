"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, ChevronDown, CircleAlert, LoaderCircle, Lock, MapPin } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { LANGUAGES } from "./l10n";
import { buttonClass } from "./primitives";

/** The pilot serves one area, so the city is fixed rather than chosen. */
const CITY = `${SITE.city} (${SITE.area})`;

const WHO_FOR = ["Myself", "A parent", "A child", "Someone else"] as const;
type WhoFor = "" | (typeof WHO_FOR)[number];
type CallLanguage = "" | (typeof LANGUAGES)[number]["english"];

type Fields = { name: string; phone: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: "", phone: "", message: "" };
const FIELD_ORDER: (keyof Fields)[] = ["name", "phone", "message"];

/** The user's own note. The composed message (who for + language + note) stays under the 1000-character API cap. */
const MESSAGE_MAX = 900;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  else if (f.name.trim().length > 80) e.name = "Keep the name under 80 characters.";
  // No-break space: the example number never splits across lines.
  if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = "Enter a 10-digit mobile number, like 98450\u00a012345.";
  if (f.message.length > MESSAGE_MAX) e.message = "Keep the message under 900 characters.";
  return e;
}

/** Keep each number with its unit ("7 AM", "30 minutes") while the sentence wraps freely. */
const units = (s: string) => s.replace(/(\d) /g, "$1\u00a0");

const SERVER_ERROR = `We could not send your request. Please try again in a minute.${
  SITE.phone ? ` Or call us on ${SITE.phone.display}.` : ""
}`;

/** Show the API's own wording for request problems (validation, rate limit, offline); never a raw 5xx. */
function serverErrorText(err: unknown): string {
  if (err instanceof ApiError && err.status < 500 && err.message) {
    return SITE.phone ? `${err.message} Or call us on ${SITE.phone.display}.` : err.message;
  }
  return SERVER_ERROR;
}

const FIELD =
  "h-13 w-full scroll-mt-28 rounded-xl border border-input bg-white px-4 text-base text-foreground transition-[border-color,box-shadow,background-color] duration-160 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-transparent hover:border-input-hover focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_var(--primary),0_0_0_5px_color-mix(in_oklab,var(--primary)_14%,transparent)] aria-invalid:border-danger aria-invalid:bg-danger-bg aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--danger),0_0_0_5px_color-mix(in_oklab,var(--danger)_14%,transparent)]";

const RADIO_PILL =
  "relative inline-flex h-11 cursor-pointer items-center rounded-full border border-border-strong bg-card px-4 text-[0.9375rem] font-medium text-foreground transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-aqua has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-ring";

/**
 * Text link / text button in the success state. Text flows inline (so a wrapped line keeps its arrow on the
 * last word); the outline hugs the text and ::before makes the hit area 44px.
 */
const SUCCESS_ACTION =
  "relative rounded-sm text-sm font-semibold text-balance underline underline-offset-4 hover:decoration-current focus-ring before:absolute before:-inset-x-2 before:-inset-y-3";

export function CallbackForm() {
  const uid = useId();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [whoFor, setWhoFor] = useState<WhoFor>("");
  const [language, setLanguage] = useState<CallLanguage>("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Fields | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const refocusForm = useRef(false);
  const [formHeight, setFormHeight] = useState<number | null>(null);

  // The control that held focus (submit, or "Send another request") is gone after each swap: move focus on.
  useEffect(() => {
    if (done) {
      headingRef.current?.focus();
    } else if (refocusForm.current) {
      refocusForm.current = false;
      formRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    }
  }, [done]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const id = (k: string) => `${uid}-${k}`;

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (submitting) return;
    const found = validate(fields);
    setErrors(found);
    setServerError(null);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const composed = [
        whoFor && `For: ${whoFor}`,
        language && `Preferred language for the call: ${language}`,
        fields.message.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      await api.post(
        "/leads",
        {
          name: fields.name.trim(),
          phone: fields.phone,
          city: CITY,
          ...(composed ? { message: composed } : {}),
        },
        { anonymous: true },
      );
      setFormHeight(formRef.current?.offsetHeight ?? null);
      setDone(fields);
    } catch (err) {
      setServerError(serverErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    refocusForm.current = true;
    setFields(EMPTY);
    setWhoFor("");
    setLanguage("");
    setErrors({});
    setServerError(null);
    setDone(null);
  };

  if (done) {
    const first = done.name.trim().split(/\s+/)[0];
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center px-2 text-center"
        style={{ minHeight: formHeight ?? 460 }}
      >
        <svg viewBox="0 0 64 64" aria-hidden className="size-16">
          <circle cx="32" cy="32" r="30" fill="var(--mint)" />
          <circle
            className="success-ring"
            cx="32"
            cy="32"
            r="30"
            stroke="var(--teal)"
            strokeWidth={2}
            fill="none"
            pathLength={1}
            transform="rotate(-90 32 32)"
          />
          <path
            // Reduced motion: show the final pose at once (globals shorten durations but keep the 550ms delay).
            className="success-check motion-reduce:[animation-delay:0s]!"
            d="M21 33l8 8 15-16"
            stroke="var(--teal-deep)"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            pathLength={1}
          />
        </svg>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-display mt-5 text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-balance text-foreground outline-none"
        >
          Thanks, {first}. We will call you soon.
        </h3>
        <p className="mt-3 max-w-[38ch] text-body text-balance text-foreground-2">
          A Nivar care coordinator will call you on{" "}
          <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
            +91 {done.phone.slice(0, 5)} {done.phone.slice(5)}
          </span>
          , usually within {units(SITE.callbackWithin)} {units(SITE.hours.inSentence)}.
        </p>
        <a href="#health-tips" className={cn(SUCCESS_ACTION, "mt-6 text-primary decoration-border-strong")}>
          While you wait: take one calm{" "}
          <span className="whitespace-nowrap">
            minute
            <ArrowRight aria-hidden className="ml-1.5 inline-block size-4 align-[-0.1875rem]" />
          </span>
        </a>
        <button type="button" onClick={reset} className={cn(SUCCESS_ACTION, "mt-6 text-foreground decoration-border-strong")}>
          Send another request
        </button>
      </div>
    );
  }

  const describe = (k: string, hint?: boolean) =>
    [errors[k as keyof Fields] ? id(`${k}-error`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <form
      method="post"
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-6"
      aria-describedby={serverError ? id("server") : undefined}
    >
      <fieldset>
        <legend className="flex w-full items-baseline justify-between gap-x-1.5 text-[0.9375rem] font-medium text-balance text-foreground">
          Who is the visit for? <span className="text-caption font-normal text-muted-foreground">Optional</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WHO_FOR.map((v) => (
            <label key={v} className={RADIO_PILL}>
              <input
                type="radio"
                name="whoFor"
                value={v}
                className="sr-only"
                checked={whoFor === v}
                onChange={() => setWhoFor(v)}
              />
              {v}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Your name" htmlFor={id("name")} error={errors.name} errorId={id("name-error")}>
        <input
          id={id("name")}
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          spellCheck={false}
          placeholder="Full name"
          value={fields.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={describe("name")}
          className={FIELD}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor={id("phone")}
        hint="10-digit mobile number. We only call about this request."
        hintId={id("phone-hint")}
        error={errors.phone}
        errorId={id("phone-error")}
      >
        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-px left-px flex items-center rounded-l-[15px] border-r border-border bg-aqua pr-3 pl-3.5 text-base font-medium text-muted-foreground",
              errors.phone && "bg-transparent",
            )}
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
            aria-describedby={describe("phone", true)}
            className={cn(FIELD, "pl-[4.5rem] tabular-nums")}
          />
        </div>
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-[0.9375rem] font-medium text-foreground">City</p>
        <p className="flex h-13 items-center gap-2.5 rounded-xl border border-border bg-aqua px-4 text-base text-foreground"
        >
          <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
          {CITY}
        </p>
      </div>

      <Field
        label="Preferred language for the call"
        optional
        htmlFor={id("language")}
        hint="We'll match a coordinator who speaks it when we can."
        hintId={id("language-hint")}
      >
        <div className="relative">
          <select
            id={id("language")}
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as CallLanguage)}
            // The closed select shows the chosen endonym: give it that lang so it renders in the Noto face.
            lang={LANGUAGES.find((l) => l.english === language && l.lang !== "en-IN")?.lang}
            aria-describedby={describe("language", true)}
            className={cn(FIELD, "appearance-none pr-10")}
          >
            <option value="">No preference</option>
            {LANGUAGES.map((l) => (
              <option key={l.lang} value={l.english} lang={l.lang}>
                {l.lang === "en-IN" ? l.endonym : `${l.endonym} (${l.english})`}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-primary"
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
          placeholder="For example, a B12 injection for my mother in HSR Layout Sector 2"
          value={fields.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={!!errors.message}
          aria-describedby={describe("message")}
          className={cn(FIELD, "h-auto min-h-28 resize-y py-3 leading-relaxed")}
        />
      </Field>

      {serverError && (
        <div
          id={id("server")}
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>{serverError}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          aria-disabled={submitting || undefined}
          className={buttonClass("accent", "w-full", "lg")}
        >
          {submitting ? (
            <>
              {/* A loop like any other: it rests under reduced motion (the "Sending…" text carries the state). */}
              <LoaderCircle className="motion-loop animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Request a callback"
          )}
        </button>
        <p className="flex items-start gap-2 text-caption text-pretty text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          We only use your number to call you about this request.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-x-1.5 text-[0.9375rem] font-medium text-balance text-foreground"
      >
        {label}
        {optional && <span className="text-caption font-normal text-muted-foreground">Optional</span>}
      </label>
      {hint && (
        <p id={hintId} className="-mt-0.5 text-caption text-pretty text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-caption text-pretty text-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
