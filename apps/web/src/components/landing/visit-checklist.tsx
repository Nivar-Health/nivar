"use client";

import { ClipboardCheck } from "lucide-react";
import { useId, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { Disclosure } from "./disclosure";
import type { ChecklistItem } from "./health-content";
import { Pearl } from "./take-a-minute/pearl";
import { ExternalLink } from "./tip-deck";
import "./health-tips.css";

/* Ticks live for the IST calendar day: { day: "YYYY-MM-DD", done: ids }. Storage can be missing or
   blocked (private mode, an embedded view), so every access is wrapped and the page view keeps its own
   copy: the ticks still work, they just don't outlive the page. */
const KEY = "nivar.visitPrep.v1";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today in India, "YYYY-MM-DD". */
function istDay() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The stored JSON; undefined until first read, null when there is none. */
let memory: string | null | undefined;
const listeners = new Set<() => void>();

function readStored(): string | null {
  if (memory === undefined) {
    try {
      memory = window.localStorage.getItem(KEY);
    } catch {
      memory = null;
    }
  }
  return memory;
}

/** Today's ticked ids, in `ids` order, joined with spaces: a string, so the snapshot stays stable. */
function doneToday(ids: readonly string[]): string {
  const raw = readStored();
  if (!raw) return "";
  try {
    const saved = JSON.parse(raw) as { day?: unknown; done?: unknown };
    if (saved.day !== istDay() || !Array.isArray(saved.done)) return "";
    const done: unknown[] = saved.done;
    return ids.filter((id) => done.includes(id)).join(" ");
  } catch {
    return "";
  }
}

function save(done: readonly string[]) {
  memory = JSON.stringify({ day: istDay(), done });
  try {
    window.localStorage.setItem(KEY, memory);
  } catch {
    // Blocked storage: keep this page view's copy.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Another tab ticked something.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY && e.key !== null) return;
    memory = undefined;
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/** Progress in words, from the item count (never a literal): "{n} of {N} done", or "All done." */
function doneLabel(n: number, total: number) {
  return n >= total ? "All done." : `${n} of ${total} done`;
}

/** The closed row's line: what the list is for and how far along it is. */
function metaLabel(n: number, total: number) {
  if (n >= total) return "All done.";
  const lead = "For the day of your visit · ";
  return n === 0 ? `${lead}${total} ${total === 1 ? "thing" : "things"} to check` : `${lead}${doneLabel(n, total)}`;
}

/**
 * "Before your nurse arrives": one drop-down row, closed by default at every width, whose line under
 * the title counts what is ticked. Inside, real checkboxes keep their ticks through the day (IST) and
 * reset the next. Each item's words are its tick target; its source sits on its own line below, outside
 * it, and the rest item opens Take a minute on its five-minute rest. The fasting warning lives outside
 * this row (health-tips.tsx), so closing it never hides it.
 */
export function VisitChecklist({ items, className }: { items: readonly ChecklistItem[]; className?: string }) {
  const uid = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const ids = items.map((item) => item.id);
  const doneList = useSyncExternalStore(subscribe, () => doneToday(ids), () => "");
  const done = new Set(doneList ? doneList.split(" ") : []);
  const total = items.length;
  const count = done.size;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(done);
    if (on) next.add(id);
    else next.delete(id);
    save(ids.filter((x) => next.has(x)));
  };
  const clear = () => {
    save([]);
    firstRef.current?.focus();
  };

  return (
    <div className={cn("nv-disc-group", className)}>
      <Disclosure
        id="visit-prep"
        lead={<ClipboardCheck strokeWidth={2} />}
        leadSize="icon"
        title={<span id={`${uid}-title`}>Before your nurse arrives</span>}
        meta={metaLabel(count, total)}
        bodyClassName="ps-0"
      >
        {/* pt-1.5 keeps the first box's 44px target 8px clear of the row above it (spec §2.3). */}
        <ul aria-labelledby={`${uid}-title`} className="nv-habits-checks pt-1.5">
          {items.map((item, i) => {
            const inputId = `${uid}-${item.id}`;
            const on = done.has(item.id);
            return (
              <li key={item.id} className="nv-habits-check py-3">
                {/* The tick target: the box and the words (the label's overlay covers this row only). The box's
                    44px target reaches into the gutter on its left rather than towards the words, so it stays
                    clear of the source link under a one-line item. */}
                <div className="relative flex gap-2.5">
                  <span className="relative z-[1] mt-px grid size-6 shrink-0 place-items-center">
                    <input
                      ref={i === 0 ? firstRef : undefined}
                      id={inputId}
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggle(item.id, e.currentTarget.checked)}
                      className="peer absolute -top-2.5 -left-5 size-11 cursor-pointer appearance-none rounded-xl opacity-0"
                    />
                    <span
                      aria-hidden
                      className="nv-habits-box pointer-events-none grid size-6 place-items-center rounded-[7px] border-[1.5px] border-ink-3 bg-white text-white peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring forced-colors:peer-checked:border-[Highlight] forced-colors:peer-checked:bg-[Highlight] forced-colors:peer-checked:text-[HighlightText] forced-colors:peer-checked:forced-color-adjust-none"
                    >
                      <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
                        <path
                          d="M3.5 8.5 6.5 11.5 12.5 4.5"
                          pathLength={1}
                          stroke="currentColor"
                          strokeWidth={2.25}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                  <label
                    htmlFor={inputId}
                    className="nv-habits-check-label min-w-0 flex-1 cursor-pointer text-small/[1.5] text-pretty text-ink md:max-w-[31rem]"
                  >
                    {item.text}
                  </label>
                </div>
                <div className="pl-[2.125rem] md:max-w-[33.125rem]">
                  <p className="mt-1 text-caption text-ink-3">
                    {item.source.url ? (
                      <ExternalLink href={item.source.url}>{item.source.label}</ExternalLink>
                    ) : (
                      item.source.label
                    )}
                  </p>
                  {item.id === "rest" && (
                    <button
                      type="button"
                      data-minute-open="rest"
                      aria-haspopup="dialog"
                      className="nv-habits-rest mt-2.5 flex min-h-11 w-fit max-w-full items-center gap-2 rounded-full bg-white py-1.5 pr-3.5 pl-2 text-left text-[0.875rem] leading-[1.25] font-semibold text-balance text-primary shadow-xs ring-1 ring-border-strong ring-inset focus-ring transition-[background-color,scale] duration-180 hover:bg-aqua/50 active:scale-[0.97] active:bg-aqua active:duration-90 motion-reduce:active:scale-100 forced-colors:border forced-colors:border-[ButtonText] sm:gap-2.5 sm:pr-4 sm:pl-2.5 sm:text-[0.9375rem]"
                    >
                      <Pearl size={22} />
                      Use the 5-minute rest timer
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Wraps as a whole rather than spilling: "Clear ticks" drops under the bar on the narrowest screens. */}
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span aria-hidden className="flex gap-1">
              {items.map((item) => (
                <span
                  key={item.id}
                  data-on={done.has(item.id) ? "" : undefined}
                  className="nv-habits-seg h-1.5 w-4 overflow-hidden rounded-full bg-aqua-2 sm:w-5"
                >
                  <span className="block size-full rounded-full bg-primary" />
                </span>
              ))}
            </span>
            <p
              aria-live="polite"
              className={cn(
                "text-small font-semibold whitespace-nowrap tabular-nums",
                count === total ? "text-primary" : "text-ink-2",
              )}
            >
              {doneLabel(count, total)}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className={cn(
              "-mr-2 ml-auto h-11 shrink-0 rounded-full px-2.5 text-small font-semibold text-primary underline decoration-primary/30 underline-offset-[3px] focus-ring transition-[background-color,scale] duration-180 hover:decoration-primary active:scale-[0.97] active:bg-aqua active:duration-90 motion-reduce:active:scale-100",
              count === 0 && "invisible",
            )}
          >
            Clear ticks
          </button>
        </div>
      </Disclosure>
    </div>
  );
}
