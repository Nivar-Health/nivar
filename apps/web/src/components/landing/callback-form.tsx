"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown, CircleAlert, FileText, LoaderCircle, MapPin, PhoneIncoming, X } from "lucide-react";
import { ApiError, publicApi } from "@/lib/http";
import { checkPhone, formatPhone, phoneDigits, phoneDigitsAt } from "@/lib/phone";
import { SITE, callbackPromiseAt, callbackPromiseFor, type CallbackPromise } from "@/lib/site-facts";
import { cn } from "@/lib/utils";
import { istParts } from "@/server/time";
import { Disclosure } from "./disclosure";
import { LANGUAGES } from "./l10n";
import { focusLanding } from "./page-history";
import { buttonClass } from "./primitives";
import { Pearl } from "./take-a-minute/pearl";
import { WhatsAppLink, whatsappHref, type WhoFor as LinkWhoFor } from "./whatsapp";

/** The pilot serves one area, so the city is fixed rather than chosen. */
const CITY = `${SITE.city} (${SITE.area})`;

/** The "For" pills. Prefill links name one of them in `data-for` (whatsapp.tsx WhoFor). */
const WHO_FOR: readonly LinkWhoFor[] = ["Myself", "A parent", "A child", "Someone else"];
type WhoFor = "" | LinkWhoFor;
type CallLanguage = "" | (typeof LANGUAGES)[number]["english"];

const isWhoFor = (v: unknown): v is LinkWhoFor => WHO_FOR.some((w) => w === v);
const isLanguage = (v: unknown): v is CallLanguage => v === "" || LANGUAGES.some((l) => l.english === v);

type Fields = { name: string; phone: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;
/** What the success state shows: what was sent, and the promise made at the moment it was sent. */
type Sent = Fields & { promise: CallbackPromise };

const EMPTY: Fields = { name: "", phone: "", message: "" };
const FIELD_ORDER: (keyof Fields)[] = ["name", "phone", "message"];

/** The user's own note. The composed message (who for, asking about, language, note) is capped below. */
const MESSAGE_MAX = 900;
/** The API's cap on the composed message (api/leads). */
const COMPOSED_MAX = 1000;

/** Past this a stalled request ends with the error and the visitor's details intact, not "Sending…" for minutes. */
const SEND_TIMEOUT_MS = 15_000;

/** The form's draft, for this tab only: a switch to WhatsApp or a discarded background tab loses nothing. */
const DRAFT_KEY = "nivar.callback-draft";
type Draft = Fields & { whoFor: WhoFor; language: CallLanguage; topic: string | null; prefilled: string | null };

function readDraft(): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    const d: unknown = raw ? JSON.parse(raw) : null;
    return d && typeof d === "object" ? (d as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft | null) {
  try {
    const empty = !d || (!d.name.trim() && !d.phone && !d.message.trim() && !d.whoFor && !d.language && !d.topic);
    if (empty) window.sessionStorage.removeItem(DRAFT_KEY);
    else window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Private modes can refuse storage; the form works the same without a draft.
  }
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  else if (f.name.trim().length > 80) e.name = "Keep the name under 80 characters.";
  const phone = checkPhone(f.phone);
  if (!phone.ok) e.phone = phone.message;
  if (f.message.length > MESSAGE_MAX) e.message = "Keep the note under 900 characters.";
  return e;
}

/** The name as it is sent: trimmed, inner runs of spaces made one. */
const tidyName = (name: string) => name.trim().replace(/\s+/g, " ");

const HONORIFIC = /^(dr|mr|mrs|ms|mx|miss|shri|sri|smt|prof)\.?$/i;

/**
 * Who the success heading thanks: the first word as typed ("Asha"), or the whole name as typed when
 * that word is an initial or a title ("K. Raghavendra Rao", "Dr. Asha Rao"), so nobody is thanked
 * as "K." or "Dr.". Null when there is nothing better than "Thank you."
 */
function greetingName(name: string): string | null {
  const words = tidyName(name).split(" ").filter(Boolean);
  const first = words[0]?.replace(/[.,]+$/, "") ?? "";
  if (!first) return null;
  if (first.length > 2 && !HONORIFIC.test(words[0])) return first;
  const whole = words.join(" ").replace(/[.,]+$/, "");
  return words.length > 1 && whole.length <= 40 ? whole : null;
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

/** Keep each number with its unit ("7 AM", "10:42 AM", "30 minutes") while the sentence wraps freely. */
const units = (s: string) => s.replace(/(\d) /g, "$1\u00a0");

/* ---- The clock: the promise says when the call comes, in India time ---- */

/** Re-reads the clock at each new minute, and when the tab comes back (a phone's timers sleep). */
function subscribeMinute(onChange: () => void) {
  let timer = 0;
  const next = () => 60_000 - (Date.now() % 60_000) + 50;
  const tick = () => {
    onChange();
    timer = window.setTimeout(tick, next());
  };
  timer = window.setTimeout(tick, next());
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}
const minuteNow = () => istParts().minutes;
const noMinute = () => null;

/**
 * Minutes after midnight in India. Null on the server and while hydrating, so the server's sentence
 * (the open one, without a clock time) never mismatches; the clock takes over right after.
 */
function useIndiaMinute(): number | null {
  return useSyncExternalStore(subscribeMinute, minuteNow, noMinute);
}

/** A visitor abroad reads "10:42 AM India time": children arranging care from another country. */
const awayFromIndia = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone !== "Asia/Kolkata" && zone !== "Asia/Calcutta";
};

/** The promise before sending. Null: the server's version, which names no clock time. */
function promiseSentence(p: CallbackPromise | null): string {
  const tz = p && awayFromIndia() ? " India time" : "";
  if (!p) return `${SITE.firstCall.whoCapital} will call you within ${SITE.callbackWithin}.`;
  if (p.state === "open") return `${SITE.firstCall.whoCapital} will call you by ${p.by}${tz}.`;
  if (p.state === "closing") {
    return `We close at ${p.closesAt}${tz}. If we cannot call you before then, we will call you after ${p.opensAt}.`;
  }
  return `We are closed now. We will call you after ${p.opensAt}${tz}.`;
}

/** The call-back promise for a request sent now, kept to the minute. */
export function CallbackPromiseText() {
  const minute = useIndiaMinute();
  return <>{units(promiseSentence(minute === null ? null : callbackPromiseFor(minute)))}</>;
}

/* ---- Emergency numbers ---- */

/**
 * The 112 and 108 links: 47px tall hit areas that reach 44px wide on their outer sides, so 8px stays
 * free between the two (the links sit 25px apart). Pressed: a tint on the digits, 90 ms in, 180 out.
 */
const TEL_LINK =
  "relative rounded-sm font-semibold underline underline-offset-2 transition-colors duration-180 ease-standard focus-ring before:absolute before:-inset-y-3.5";
const TEL = {
  "112": { label: "Call 112, emergency", reach: "before:-right-2 before:-left-5" },
  "108": { label: "Call 108, ambulance", reach: "before:-right-3.5 before:-left-2" },
} as const;
const isTel = (s: string): s is keyof typeof TEL => s in TEL;

/**
 * One of the fixed emergency sentences (SITE.emergency) with 112 and 108 as call links. `tone`
 * matches the surface: mint on the pond, teal on white.
 */
export function EmergencyText({
  text: sentence = SITE.emergency.short,
  tone = "light",
}: {
  text?: string;
  tone?: "light" | "dark";
}) {
  return (
    <>
      {sentence.split(/(112|108)/).map((part, i) =>
        isTel(part) ? (
          <a
            key={i}
            href={`tel:${part}`}
            aria-label={TEL[part].label}
            className={cn(
              TEL_LINK,
              TEL[part].reach,
              tone === "dark" ? "text-mint-glow active:bg-white/12" : "text-primary active:bg-aqua-2/60",
              "active:duration-90",
            )}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/* ---- Errors from sending ---- */

const SERVER_ERROR = "We could not send your request just now. Your details are still here. Try again in a minute.";
const OFFLINE_ERROR =
  "We cannot reach Nivar right now. Check your connection and try again. Your details are still here.";

/** The API's own wording for request problems (validation), without its field prefix; never a raw 5xx. */
function serverErrorText(err: unknown): string {
  // No answer at all: offline, or the request ran past SEND_TIMEOUT_MS (the abort reaches us as is).
  if ((err instanceof ApiError && err.status === 0) || err instanceof DOMException) return OFFLINE_ERROR;
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message) {
    const said = err.message.replace(/^[\w.]+: /, "");
    return /[.?]$/.test(said) ? said : `${said}.`;
  }
  return SERVER_ERROR;
}

/* ---- Scrolling and focus ---- */

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
 * Runs `then` once the jump to #callback has settled: on the scrollend that leaves the page at
 * `targetY`, or from 700 ms on, as soon as nothing is scrolling (no scrollend, nothing to scroll, or
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
 * Brings a focused field clear of the fixed nav and of the visible bottom edge. When it has to move,
 * it shows `context` (the chip and the pills above the field) just under the nav if the field still
 * fits below it, as on a short laptop screen; otherwise it centres the field.
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
 * On touch screens the keyboard covers the lower part of the page. While `field` has focus, keep the
 * block from `from` down to `to` (the phone's label down to the button, or a field and its error) in
 * what is left visible, its top just under the top edge (the nav steps aside while typing). Taller
 * than that, the field is centred instead. Runs now and each time the visible area changes in the
 * next second and a half, as the keyboard rises. Returns a cancel function.
 */
function keepAboveKeyboard(field: HTMLElement, from: HTMLElement, to: HTMLElement): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const place = () => {
    if (document.activeElement !== field) return;
    const top = from.getBoundingClientRect().top;
    const bottom = to.getBoundingClientRect().bottom;
    const visTop = vv.offsetTop;
    const visBottom = vv.offsetTop + vv.height;
    if (bottom - top <= vv.height - 24) {
      if (top >= visTop + 8 && bottom <= visBottom - 8) return;
      window.scrollBy({ top: top - (visTop + 12), behavior: "instant" });
    } else {
      field.scrollIntoView({ block: "center", behavior: "instant" });
    }
  };
  const frame = requestAnimationFrame(place);
  vv.addEventListener("resize", place);
  const stop = () => {
    cancelAnimationFrame(frame);
    vv.removeEventListener("resize", place);
    window.clearTimeout(timer);
    for (const type of ["wheel", "touchstart"] as const) window.removeEventListener(type, stop, true);
  };
  const timer = window.setTimeout(stop, 1500);
  // The visitor scrolls: they have taken over.
  for (const type of ["wheel", "touchstart"] as const) {
    window.addEventListener(type, stop, { capture: true, passive: true });
  }
  return stop;
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
 * 44px pills; pressed: a tint and, with motion, a 0.98 scale (90 ms in, 180 ms out). The chosen pill
 * shows a check as well as its fill, so the state never rests on colour. In forced colours it keeps its
 * own Highlight fill: without forced-color-adjust:none the browser would paint a Canvas backplate behind
 * HighlightText and the label would vanish. In the two-by-two grid the sides are 6px and the check sits
 * 2px from the words, so "Someone else" with its check keeps one line in a 128px cell at 360.
 */
const RADIO_PILL =
  "relative inline-flex h-11 cursor-pointer items-center justify-center gap-1 rounded-full border border-input bg-card px-4 whitespace-nowrap min-[22.5rem]:max-[32rem]:gap-0.5 min-[22.5rem]:max-[32rem]:px-1.5 text-[0.9375rem] font-medium text-foreground transition-[background-color,border-color,color,transform] duration-180 ease-standard select-none hover:bg-muted active:bg-aqua-2/60 active:duration-90 motion-safe:active:scale-[0.98] has-[:checked]:border-primary has-[:checked]:bg-aqua has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-ring forced-colors:has-[:checked]:border-[Highlight] forced-colors:has-[:checked]:bg-[Highlight] forced-colors:has-[:checked]:text-[HighlightText] forced-colors:has-[:checked]:forced-color-adjust-none forced-colors:has-[:checked]:outline-[CanvasText]";

/**
 * Text button in the success state. Text flows inline; the outline hugs the text and ::before makes
 * the hit area 44px.
 */
const SUCCESS_ACTION =
  "relative cursor-pointer rounded-sm text-small font-semibold text-balance underline underline-offset-4 hover:decoration-current focus-ring before:absolute before:-inset-x-2 before:-inset-y-3";

/** What happens after a request, in the words of How it works. */
const NEXT_STEPS = [
  `${SITE.firstCall.whoCapital} calls you and asks what care is needed.`,
  "We tell you the price and a time before anything is booked.",
  "A registered Nivar nurse comes to the home at that time.",
];

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
  const [done, setDone] = useState<Sent | null>(null);
  /** False until the form has read what was typed before the page was ready; the button waits for it. */
  const [ready, setReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  /** The note-and-language row (id callback-more). */
  const noteRef = useRef<HTMLDetailsElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  /** Where focus goes once the form is back after the success state. */
  const refocus = useRef<"first" | "phone" | null>(null);
  /** The field to focus once its error has rendered. */
  const focusError = useRef<keyof Fields | null>(null);
  const cancelJump = useRef<(() => void) | null>(null);
  const cancelKeep = useRef<(() => void) | null>(null);
  const [formHeight, setFormHeight] = useState<number | null>(null);

  const id = (k: string) => `${uid}-${k}`;

  // What the visitor typed or chose before the page was ready (or what the browser restored) stays,
  // field by field; an empty field takes this tab's draft instead.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const draft = readDraft();
    const pick = (typed: string, saved: unknown) => typed || text(saved);
    const typedWho = text(data.get("whoFor"));
    const typedLanguage = text(data.get("language"));
    const savedWho = draft?.whoFor;
    const savedLanguage = draft?.language;
    setFields({
      name: pick(text(data.get("name")), draft?.name),
      phone: phoneDigits(pick(text(data.get("phone")), draft?.phone)),
      message: pick(text(data.get("message")), draft?.message),
    });
    if (isWhoFor(typedWho)) setWhoFor(typedWho);
    else if (isWhoFor(savedWho)) setWhoFor(savedWho);
    if (typedLanguage && isLanguage(typedLanguage)) setLanguage(typedLanguage);
    else if (isLanguage(savedLanguage)) setLanguage(savedLanguage);
    if (draft?.topic) setTopic(text(draft.topic) || null);
    if (draft?.prefilled) setPrefilled(text(draft.prefilled) || null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || done) return;
    writeDraft({ ...fields, whoFor, language, topic, prefilled });
  }, [ready, done, fields, whoFor, language, topic, prefilled]);

  // The control that held focus (submit, "Change it" or "Send another request") is gone after each
  // swap: move focus on. On success the message's top comes to rest just under the nav.
  useEffect(() => {
    if (done) {
      headingRef.current?.focus({ preventScroll: true });
      const box = successRef.current?.getBoundingClientRect();
      if (!box) return;
      const header = document.querySelector<HTMLElement>("[data-landing] > header");
      const nav = header ? header.offsetTop + header.offsetHeight : 0; // the layout box: the typing state's translate may still be easing out
      const view = window.visualViewport?.height ?? window.innerHeight;
      if (box.top < nav + 12 || box.top > view * 0.4) {
        window.scrollBy({ top: box.top - (nav + 12), behavior: prefersReducedMotion() ? "instant" : "smooth" });
      }
      return;
    }
    const target = refocus.current;
    refocus.current = null;
    if (target === "phone") phoneRef.current?.focus();
    else if (target === "first") formRef.current?.querySelector<HTMLElement>("input:not([tabindex='-1']), select, textarea")?.focus();
  }, [done]);

  // A field with an error takes focus once its sentence is on screen, and both stay in view.
  useEffect(() => {
    const key = focusError.current;
    focusError.current = null;
    if (!key) return;
    const field = document.getElementById(id(key));
    if (!field) return;
    field.focus({ preventScroll: true });
    const label = document.querySelector<HTMLElement>(`label[for="${id(key)}"]`) ?? field;
    const error = document.getElementById(id(`${key}-error`)) ?? field;
    if (coarsePointer()) {
      cancelKeep.current?.();
      cancelKeep.current = keepAboveKeyboard(field, label, key === "phone" ? (submitRef.current ?? error) : error);
    } else {
      label.scrollIntoView({ block: "nearest", behavior: "instant" });
      error.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs after each validation pass only
  }, [errors]);

  // A failed send says so where the visitor is looking: the box above the button.
  useEffect(() => {
    if (serverError) alertRef.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "instant" : "smooth" });
  }, [serverError]);

  useEffect(() => () => cancelKeep.current?.(), []);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Puts the caret after the same number of digits it followed before the field regrouped them. */
  const placeCaret = (el: HTMLInputElement, digitsBefore: number) => {
    // After React has written the regrouped value back (a microtask runs after its commit).
    queueMicrotask(() => {
      if (document.activeElement !== el) return;
      let pos = 0;
      for (let seen = 0; pos < el.value.length && seen < digitsBefore; pos++) {
        if (/\d/.test(el.value[pos])) seen++;
      }
      el.setSelectionRange(pos, pos);
    });
  };

  const onPhoneChange = (el: HTMLInputElement) => {
    const { digits, caret } = phoneDigitsAt(el.value, el.selectionStart ?? el.value.length);
    set("phone", digits);
    placeCaret(el, caret);
  };

  /** Backspace just after the space (or Delete just before it) removes the digit beyond it. */
  const onPhoneKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const at = el.selectionStart ?? 0;
    if (at !== el.selectionEnd || e.nativeEvent.isComposing) return;
    const back = e.key === "Backspace" && el.value[at - 1] === " ";
    const fwd = e.key === "Delete" && el.value[at] === " ";
    if (!back && !fwd) return;
    e.preventDefault();
    const before = el.value.slice(0, at).replace(/\D/g, "").length;
    const index = back ? before - 1 : before;
    set("phone", fields.phone.slice(0, index) + fields.phone.slice(index + 1));
    placeCaret(el, index);
  };

  /** On touch screens: the phone's label, the field, what follows and the button, all above the keyboard. */
  const onPhoneFocus = () => {
    if (!coarsePointer()) return;
    const field = phoneRef.current;
    const label = document.querySelector<HTMLElement>(`label[for="${id("phone")}"]`);
    if (!field || !label || !submitRef.current) return;
    cancelKeep.current?.();
    cancelKeep.current = keepAboveKeyboard(field, label, submitRef.current);
  };

  /** Opens the note-and-language row. */
  const openNote = () => {
    if (noteRef.current) noteRef.current.open = true;
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
   * A prefill link was clicked: `data-for` picks the pill; `data-need` fills the note when it is empty
   * (or still holds an earlier prefill) and `data-need-label` shows the chip. The row stays closed: the
   * chip names the topic and the closed row says "Note added". From the success state it starts a fresh
   * request. Once the jump settles, a fine pointer gets "Your name" focused; on touch the section's
   * heading takes focus, so no keyboard rises over a form the visitor has not read yet.
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
      if (coarsePointer()) {
        if (section) focusLanding(section);
      } else {
        name.focus({ preventScroll: true });
        keepInView(name, !reduced, chipRef.current?.parentElement);
      }
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

  // The section's heading answers its own question while the success state shows, and the emergency
  // line under the card steps aside when the confirmation carries its own (closing.css).
  useEffect(() => {
    const section = document.getElementById("callback");
    if (done) section?.setAttribute("data-sent", done.promise.state);
    else section?.removeAttribute("data-sent");
  }, [done]);

  const clearTopic = () => {
    if (prefilled !== null && fields.message === prefilled) set("message", "");
    setPrefilled(null);
    setTopic(null);
    nameRef.current?.focus();
  };

  /**
   * Touch keyboards: the name's "next" moves to the phone, and the phone's "send" submits, because every
   * field after it is optional. Return in the note is a newline. Hardware keys keep their defaults.
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
    // What is in the fields is what gets sent, even where the browser filled them without telling React.
    const data = new FormData(ev.currentTarget);
    const current: Fields = {
      name: text(data.get("name")),
      phone: phoneDigits(text(data.get("phone"))),
      message: text(data.get("message")),
    };
    setFields(current);
    const found = validate(current);
    setErrors(found);
    setServerError(null);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      // The note's error shows inside its row: open the row before focus can go there.
      if (found.message) openNote();
      focusError.current = first;
      return;
    }
    // On touch, focus leaves the text field so the keyboard closes and "Sending…", the error or the
    // confirmation is in view.
    if (coarsePointer() && document.activeElement instanceof HTMLElement && document.activeElement.matches("input, textarea")) {
      submitRef.current?.focus({ preventScroll: true });
    }
    setSubmitting(true);
    try {
      const composed = composeMessage(whoFor, topic, language, current.message);
      const website = text(data.get("website"));
      await publicApi.post(
        "/leads",
        {
          name: tidyName(current.name),
          phone: current.phone,
          city: CITY,
          ...(composed ? { message: composed } : {}),
          ...(website ? { website } : {}),
        },
        { signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(SEND_TIMEOUT_MS) : undefined },
      );
      setFormHeight(formRef.current?.offsetHeight ?? null);
      writeDraft(null);
      setDone({ ...current, promise: callbackPromiseAt() });
    } catch (err) {
      setServerError(serverErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  /** Back to the form with everything kept, the phone field focused: a typo needs no retyping. */
  const changeNumber = () => {
    refocus.current = "phone";
    setDone(null);
  };

  const reset = () => {
    refocus.current = "first";
    clearForm();
  };

  const wa = whatsappHref();

  if (done) {
    const name = greetingName(done.name);
    const p = done.promise;
    const tz = awayFromIndia() ? " India time" : "";
    const when =
      p.state === "open"
        ? `We will call you by ${p.by}${tz}.`
        : p.state === "closing"
          ? `We will call you by ${p.closesAt}${tz}, or after ${p.opensAt}.`
          : `We will call you after ${p.opensAt}${tz}.`;
    const lead = p.state === "closed" ? "We are closed now. " : p.state === "closing" ? `We close at ${p.closesAt}. ` : "";
    return (
      // Top-aligned, at least as tall as the form was (up to 720px), so little below it moves.
      <div
        ref={successRef}
        className="nv-cb-success flex scroll-mt-28 flex-col items-center px-1 pt-2 pb-2 text-center sm:px-2"
        style={{ minHeight: formHeight ? Math.min(formHeight, 720) : undefined }}
      >
        <svg viewBox="0 0 64 64" aria-hidden className="size-14">
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
        {/* The heading and its sentence are the announcement; the actions below stay out of it. */}
        <div role="status" className="flex flex-col items-center">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-display mt-4 text-[1.5rem] leading-tight sm:text-[1.75rem] font-medium tracking-[-0.02em] text-balance text-foreground outline-none"
          >
            {/* One line each, so "We" never ends the first line. The space keeps the text whole for copy and AT. */}
            <span className="block">{name ? `Thanks, ${name}.` : "Thank you."}</span>{" "}
            <span className="block">{units(when)}</span>
          </h3>
          <p className="mt-3 max-w-[38ch] text-body text-balance text-foreground-2">
            {lead}
            {SITE.firstCall.whoCapital} will call you on{" "}
            <span className="font-medium whitespace-nowrap text-foreground tabular-nums">+91 {formatPhone(done.phone)}</span>.
          </p>
        </div>
        <button type="button" onClick={changeNumber} className={cn(SUCCESS_ACTION, "mt-3 text-primary decoration-primary/40")}>
          Wrong number? Change it
        </button>
        {SITE.phone && (
          <p className="mt-4 max-w-[38ch] text-small text-pretty text-ink-2">
            We will call from <span className="whitespace-nowrap tabular-nums">{SITE.phone.display}</span>. Save it so you
            know it is us.
          </p>
        )}
        {p.state !== "open" && (
          <p className="mt-4 max-w-[38ch] text-small text-pretty text-ink-2">
            <EmergencyText />
          </p>
        )}

        <div className="mt-6 w-full rounded-2xl bg-aqua p-4 text-left sm:p-5">
          <h4 className="text-small font-semibold text-ink">What happens next</h4>
          <ol className="mt-2.5 flex flex-col gap-2 text-small text-pretty text-ink-2">
            {NEXT_STEPS.map((step, i) => (
              <li key={step} className="flex gap-2.5">
                <span aria-hidden className="w-4 shrink-0 font-semibold text-primary tabular-nums">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 flex gap-2.5 border-t border-primary/10 pt-3.5 text-small text-pretty text-ink-2">
            <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Keep the prescription ready if you have one.{" "}
              <a href="#visit-prep" className={cn(SUCCESS_ACTION, "font-semibold whitespace-nowrap text-primary decoration-primary/40")}>
                See what to keep ready
              </a>
            </span>
          </p>
        </div>

        {/* Opens Take a minute on Breathe (cluster.tsx listens for data-minute-open); the orb rises
            from this pearl, and focus comes back here when it closes. */}
        <button
          type="button"
          data-minute-open="breathe"
          data-minute-scope=""
          aria-haspopup="dialog"
          className="nv-cb-minute mt-5 flex w-full max-w-[20rem] cursor-pointer items-center gap-3.5 rounded-2xl py-3 pr-5 pl-3.5 text-left text-[0.9375rem] leading-snug font-semibold text-ink focus-ring"
        >
          <Pearl size={32} data-minute-origin="" />
          <span className="text-balance">While you wait, take a minute</span>
        </button>
        <button type="button" onClick={reset} className={cn(SUCCESS_ACTION, "mt-6 mb-2 text-foreground decoration-border-strong")}>
          Send another request
        </button>
      </div>
    );
  }

  const describe = (k: string, hint?: boolean) =>
    [errors[k as keyof Fields] ? id(`${k}-error`) : null, hint ? id(`${k}-hint`) : null].filter(Boolean).join(" ") ||
    undefined;

  /** Under the row's title: "Optional" until something is added; closed, what it will send. */
  const noteMeta = noteOpen
    ? "Optional"
    : [fields.message.trim() && "Note added", language].filter(Boolean).join(" \u00b7 ") || "Optional";

  return (
    // method="post" so nothing typed ever lands in the address bar. Until the page is ready the button is
    // disabled, which also stops Enter from posting the form natively (the API takes JSON only).
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
            Who is the visit for? <span className="text-sm font-normal text-muted-foreground">Optional</span>
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
                  className="peer sr-only"
                  checked={whoFor === v}
                  onChange={() => setWhoFor(v)}
                  // The question is optional, so a tap on the chosen pill clears it.
                  onClick={() => {
                    if (whoFor === v) setWhoFor("");
                  }}
                />
                <Check aria-hidden strokeWidth={3} className="hidden size-3 shrink-0 peer-checked:block" />
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
          autoCorrect="off"
          enterKeyHint="next"
          spellCheck={false}
          aria-required
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
        hint="We use your name and number only to contact you about this request."
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
            ref={phoneRef}
            id={id("phone")}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            enterKeyHint="send"
            aria-required
            value={formatPhone(fields.phone)}
            onChange={(e) => onPhoneChange(e.target)}
            onKeyDown={(e) => {
              onPhoneKeyDown(e);
              if (!e.defaultPrevented) enterSends(e);
            }}
            onFocus={onPhoneFocus}
            aria-invalid={!!errors.phone}
            aria-describedby={describe("phone", true)}
            className={cn(FIELD, "pl-[4.5rem] tabular-nums")}
          />
        </div>
      </Field>

      {/* The area, said once; the request still carries the city (CITY). */}
      <div className="flex flex-col gap-2">
        <p className="flex items-start gap-2 text-small text-pretty text-ink-2">
          <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
          <span>
            We visit homes in {SITE.area}, {SITE.city}. A little further away? Ask us anyway.
          </span>
        </p>
        {/* The number field takes Indian mobiles only; from abroad, WhatsApp is the way in. */}
        {wa && (
          <p className="pl-6 text-small text-pretty text-ink-2">
            Outside India?{" "}
            <WhatsAppLink href={wa} className="relative rounded-sm font-semibold text-primary underline underline-offset-2 focus-ring before:absolute before:-inset-x-2 before:-inset-y-3">
              Message us on WhatsApp
            </WhatsAppLink>
          </p>
        )}
      </div>

      {/* A field only bots fill in: hidden from view and from assistive technology, and out of the tab order. */}
      <div aria-hidden className="sr-only">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {/* Both optional, so they wait behind one quiet row; while closed its meta says what it will send.
          The row opens when the visitor taps it, or for the note's error. */}
      <div className="nv-disc-group">
        <Disclosure
          id="callback-more"
          ref={noteRef}
          className="nv-disc--quiet"
          title="Add a note or preferred language"
          meta={noteMeta}
          onToggle={(e) => setNoteOpen(e.currentTarget.open)}
          bodyClassName="flex flex-col gap-6 pt-1"
        >
          <Field
            label="Preferred language for the call"
            htmlFor={id("language")}
            hint="We will try to have someone who speaks it call you."
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
            htmlFor={id("message")}
            // No-break space: "2" never sits alone on the last line.
            hint={"For example, a B12 injection for my mother in HSR Layout Sector\u00a02."}
            hintId={id("message-hint")}
            error={errors.message}
            errorId={id("message-error")}
          >
            <textarea
              id={id("message")}
              name="message"
              rows={3}
              enterKeyHint="enter"
              value={fields.message}
              onChange={(e) => set("message", e.target.value)}
              aria-invalid={!!errors.message}
              aria-describedby={describe("message", true)}
              className={cn(FIELD, "h-auto min-h-28 resize-y py-3 leading-relaxed")}
            />
          </Field>
        </Disclosure>
      </div>

      {serverError && (
        <div
          ref={alertRef}
          id={id("server")}
          role="alert"
          className="flex scroll-mt-28 scroll-mb-4 items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-small text-pretty text-danger"
        >
          <CircleAlert aria-hidden className="mt-1 size-4 shrink-0" />
          <div className="flex flex-col items-start gap-2">
            <p>
              {serverError}
              {wa && (
                <>
                  {" "}
                  Or{" "}
                  <WhatsAppLink href={wa} className="relative rounded-sm font-semibold underline underline-offset-2 focus-ring before:absolute before:-inset-x-2 before:-inset-y-3">
                    message us on WhatsApp
                  </WhatsAppLink>
                  .
                </>
              )}
              {SITE.phone && (
                <>
                  {" "}
                  Or call us on{" "}
                  <a href={`tel:${SITE.phone.tel}`} className="relative rounded-sm font-semibold whitespace-nowrap underline underline-offset-2 focus-ring before:absolute before:-inset-x-2 before:-inset-y-3">
                    {SITE.phone.display}
                  </a>
                  .
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className="relative -mx-1 cursor-pointer rounded-sm px-1 font-semibold underline underline-offset-4 focus-ring before:absolute before:-inset-x-2 before:-inset-y-3"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          ref={submitRef}
          type="submit"
          disabled={!ready}
          aria-disabled={submitting || undefined}
          className={buttonClass(
            "accent",
            // Not ready yet looks the same: it lasts a moment, and a grey flash on every visit would read as broken.
            "h-14 w-full text-[1.0625rem] duration-180 active:bg-marigold-hover active:duration-90 disabled:opacity-100 motion-safe:active:scale-[0.97] motion-reduce:active:scale-100 sm:h-13",
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
        <noscript>
          <p className="text-small text-pretty text-danger">
            This form needs JavaScript to send. Turn it on, or open this page in another browser.
          </p>
        </noscript>
        {/* Phones: the section's points are hidden, so the call-back promise sits under the button. */}
        <p className="flex items-start gap-2 text-small text-pretty text-ink-2 sm:hidden">
          <PhoneIncoming aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
          <span>
            <CallbackPromiseText />
          </span>
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
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="flex scroll-mt-28 items-baseline justify-between gap-x-1.5 text-[0.9375rem] font-medium text-balance text-foreground"
      >
        {label}
      </label>
      {hint && (
        <p id={hintId} className="-mt-0.5 text-small text-pretty text-ink-2">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-pretty text-danger">
          <CircleAlert aria-hidden className="mt-1 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
