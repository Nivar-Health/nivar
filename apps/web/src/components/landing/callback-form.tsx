"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, CircleAlert, LoaderCircle, Lock, MapPin, PhoneIncoming, X } from "lucide-react";
import { ApiError, publicApi } from "@/lib/http";
import { SITE } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { Disclosure } from "./disclosure";
import { LANGUAGES } from "./l10n";
import { buttonClass } from "./primitives";
import { Pearl } from "./take-a-minute/pearl";
import type { WhoFor as LinkWhoFor } from "./whatsapp";

/** The pilot serves one area, so the city is fixed rather than chosen. */
const CITY = `${SITE.city} (${SITE.area})`;

/** The "For" pills. Prefill links name one of them in `data-for` (whatsapp.tsx WhoFor). */
const WHO_FOR: readonly LinkWhoFor[] = ["Myself", "A parent", "A child", "Someone else"];
type WhoFor = "" | LinkWhoFor;
type CallLanguage = "" | (typeof LANGUAGES)[number]["english"];

const isWhoFor = (v: string | undefined): v is LinkWhoFor => WHO_FOR.some((w) => w === v);

type Fields = { name: string; phone: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: "", phone: "", message: "" };
const FIELD_ORDER: (keyof Fields)[] = ["name", "phone", "message"];

/** The user's own note. The composed message (who for, asking about, language, note) is capped below. */
const MESSAGE_MAX = 900;
/** The API's cap on the composed message (api/leads). */
const COMPOSED_MAX = 1000;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  else if (f.name.trim().length > 80) e.name = "Keep the name under 80 characters.";
  // No-break space: the example number never splits across lines.
  if (!/^[6-9]\d{9}$/.test(f.phone)) e.phone = "Enter a 10-digit mobile number, like 98450\u00a012345.";
  if (f.message.length > MESSAGE_MAX) e.message = "Keep the message under 900 characters.";
  return e;
}

/**
 * "For: …" / "Asking about: …" / "Preferred language for the call: …" / the note. Only a near-full note
 * can push it past the API cap; then our own "Asking about" label is shortened, never the visitor's words.
 */
function composeMessage(whoFor: WhoFor, topic: string | null, language: CallLanguage, note: string) {
  const lines = (label: string | null) =>
    [
      whoFor && `For: ${whoFor}`,
      label && `Asking about: ${label}`,
      language && `Preferred language for the call: ${language}`,
      note.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  const full = lines(topic);
  if (!topic || full.length <= COMPOSED_MAX) return full;
  const keep = topic.length - (full.length - COMPOSED_MAX) - 1;
  return lines(keep > 0 ? `${topic.slice(0, keep)}…` : null);
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

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.dataset.motion === "paused";
const coarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

/** Input from the visitor while a jump settles: they have taken over, so nothing moves or takes focus. */
const TAKEOVER = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** Where a jump to `el` comes to rest: its top less its scroll margin, within the scroll range. */
function landingY(el: HTMLElement) {
  const y = window.scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  return Math.min(Math.max(0, y), document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * Runs `then` once the jump to #callback has settled (spec §4.8): on the scrollend that leaves the page
 * at `targetY`, or from 700 ms on, as soon as nothing is scrolling (no scrollend, nothing to scroll, or
 * the jump ended elsewhere). A scrollend left over from an earlier scroll is ignored, and a long smooth
 * scroll is waited out. Reduced motion jumps instantly, so it runs as soon as the page is at the target
 * (allowing up to 700 ms for the router's scroll). Returns a cancel function.
 *
 * next/link does not scroll at all when the URL already ends in #callback (a second callback link after
 * a first one), so if nothing has moved by 150 ms the jump is made here, to the same place.
 */
function afterJump(targetY: number, reduced: boolean, then: () => void): () => void {
  const start = performance.now();
  let lastScroll = 0;
  let timer = 0;
  let rescueTimer = 0;
  const arrived = () => Math.abs(window.scrollY - targetY) < 2;
  const onScroll = () => {
    lastScroll = performance.now();
  };
  const onScrollEnd = () => {
    if (arrived()) finish();
  };
  const cancel = () => {
    window.removeEventListener("scrollend", onScrollEnd);
    window.removeEventListener("scroll", onScroll);
    for (const type of TAKEOVER) window.removeEventListener(type, cancel, true);
    window.clearTimeout(timer);
    window.clearTimeout(rescueTimer);
  };
  function finish() {
    cancel();
    then();
  }
  const rescue = () => {
    if (!lastScroll && !arrived()) window.scrollTo({ top: targetY, behavior: reduced ? "instant" : "smooth" });
  };
  const poll = () => {
    const now = performance.now();
    const quiet = now - lastScroll > 150;
    const settled = reduced ? arrived() || (quiet && now - start >= 700) : quiet;
    if (settled || now - start > 3000) finish();
    else timer = window.setTimeout(poll, reduced ? 16 : 100);
  };
  for (const type of TAKEOVER) window.addEventListener(type, cancel, { capture: true, passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  if (!reduced) window.addEventListener("scrollend", onScrollEnd);
  rescueTimer = window.setTimeout(rescue, 150);
  timer = window.setTimeout(poll, reduced ? 0 : 700);
  return cancel;
}

/**
 * Brings a focused field clear of the fixed nav and of the visible bottom edge (or the keyboard). When
 * it has to move, it shows `context` (the chip and the pills above the field) just under the nav if
 * the field still fits below it, as on a phone held sideways; otherwise it centres the field.
 */
function keepInView(el: HTMLElement, smooth: boolean, context?: HTMLElement | null) {
  const nav = document.querySelector("[data-landing] > header")?.getBoundingClientRect().bottom ?? 0;
  const vv = window.visualViewport;
  const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const r = el.getBoundingClientRect();
  if (r.top >= nav + 8 && r.bottom <= bottom - 8) return;
  const behavior = smooth ? "smooth" : "instant";
  const c = context?.getBoundingClientRect();
  if (c && r.bottom - c.top <= bottom - nav - 24) window.scrollBy({ top: c.top - (nav + 12), behavior });
  else el.scrollIntoView({ block: "center", behavior });
}

/**
 * On touch screens the keyboard may open over the focused field: once the visual viewport shrinks,
 * centre the field in what is left (mobile addendum M7). Gives up after a second and a half.
 */
function centreAboveKeyboard(el: HTMLElement) {
  const vv = window.visualViewport;
  if (!vv) return;
  const before = vv.height;
  const onResize = () => {
    if (vv.height > before - 80) return;
    stop();
    if (document.activeElement === el) el.scrollIntoView({ block: "center" });
  };
  const stop = () => {
    vv.removeEventListener("resize", onResize);
    window.clearTimeout(timer);
  };
  vv.addEventListener("resize", onResize);
  const timer = window.setTimeout(stop, 1500);
}

/** A soft settle on what a prefill link just filled in, so the eye finds it. Transform and opacity only. */
function settle(el: Element | null | undefined, delay = 0) {
  el?.animate(
    [
      { opacity: 0.4, transform: "translateY(6px) scale(0.97)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 460, delay, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
  );
}

const FIELD =
  "h-13 w-full scroll-mt-28 rounded-xl border border-input bg-white px-4 text-base text-foreground transition-[border-color,background-color] duration-160 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-transparent hover:border-input-hover focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_var(--primary),0_0_0_5px_color-mix(in_oklab,var(--primary)_14%,transparent)] aria-invalid:border-danger aria-invalid:bg-danger-bg aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--danger),0_0_0_5px_color-mix(in_oklab,var(--danger)_14%,transparent)]";

/**
 * 44px pills; pressed: a tint and, with motion, a 0.98 scale (90 ms in, 180 ms out). In forced colours
 * the chosen pill keeps its own Highlight fill: without forced-color-adjust:none the browser would
 * paint a Canvas backplate behind HighlightText and the label would vanish. In the two-by-two grid the sides
 * are 12px, so "Someone else" keeps one line in a 128px cell at 360.
 */
const RADIO_PILL =
  "relative inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-card px-4 min-[22.5rem]:max-[32rem]:px-3 text-[0.9375rem] font-medium text-foreground transition-[background-color,border-color,color,transform] duration-180 ease-standard select-none hover:bg-muted active:bg-aqua-2/60 active:duration-90 motion-safe:active:scale-[0.98] has-[:checked]:border-primary has-[:checked]:bg-aqua has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-ring forced-colors:has-[:checked]:border-[Highlight] forced-colors:has-[:checked]:bg-[Highlight] forced-colors:has-[:checked]:text-[HighlightText] forced-colors:has-[:checked]:forced-color-adjust-none forced-colors:has-[:checked]:outline-[CanvasText]";

/**
 * Text button in the success state. Text flows inline; the outline hugs the text and ::before makes
 * the hit area 44px.
 */
const SUCCESS_ACTION =
  "relative rounded-sm text-sm font-semibold text-balance underline underline-offset-4 hover:decoration-current focus-ring before:absolute before:-inset-x-2 before:-inset-y-3";

export function CallbackForm() {
  const uid = useId();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [whoFor, setWhoFor] = useState<WhoFor>("");
  const [language, setLanguage] = useState<CallLanguage>("");
  /** What a prefill link asked about (the chip, and the "Asking about" line). */
  const [topic, setTopic] = useState<string | null>(null);
  /** The note a prefill link wrote, while it may still be replaced or cleared with the chip. */
  const [prefilled, setPrefilled] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Fields | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  /** The note-and-language row (id callback-more). */
  const noteRef = useRef<HTMLDetailsElement>(null);
  /** A prefill wrote the note while the success state showed: open the row once the form is back. */
  const openNoteLater = useRef(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const refocusForm = useRef(false);
  const cancelJump = useRef<(() => void) | null>(null);
  const [formHeight, setFormHeight] = useState<number | null>(null);

  // The control that held focus (submit, or "Send another request") is gone after each swap: move focus on.
  // On success the message is sticky inside the card; nudge the page just enough that all of it clears
  // the fixed nav and the bottom edge (the card's own edge can pin it under the nav on a phone).
  useEffect(() => {
    if (done) {
      headingRef.current?.focus({ preventScroll: true });
      const box = successRef.current?.getBoundingClientRect();
      if (!box) return;
      const header = document.querySelector<HTMLElement>("[data-landing] > header");
      const nav = header ? header.offsetTop + header.offsetHeight : 0; // the layout box: the typing state's translate may still be easing out
      const view = window.visualViewport?.height ?? window.innerHeight;
      const up = nav + 12 - box.top;
      const down = box.bottom - (view - 12);
      const by = up > 0 ? -up : down > 0 ? Math.min(down, box.top - nav - 12) : 0;
      if (by) window.scrollBy({ top: by, behavior: prefersReducedMotion() ? "instant" : "smooth" });
      return;
    }
    if (openNoteLater.current && noteRef.current) {
      openNoteLater.current = false;
      noteRef.current.open = true;
    }
    if (refocusForm.current) {
      refocusForm.current = false;
      formRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    }
  }, [done]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const id = (k: string) => `${uid}-${k}`;

  /** Opens the note-and-language row; from the success state, as soon as the form is back. */
  const openNote = () => {
    if (noteRef.current) noteRef.current.open = true;
    else openNoteLater.current = true;
  };

  const clearForm = () => {
    setFields(EMPTY);
    setWhoFor("");
    setLanguage("");
    setTopic(null);
    setPrefilled(null);
    setErrors({});
    setServerError(null);
    setDone(null);
    setNoteOpen(false);
  };

  /**
   * A prefill link was clicked (spec §4.8): `data-for` picks the pill; `data-need` fills the note when
   * it is empty (or still holds an earlier prefill) and `data-need-label` shows the chip. From the
   * success state it starts a fresh request. Once the jump settles, "Your name" takes focus in place.
   */
  const prefill = useEffectEvent((link: HTMLAnchorElement) => {
    const forWho = link.dataset.for;
    const need = link.dataset.need?.trim() || null;
    const label = link.dataset.needLabel?.trim() || null;
    const fresh = done !== null;
    const note = fresh ? "" : fields.message;
    const untouched = note.trim() === "" || (prefilled !== null && note === prefilled);

    if (fresh) clearForm();
    if (isWhoFor(forWho)) setWhoFor(forWho);
    if (need && untouched) {
      // Open first, so the note it writes is in view (spec U10).
      openNote();
      setFields((f) => ({ ...f, message: need }));
      setPrefilled(need);
      if (errors.message) setErrors((e) => ({ ...e, message: undefined }));
    }
    if (need || label) setTopic(label);

    const reduced = prefersReducedMotion();
    const section = document.getElementById("callback");
    cancelJump.current?.();
    cancelJump.current = afterJump(section ? landingY(section) : window.scrollY, reduced, () => {
      cancelJump.current = null;
      const name = nameRef.current;
      if (!name) return;
      name.focus({ preventScroll: true });
      keepInView(name, !reduced, chipRef.current?.parentElement);
      if (coarsePointer()) centreAboveKeyboard(name);
      if (!reduced) {
        settle(chipRef.current);
        if (isWhoFor(forWho)) settle(pillsRef.current?.querySelector("input:checked")?.closest("label"), 70);
      }
    });
  });

  // One capture-phase listener for every prefill link on the page (CareCta, ContactCtas). Capture runs
  // before next/link's own handler; nothing calls preventDefault, so the native (or router) hash scroll
  // still runs, and without JS the links simply land on #callback.
  useEffect(() => {
    const jump = cancelJump;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[data-need], a[data-for]") : null;
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      if (url.hash !== "#callback" || url.pathname !== window.location.pathname) return;
      prefill(link);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      jump.current?.();
    };
  }, []);

  const clearTopic = () => {
    if (prefilled !== null && fields.message === prefilled) set("message", "");
    setPrefilled(null);
    setTopic(null);
    nameRef.current?.focus();
  };

  /**
   * Touch keyboards (enterKeyHint, M7 as amended by U10): the name's "next" moves to the phone, and the
   * phone's "send" submits, because every field after it is optional. Return in the note is a newline.
   * Hardware keys keep their defaults.
   */
  const enterMovesTo = (next: string) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || !coarsePointer()) return;
    e.preventDefault();
    document.getElementById(id(next))?.focus();
  };
  const enterSends = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || !coarsePointer()) return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  };

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (submitting) return;
    const found = validate(fields);
    setErrors(found);
    setServerError(null);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      // The note's error shows inside its row: open the row before focus can go there.
      if (found.message) openNote();
      document.getElementById(id(first))?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const composed = composeMessage(whoFor, topic, language, fields.message);
      await publicApi.post("/leads", {
        name: fields.name.trim(),
        phone: fields.phone,
        city: CITY,
        ...(composed ? { message: composed } : {}),
      });
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
    clearForm();
  };

  if (done) {
    const first = done.name.trim().split(/\s+/)[0];
    return (
      // Keeps the form's height (nothing below moves), and the message is sticky inside it: centred
      // while the card fits the screen, held in view while a tall phone card is scrolled.
      <div role="status" className="flex flex-col justify-center" style={{ minHeight: formHeight ?? 460 }}>
        <div
          ref={successRef}
          className="sticky top-[max(6rem,calc(50svh-15rem))] bottom-6 flex flex-col items-center px-2 py-6 text-center"
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
            {/* One line each, so "We" never ends the first line. The space keeps the text whole for copy and AT. */}
            <span className="block">Thanks, {first}.</span>{" "}
            <span className="block">We will call you soon.</span>
          </h3>
          <p className="mt-3 max-w-[38ch] text-body text-balance text-foreground-2">
            A Nivar care coordinator will call you on{" "}
            <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
              +91 {done.phone.slice(0, 5)} {done.phone.slice(5)}
            </span>
            , usually within {units(SITE.callbackWithin)} {units(SITE.hours.inSentence)}.
          </p>
          {/* Opens Take a minute on Breathe (cluster.tsx listens for data-minute-open); the orb rises
              from this pearl, and focus comes back here when it closes. */}
          <button
            type="button"
            data-minute-open="breathe"
            data-minute-scope=""
            aria-haspopup="dialog"
            className="nv-cb-minute mt-8 flex w-full max-w-[20rem] cursor-pointer items-center gap-3.5 rounded-2xl py-3 pr-5 pl-3.5 text-left text-[0.9375rem] leading-snug font-semibold text-ink focus-ring"
          >
            <Pearl size={32} data-minute-origin="" />
            <span className="text-balance">While you wait, take a minute</span>
          </button>
          <button type="button" onClick={reset} className={cn(SUCCESS_ACTION, "mt-6 text-foreground decoration-border-strong")}>
            Send another request
          </button>
        </div>
      </div>
    );
  }

  const describe = (k: string, hint?: boolean) =>
    [errors[k as keyof Fields] ? id(`${k}-error`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") ||
    undefined;

  /** On the closed row, what it will send: "Note added", the language, or both. */
  const noteMeta = noteOpen
    ? null
    : [fields.message.trim() && "Note added", language].filter(Boolean).join(" \u00b7 ") || null;

  return (
    <form
      method="post"
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-5 sm:gap-6"
      aria-describedby={serverError ? id("server") : undefined}
    >
      <div className="flex flex-col">
        {/* The chip row is always in the DOM (empty and zero-height without a topic), so its status
            text is announced when a prefill link fills it. The clear button sits outside the region. */}
        <div
          ref={chipRef}
          className={cn(
            "nv-cb-chip flex items-center",
            topic && "mb-5 min-h-12 gap-1 rounded-2xl bg-aqua py-0.5 pr-0.5 pl-4 ring-1 ring-primary/12 ring-inset",
          )}
        >
          <p role="status" className={cn("min-w-0 flex-1 text-small text-pretty text-ink-2", topic && "py-2")}>
            {topic && (
              <>
                Asking about: <span className="font-semibold text-ink">{topic}</span>
              </>
            )}
          </p>
          {topic && (
            <button
              type="button"
              onClick={clearTopic}
              aria-label={`Clear: ${topic}`}
              className="nv-cb-clear flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary focus-ring"
            >
              <X aria-hidden className="size-[1.125rem]" />
            </button>
          )}
        </div>

        <fieldset>
          <legend className="flex w-full items-baseline justify-between gap-x-1.5 text-[0.9375rem] font-medium text-balance text-foreground">
            Who is the visit for? <span className="text-caption font-normal text-muted-foreground">Optional</span>
          </legend>
          {/* 360 to 511px: two by two, never 3 + 1. Narrower they wrap 2 + 2 anyway; wider all four fit one row. */}
          <div
            ref={pillsRef}
            className="mt-2 flex flex-wrap gap-2 min-[22.5rem]:max-[32rem]:grid min-[22.5rem]:max-[32rem]:grid-cols-2"
          >
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
      </div>

      <Field label="Your name" htmlFor={id("name")} error={errors.name} errorId={id("name-error")}>
        <input
          ref={nameRef}
          id={id("name")}
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          spellCheck={false}
          placeholder="Full name"
          value={fields.name}
          onChange={(e) => set("name", e.target.value)}
          onKeyDown={enterMovesTo("phone")}
          aria-invalid={!!errors.name}
          aria-describedby={describe("name")}
          className={FIELD}
        />
      </Field>

      <Field
        label="Mobile number"
        htmlFor={id("phone")}
        hint="10-digit mobile number."
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
            enterKeyHint="send"
            placeholder="98450 12345"
            value={fields.phone.length > 5 ? `${fields.phone.slice(0, 5)} ${fields.phone.slice(5)}` : fields.phone}
            onChange={(e) => {
              let digits = e.target.value.replace(/\D/g, "");
              if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
              if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
              set("phone", digits.slice(0, 10));
            }}
            onKeyDown={enterSends}
            aria-invalid={!!errors.phone}
            aria-describedby={describe("phone", true)}
            className={cn(FIELD, "pl-[4.5rem] tabular-nums")}
          />
        </div>
      </Field>

      {/* The area, said once; the request still carries the city (CITY). */}
      <p className="flex items-start gap-2 text-small text-pretty text-ink-2">
        <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
        <span>
          We visit homes in {SITE.area}, {SITE.city}.
        </span>
      </p>

      {/* Both optional, so they wait behind one row; its value says so, and while closed its meta says
          what it will send. The row opens for a prefill and for the note's error (spec U10). */}
      <div className="nv-disc-group">
        <Disclosure
          id="callback-more"
          ref={noteRef}
          title="Add a note or a language for the call"
          meta={noteMeta}
          value={<span className="text-caption font-medium text-ink-3">Optional</span>}
          onToggle={(e) => setNoteOpen(e.currentTarget.open)}
          bodyClassName="flex flex-col gap-6 pt-1"
        >
          <Field
            label="Preferred language for the call"
            htmlFor={id("language")}
            hint="We'll match a coordinator who speaks it when we can."
            hintId={id("language-hint")}
            hintClassName="text-small"
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

          <Field label="Anything we should know?" htmlFor={id("message")} error={errors.message} errorId={id("message-error")}>
            <textarea
              id={id("message")}
              name="message"
              rows={3}
              enterKeyHint="enter"
              // No-break space: "2" never sits alone on the last line.
              placeholder={"For example, a B12 injection for my mother in HSR Layout Sector 2"}
              value={fields.message}
              onChange={(e) => set("message", e.target.value)}
              aria-invalid={!!errors.message}
              aria-describedby={describe("message")}
              className={cn(FIELD, "h-auto min-h-28 resize-y py-3 leading-relaxed")}
            />
          </Field>
        </Disclosure>
      </div>

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
          className={buttonClass(
            "accent",
            "h-14 w-full text-[1.0625rem] duration-180 active:bg-marigold-hover active:duration-90 motion-safe:active:scale-[0.97] motion-reduce:active:scale-100 sm:h-13",
            "lg",
          )}
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
        <div className="flex flex-col gap-2">
          {/* Phones: the section's points are hidden, so the call-back promise sits under the button. */}
          <p className="flex items-start gap-2 text-small text-pretty text-ink-2 sm:hidden">
            <PhoneIncoming aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
            <span>
              A call back within {units(SITE.callbackWithin)},{" "}
              <span className="whitespace-nowrap">{SITE.hours.short}</span>.
            </span>
          </p>
          <p className="flex items-start gap-2.5 text-caption text-pretty text-muted-foreground">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            We only use your number to call you about this request.
          </p>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  hintId,
  hintClassName,
  error,
  errorId,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  hintId?: string;
  /** A hint that is a sentence to read (not meta) sets its own size here. */
  hintClassName?: string;
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
        <p id={hintId} className={cn("-mt-0.5 text-caption text-pretty text-muted-foreground", hintClassName)}>
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
