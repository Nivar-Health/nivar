"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  HeartPulse,
  House,
  LoaderCircle,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useScrollPadding } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { demoMode } from "@/lib/features";
import {
  EARLIEST_VISIT,
  EXPRESS_SLOT,
  checksLabel,
  formatDate,
  formatDayLong,
  formatDayParts,
  formatINR,
  initials,
  slotLabel,
  testName,
  todayISO,
} from "@/lib/format";
import { SITE } from "@/lib/site-facts";
import type { Address, Booking, Catalog, Gender, Package, Relation, ServiceCode, Slot, SlotsResponse, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addDays, isSlotPast, isValidDateStr, istParts } from "@/server/time";
import { AddressForm, fieldErrorClass, fieldLabelClass, inputClass, saveNewAddress } from "./address-form";
import { CheckoutDialog, DemoTag, chooseWithArrowKeys } from "./checkout-dialog";
import {
  EmergencyLine,
  ErrorState,
  GENDER_LABEL,
  IndiaTimeNote,
  RELATION_LABEL,
  Surface,
  ageFromDob,
  serviceIcon,
  serviceMap,
  useCatalog,
  useMyBookings,
} from "./shared";

const STEPS = [
  { title: "Choose your check-up", short: "Check-up" },
  { title: "Who is this for?", short: "Patient" },
  { title: "Visit address", short: "Address" },
  { title: "Pick a date and time", short: "Time" },
  { title: "Review and pay", short: "Pay" },
] as const;
const LAST = STEPS.length - 1;

/** Ids of the two forms the bottom bar's button can submit. */
const PATIENT_FORM = "wizard-patient";
const ADDRESS_FORM = "new-address";

type PatientMode = "self" | "family";

interface FamilyDraft {
  name: string;
  age: string;
  gender: Gender | "";
  relation: Exclude<Relation, "self"> | "";
}

interface Problem {
  /** Id of the control (or group of controls) that needs attention. */
  field: string;
  message: string;
}

function validAge(v: string): boolean {
  const n = Number(v);
  return v.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 120;
}

/** "Blood pressure, heart tracing (ECG), heart rate": the checks of a selection, in plain words. */
function checksInWords(codes: readonly ServiceCode[]): string {
  return codes
    .filter((c) => c !== "CONSULT")
    .map((c, i) => {
      const name = testName(c);
      return i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// The draft: everything a person has entered, kept for this tab
// ---------------------------------------------------------------------------

const DRAFT_KEY = "nivar:book-draft:v1";
/** A draft older than this starts again: the times it holds have probably gone. */
const DRAFT_MAX_AGE_MS = 2 * 60 * 60_000;

/** `null` for the account holder's own details means "not typed yet: use what we know". */
interface DraftFields {
  pkgRef: string | null;
  extraCodes: string[];
  mode: PatientMode;
  selfName: string | null;
  selfAge: string | null;
  selfGender: Gender | null;
  family: FamilyDraft;
  notes: string;
  addressId: string | null;
  date: string;
  slot: string | null;
}

interface StoredDraft extends DraftFields {
  uid: string;
  at: number;
  /** The check-up the wizard was opened for, so a link to a different one starts that one. */
  origin: string;
  /** Set when the details were copied from an earlier visit ("Book again"). */
  source?: "again";
  /** The unpaid booking already placed for exactly these details, so a reload never places a second. */
  placed: { id: string; signature: string } | null;
}

function readStored(uid: string): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (!d || d.uid !== uid || typeof d.at !== "number" || Date.now() - d.at > DRAFT_MAX_AGE_MS) {
      window.sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return d as StoredDraft;
  } catch {
    return null;
  }
}

function writeStored(draft: StoredDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked or full: the wizard still works, it just cannot survive a reload.
  }
}

function clearStored() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The same-day visit is offered from opening time until an hour before closing, India time. */
function earliestOpenAt(minutes: number): boolean {
  return minutes >= SITE.hours.opensAt && minutes < SITE.hours.closesAt - 60;
}

function blankFields(user: User): DraftFields {
  const now = istParts();
  // Late in the evening nothing is left today, so the calendar opens on tomorrow. A demonstration
  // stays on today, where its same-day visit is.
  const tooLate = !demoMode && now.minutes >= SITE.hours.closesAt - 60;
  return {
    pkgRef: null,
    extraCodes: [],
    mode: "self",
    selfName: null,
    selfAge: null,
    selfGender: null,
    family: { name: "", age: "", gender: "", relation: "" },
    notes: "",
    addressId: user.addresses?.[0]?.id ?? null,
    date: tooLate ? addDays(now.date, 1) : now.date,
    slot: null,
  };
}

/** Fills the wizard from a finished visit: same check-up, person and address, a new date to choose. */
export function saveDraftFromVisit(booking: Booking, user: User) {
  const p = booking.patient;
  const self = p.relation === "self";
  const blank = blankFields(user);
  writeStored({
    ...blank,
    pkgRef: booking.packageId ?? null,
    // Every test of the visit: the wizard drops the ones the package already covers.
    extraCodes: [...booking.serviceCodes],
    mode: self ? "self" : "family",
    selfName: self ? p.name : null,
    selfAge: self ? String(p.age) : null,
    selfGender: self ? p.gender : null,
    family: self ? blank.family : { name: p.name, age: String(p.age), gender: p.gender, relation: p.relation as FamilyDraft["relation"] },
    addressId: (user.addresses ?? []).some((a) => a.id === booking.address.id) ? booking.address.id : blank.addressId,
    uid: user.id,
    at: Date.now(),
    origin: "|",
    source: "again",
    placed: null,
  });
}

interface Opening {
  fields: DraftFields;
  origin: string;
  restored: "earlier" | "again" | null;
  placed: StoredDraft["placed"];
  /** The untouched wizard for this opening, as JSON: a draft equal to it is not worth keeping. */
  pristine: string;
}

/** What the wizard opens with: a link's check-up, and whatever this tab kept from earlier. */
function openWizard(user: User, preselect: { pkg: string | null; codes: string[] } | null): Opening {
  const blank = blankFields(user);
  const first: DraftFields = { ...blank, pkgRef: preselect?.pkg ?? null, extraCodes: preselect?.codes ?? [] };
  const origin = `${first.pkgRef ?? ""}|${first.extraCodes.join(",")}`;
  const pristine = JSON.stringify(first);
  const stored = preselect ? readStored(user.id) : null;
  if (!stored) return { fields: first, origin, restored: null, placed: null, pristine };

  const today = todayISO();
  let date = isValidDateStr(stored.date) && stored.date >= today ? stored.date : blank.date;
  let slot = typeof stored.slot === "string" && date === stored.date ? stored.slot : null;
  // A kept time that has since passed is dropped; the rest of the draft stands.
  if (slot && isSlotPast(date, slot)) slot = null;
  if (slot === EXPRESS_SLOT && !demoMode && !earliestOpenAt(istParts().minutes)) slot = null;
  if (!slot && date < blank.date) date = blank.date;

  const fields: DraftFields = {
    pkgRef: typeof stored.pkgRef === "string" ? stored.pkgRef : null,
    extraCodes: Array.isArray(stored.extraCodes) ? stored.extraCodes.filter((c) => typeof c === "string") : [],
    mode: stored.mode === "family" ? "family" : "self",
    selfName: typeof stored.selfName === "string" ? stored.selfName : null,
    selfAge: typeof stored.selfAge === "string" ? stored.selfAge : null,
    selfGender: stored.selfGender ?? null,
    family: { ...blank.family, ...(stored.family ?? {}) },
    notes: typeof stored.notes === "string" ? stored.notes : "",
    addressId: (user.addresses ?? []).some((a) => a.id === stored.addressId) ? stored.addressId : blank.addressId,
    date,
    slot,
  };
  // Opened from a link to another check-up: that is the one wanted now. The person, the address
  // and the notes typed earlier are still theirs.
  if (origin !== "|" && stored.origin !== origin) {
    fields.pkgRef = first.pkgRef;
    fields.extraCodes = first.extraCodes;
  }
  return { fields, origin, restored: stored.source === "again" ? "again" : "earlier", placed: stored.placed ?? null, pristine };
}

// ---------------------------------------------------------------------------
// Small pieces of browser state
// ---------------------------------------------------------------------------

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The address of a step: /app/book?step=3, keeping whatever else the URL carries. */
function stepUrl(to: number, edit = false): string {
  const p = new URLSearchParams(window.location.search);
  if (to === 0) p.delete("step");
  else p.set("step", String(to + 1));
  if (edit) p.set("edit", "1");
  else p.delete("edit");
  const q = p.toString();
  return q ? `?${q}` : window.location.pathname;
}

/** The step this history entry was reached from, when the wizard itself added the entry. */
function cameFrom(): number | undefined {
  return (window.history.state as { nvFrom?: number } | null)?.nvFrom;
}

/** Brings a field with a problem into view and puts the cursor in it. */
function focusField(id: string) {
  const el = document.getElementById(id);
  const target = el?.matches("input, textarea, select, button")
    ? el
    : el?.querySelector<HTMLElement>("button:not(:disabled), input, select, textarea");
  if (!target) return;
  target.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  target.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------

export function BookWizard({
  initialPackage = null,
  initialTest = null,
}: {
  initialPackage?: string | null;
  initialTest?: string | null;
}) {
  const { user } = useAuth();
  // "Start again" opens a fresh run with nothing chosen and nothing kept.
  const [run, setRun] = useState(0);
  if (!user) return null;
  return (
    <Wizard
      key={run}
      user={user}
      preselect={run === 0 ? { pkg: initialPackage, test: initialTest } : null}
      onStartAgain={() => setRun((r) => r + 1)}
    />
  );
}

function Wizard({
  user,
  preselect,
  onStartAgain,
}: {
  user: User;
  preselect: { pkg: string | null; test: string | null } | null;
  onStartAgain: () => void;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const { setUser } = useAuth();
  const { catalog, error: catalogError, reload: reloadCatalog } = useCatalog();
  const { bookings } = useMyBookings();

  const [opening] = useState(() => {
    if (!preselect) return openWizard(user, null);
    // A "Book again" link may also name single tests: /app/book?services=BP,SUGAR
    const listed = new URLSearchParams(window.location.search).get("services") ?? "";
    const codes = [preselect.test ?? "", ...listed.split(",")].map((c) => c.trim().toUpperCase()).filter(Boolean);
    return openWizard(user, { pkg: preselect.pkg, codes: [...new Set(codes)] });
  });

  const [pkgRef, setPkgRef] = useState(opening.fields.pkgRef);
  const [extraCodes, setExtraCodes] = useState(opening.fields.extraCodes);
  const [mode, setMode] = useState<PatientMode>(opening.fields.mode);
  const [selfNameTyped, setSelfName] = useState(opening.fields.selfName);
  const [selfAgeTyped, setSelfAge] = useState(opening.fields.selfAge);
  const [selfGenderChosen, setSelfGender] = useState(opening.fields.selfGender);
  const [family, setFamily] = useState<FamilyDraft>(opening.fields.family);
  const [notes, setNotes] = useState(opening.fields.notes);
  const [addressId, setAddressId] = useState(opening.fields.addressId);
  const [addingAddress, setAddingAddress] = useState(() => (user.addresses?.length ?? 0) === 0);
  const [savingAddress, setSavingAddress] = useState(false);
  const [date, setDate] = useState(opening.fields.date);
  const [slot, setSlot] = useState(opening.fields.slot);

  const [restored] = useState(opening.restored);
  /** The step whose problems are on show (set by a Continue that could not go on). */
  const [problemsFor, setProblemsFor] = useState<number | null>(null);
  const [slotTaken, setSlotTaken] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  /** An unpaid booking placed before a reload; checked with the server before it is used again. */
  const [unverified, setUnverified] = useState(opening.placed);
  const [created, setCreated] = useState<{ booking: Booking; signature: string } | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const finished = useRef(false);

  const padBelowBar = useScrollPadding("bottom");
  // With large text the bar would cover more than a quarter of the screen: it then sits at the end
  // of the step instead, so the step itself stays readable.
  const [barInFlow, setBarInFlow] = useState(false);
  const barRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const check = () => setBarInFlow(el.getBoundingClientRect().height > window.innerHeight / 4);
      check();
      const observer = new ResizeObserver(check);
      observer.observe(el);
      window.addEventListener("resize", check);
      const unpad = padBelowBar(el);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", check);
        unpad?.();
      };
    },
    [padBelowBar],
  );

  // ---- people booked for before: the account holder's own details, and family members ----
  const history = useMemo(() => [...(bookings ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [bookings]);
  const lastSelf = history.find((b) => b.patient.relation === "self")?.patient;
  const people = useMemo(() => {
    const seen = new Map<string, FamilyDraft>();
    for (const b of history) {
      const p = b.patient;
      if (p.relation === "self" || !p.name?.trim()) continue;
      const key = `${p.name.trim().toLowerCase()}|${p.relation}`;
      if (!seen.has(key)) seen.set(key, { name: p.name.trim(), age: String(p.age), gender: p.gender, relation: p.relation });
    }
    return [...seen.values()].slice(0, 4);
  }, [history]);

  // What we know about the account holder stands in until they type something else.
  const selfName = selfNameTyped ?? user.name ?? "";
  const selfAge = selfAgeTyped ?? String(ageFromDob(user.dob) ?? lastSelf?.age ?? "");
  const selfGender: Gender | "" = selfGenderChosen ?? user.gender ?? lastSelf?.gender ?? "";

  // ---- derived: tests and price (mirrors the API's pricing) ----
  const services = useMemo(() => serviceMap(catalog), [catalog]);
  const pkg: Package | null = useMemo(
    () => catalog?.packages.find((p) => p.id === pkgRef || p.slug === pkgRef) ?? null,
    [catalog, pkgRef],
  );
  const included: ServiceCode[] = pkg?.serviceCodes ?? [];
  const extras = extraCodes.filter((c) => c in services && !included.includes(c as ServiceCode)) as ServiceCode[];
  const codes: ServiceCode[] = [...included, ...extras];
  const total = (pkg?.price ?? 0) + extras.reduce((sum, c) => sum + (services[c]?.price ?? 0), 0);
  const selectionTitle = pkg
    ? `${pkg.name}${extras.length ? ` + ${extras.length} add-on${extras.length === 1 ? "" : "s"}` : ""}`
    : checksLabel(codes);

  const addresses = user.addresses ?? [];
  const address = addresses.find((a) => a.id === addressId) ?? null;

  const patient =
    mode === "self"
      ? { name: selfName.trim(), age: selfAge, gender: selfGender, relation: "self" as Relation }
      : { name: family.name.trim(), age: family.age, gender: family.gender, relation: family.relation as Relation };

  // ---- what each step still needs, in the words of its labels ----
  const patientProblems: Problem[] = [];
  if (mode === "self") {
    if (!selfName.trim()) patientProblems.push({ field: "p-name", message: "Add your full name." });
    if (!validAge(selfAge)) patientProblems.push({ field: "p-age", message: "Enter your age in years." });
    if (!selfGender) patientProblems.push({ field: "p-gender", message: "Choose a gender." });
  } else {
    if (!family.relation) patientProblems.push({ field: "f-relation", message: "Choose how they are related to you." });
    if (!family.name.trim()) patientProblems.push({ field: "f-name", message: "Add their full name." });
    if (!validAge(family.age)) patientProblems.push({ field: "f-age", message: "Enter their age in years." });
    if (!family.gender) patientProblems.push({ field: "f-gender", message: "Choose a gender." });
  }
  // While the catalogue loads, a chosen check-up counts: its price is not known yet, its choice is.
  const hasSelection = catalog ? codes.length > 0 : Boolean(pkgRef) || extraCodes.length > 0;
  const problems: Problem[][] = [
    hasSelection ? [] : [{ field: "checkups", message: "Choose a check-up or at least one test to continue." }],
    patientProblems,
    address || addingAddress ? [] : [{ field: "address-choices", message: "Choose where the nurse should visit." }],
    slot ? [] : [{ field: "slot-choices", message: slotTaken ? "That time was just taken. Choose another time." : "Choose a time for your visit." }],
    [],
  ];
  const stepValid = [hasSelection, patientProblems.length === 0, Boolean(address) && !addingAddress, Boolean(slot), true];

  // ---- the step lives in the URL, so Back, Forward and a reload all land where they should ----
  const asked = Number(search.get("step"));
  const requested = Number.isInteger(asked) && asked >= 1 && asked <= STEPS.length ? asked - 1 : 0;
  const firstOpen = stepValid.findIndex((v) => !v);
  const step = Math.min(requested, firstOpen === -1 ? LAST : firstOpen);
  // A step opened from Review to change one thing goes straight back there.
  const editing = search.get("edit") === "1" && step < LAST;
  const isLast = step === LAST;
  const showProblems = problemsFor === step;
  const problem = showProblems || (step === 3 && slotTaken) ? (problems[step][0] ?? null) : null;

  const pushStep = (to: number, edit = false) => window.history.pushState({ nvFrom: step }, "", stepUrl(to, edit));

  // The address bar must not claim a step the wizard cannot show yet (a deep link, a time that was taken).
  useEffect(() => {
    if (requested === step) return;
    if (cameFrom() === step) window.history.back();
    else window.history.replaceState(null, "", stepUrl(step));
  }, [requested, step]);

  // A new step starts at the top with its title in focus, so it is announced and seen.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [step]);

  // ---- keep the draft for this tab ----
  const fields: DraftFields = {
    pkgRef,
    extraCodes,
    mode,
    selfName: selfNameTyped,
    selfAge: selfAgeTyped,
    selfGender: selfGenderChosen,
    family,
    notes,
    addressId,
    date,
    slot,
  };
  const fieldsJson = JSON.stringify(fields);
  const placedId = created?.booking.id ?? unverified?.id ?? null;
  const placedSignature = created?.signature ?? unverified?.signature ?? null;
  useEffect(() => {
    if (finished.current) return;
    if (fieldsJson === opening.pristine && !placedId) {
      clearStored();
      return;
    }
    writeStored({
      ...(JSON.parse(fieldsJson) as DraftFields),
      uid: user.id,
      at: Date.now(),
      origin: opening.origin,
      source: restored === "again" ? "again" : undefined,
      placed: placedId && placedSignature ? { id: placedId, signature: placedSignature } : null,
    });
  }, [fieldsJson, placedId, placedSignature, restored, opening, user.id]);

  const startAgain = () => {
    clearStored();
    window.history.replaceState(null, "", window.location.pathname);
    onStartAgain();
  };

  // ---- moving between steps ----
  const leave = () => {
    if (window.history.length > 1) router.back();
    else router.push("/app");
  };

  const goBack = () => {
    if (step === 0) leave();
    else if (typeof cameFrom() === "number") window.history.back();
    else window.history.replaceState(null, "", stepUrl(step - 1));
  };

  /** Leaves a finished step: back to Review when it was opened from there, otherwise onward. */
  const advance = () => {
    setProblemsFor(null);
    if (editing && stepValid.every((ok, i) => ok || i === step)) {
      if (cameFrom() === LAST) window.history.back();
      else window.history.replaceState(null, "", stepUrl(LAST));
    } else {
      pushStep(step + 1);
    }
  };

  const goNext = () => {
    if (!stepValid[step]) {
      setProblemsFor(step);
      const first = problems[step][0];
      if (first) focusField(first.field);
      return;
    }
    if (isLast) void placeAndPay();
    else advance();
  };

  const edit = (to: number) => pushStep(to, true);

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
    setPlacing(true);
    setPlaceError(null);
    try {
      let current = created;
      if (!current && unverified) {
        // Placed before a reload: use it again only if it is still waiting for payment.
        const earlier = await api.get<{ booking: Booking }>(`/bookings/${unverified.id}`).catch((err) => {
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
          throw err;
        });
        current = earlier ? { booking: earlier.booking, signature: unverified.signature } : null;
        setCreated(current);
        setUnverified(null);
      }
      if (current && current.signature === signature && current.booking.status === "pending_payment") {
        setCheckoutOpen(true);
        return;
      }
      if (current && current.signature === signature && current.booking.status !== "cancelled") {
        // Paid meanwhile from My bookings: this draft is done, so never place the same visit twice.
        finished.current = true;
        clearStored();
        toast("This visit is already booked", { description: `${current.booking.code} is confirmed.` });
        router.replace(`/app/bookings/${current.booking.id}`);
        return;
      }
      const stale = current?.booking;
      const { booking } = await api.post<{ booking: Booking }>("/bookings", body);
      setCreated({ booking, signature });
      setCheckoutOpen(true);
      // A previous unpaid draft with different details is no longer wanted.
      if (stale && stale.status === "pending_payment") {
        api.post(`/bookings/${stale.id}/cancel`, { reason: "Booking details changed before payment" }).catch(() => {});
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "slot_unavailable") {
        // The time went while this person was reviewing: back to the times, where the reason shows.
        setSlot(null);
        setSlotTaken(true);
        return;
      }
      if (err instanceof ApiError && err.code === "invalid_package") {
        // The catalogue changed under us (for example after a data reset): refresh it and re-select.
        reloadCatalog();
        setPkgRef(null);
      }
      setPlaceError(errorMessage(err));
    } finally {
      setPlacing(false);
    }
  }

  const onCheckoutChange = (open: boolean) => {
    setCheckoutOpen(open);
    if (!open && created) {
      const { id, code } = created.booking;
      toast("Not confirmed yet", {
        description: `${code} is saved. Pay from My bookings to confirm your visit.`,
        action: { label: "View booking", onClick: () => router.push(`/app/bookings/${id}`) },
        duration: 10_000,
      });
    }
  };

  const onPaid = (booking: Booking) => {
    finished.current = true;
    clearStored();
    window.scrollTo({ top: 0 });
    // Replace, so Back from the visit does not reopen a checkout that is done.
    router.replace(`/app/bookings/${booking.id}`);
  };

  // ---- render ----
  if (catalogError && !catalog) {
    return <ErrorState title="Couldn't load the check-ups" message={catalogError} onRetry={reloadCatalog} className="mt-6" />;
  }

  const savingNewAddress = step === 2 && addingAddress;
  const formId = step === 1 ? PATIENT_FORM : savingNewAddress ? ADDRESS_FORM : undefined;
  const busy = placing || savingAddress;
  const cta = savingNewAddress
    ? "Save address and continue"
    : isLast
      ? `Pay ${formatINR(total)}`
      : editing
        ? "Save and review"
        : "Continue";
  const ctaProps = formId ? ({ type: "submit", form: formId } as const) : ({ type: "button", onClick: goNext } as const);
  const ctaContent = (
    <>
      {busy && <LoaderCircle className="animate-spin" aria-hidden />}
      {cta}
      {!isLast && !busy && !savingNewAddress && <ArrowRight aria-hidden />}
    </>
  );

  return (
    <div className="lg:-mx-44">
      <WizardHeader step={step} editing={editing} onBack={goBack} titleRef={titleRef} />

      {restored && (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-small text-foreground-2">
          {restored === "again" ? "Filled in from your earlier visit." : "We kept your details from earlier."}
          <button
            type="button"
            onClick={startAgain}
            className="inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Start again
          </button>
        </p>
      )}

      <div className={cn("grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:pb-0", !barInFlow && "pb-36 md:pb-24", restored ? "mt-2" : "mt-5")}>
        <div key={step} className="min-w-0 animate-fade-up">
          {step === 0 &&
            (catalog ? (
              <TestsStep
                catalog={catalog}
                pkg={pkg}
                extras={extras}
                onTogglePackage={togglePackage}
                onToggleTest={toggleTest}
                problem={showProblems ? (problems[0][0]?.message ?? null) : null}
              />
            ) : (
              <TestsSkeleton />
            ))}

          {step === 1 && (
            <PatientStep
              onSubmit={goNext}
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
              people={people}
              notes={notes}
              setNotes={setNotes}
              problems={showProblems ? patientProblems : []}
            />
          )}

          {step === 2 && (
            <AddressStep
              addresses={addresses}
              addressId={addressId}
              adding={addingAddress}
              problem={showProblems ? (problems[2][0]?.message ?? null) : null}
              onChoose={(id) => {
                setAddressId(id);
                setAddingAddress(false);
              }}
              onAdd={() => setAddingAddress(true)}
              onCancelAdd={addresses.length ? () => setAddingAddress(false) : undefined}
              onSave={async (draft) => {
                setSavingAddress(true);
                try {
                  const next = await saveNewAddress(user, draft);
                  setUser(next);
                  const last = next.addresses?.[next.addresses.length - 1];
                  if (last) setAddressId(last.id);
                  setAddingAddress(false);
                  advance();
                } finally {
                  setSavingAddress(false);
                }
              }}
            />
          )}

          {step === 3 && (
            <ScheduleStep
              date={date}
              slot={slot}
              onDate={(d) => {
                setDate(d);
                setSlot(null);
                setSlotTaken(false);
              }}
              onSlot={(s) => {
                setSlot(s);
                setSlotTaken(false);
              }}
              problem={problem?.message ?? null}
            />
          )}

          {step === 4 && (
            <ReviewStep
              pkg={pkg}
              codes={codes}
              extras={extras}
              services={services}
              total={total}
              patient={patient}
              notes={notes}
              address={address}
              date={date}
              slot={slot}
              error={placeError}
              onEdit={edit}
            />
          )}
        </div>

        {/* Desktop summary */}
        <aside className="sticky top-24 hidden lg:block">
          <Summary pkg={pkg} extras={extras} services={services} codes={codes} total={total} date={step >= 3 || slot ? date : null} slot={slot} />
          {problem && (
            <p role="alert" className={cn("mt-3", fieldErrorClass)}>
              {problem.message}
            </p>
          )}
          <Button {...ctaProps} disabled={busy || (isLast && !catalog)} className="mt-3 h-12 w-full rounded-full text-base font-semibold">
            {ctaContent}
          </Button>
          {step > 0 && (
            <Button variant="ghost" onClick={goBack} className="mt-1.5 h-11 w-full rounded-full text-sm text-foreground-2">
              <ChevronLeft aria-hidden /> Back to {editing ? "review" : STEPS[step - 1].short.toLowerCase()}
            </Button>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-foreground-2">
            <ShieldCheck className="size-4 shrink-0" aria-hidden /> {SITE.cancellation}
          </p>
        </aside>
      </div>

      {/* Phone and tablet: the price and the one action stay in reach */}
      <div
        ref={barRef}
        className={cn(
          "inset-x-0 bottom-0 z-20 border-t border-border bg-card lg:hidden",
          barInFlow
            ? "-mx-4 mt-6 md:-mx-6"
            : "fixed pb-safe shadow-[0_-10px_30px_-18px_color-mix(in_oklab,var(--foreground)_35%,transparent)]",
        )}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-x-3 gap-y-2 px-4 py-2.5 md:flex-row md:items-center md:px-6 md:py-3">
          <div className="min-w-0 flex-1">
            {problem ? (
              <p role="alert" className={fieldErrorClass}>
                {problem.message}
              </p>
            ) : codes.length > 0 ? (
              // One line above a full-width button; two lines beside it from tablet width.
              <p className="flex items-baseline gap-1.5 text-small text-foreground-2 md:block">
                {isLast ? (
                  <span className="truncate font-semibold text-foreground">{selectionTitle}</span>
                ) : (
                  <span className="tabular shrink-0 text-base font-semibold text-foreground md:text-lg">{formatINR(total)}</span>
                )}
                <span className="md:hidden" aria-hidden>
                  ·
                </span>
                <span className={cn(isLast ? "shrink-0" : "truncate", "md:block")}>
                  {isLast ? "Next: choose how to pay" : selectionTitle}
                </span>
              </p>
            ) : (
              <p className="text-small text-foreground-2">Choose a check-up to see the price</p>
            )}
          </div>
          <Button
            {...ctaProps}
            disabled={busy || (isLast && !catalog)}
            className="h-14 w-full shrink-0 rounded-full px-6 text-base font-semibold md:h-12 md:w-auto"
          >
            {ctaContent}
          </Button>
        </div>
      </div>

      <CheckoutDialog
        booking={created?.booking ?? null}
        open={checkoutOpen}
        onOpenChange={onCheckoutChange}
        onPaid={onPaid}
        phone={user.phone}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WizardHeader({
  step,
  editing,
  onBack,
  titleRef,
}: {
  step: number;
  editing: boolean;
  onBack: () => void;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={step === 0 ? "Close booking" : editing ? "Back to review" : `Back to ${STEPS[step - 1].short}`}
          className="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className="font-display text-[1.6rem] leading-tight outline-none md:text-3xl">
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
                i < step ? "bg-primary" : i === step ? "bg-primary/50" : "bg-border",
              )}
            />
            <span
              className={cn(
                "sr-only mt-1.5 text-sm font-medium sm:not-sr-only sm:block",
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
// Step 1: check-up
// ---------------------------------------------------------------------------

function TestsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

const CHOICE_CARD =
  "rounded-2xl border bg-card text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40";
const chosen = (on: boolean) => (on ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40");
const tile = (on: boolean) => (on ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground");

function TestsStep({
  catalog,
  pkg,
  extras,
  onTogglePackage,
  onToggleTest,
  problem,
}: {
  catalog: Catalog;
  pkg: Package | null;
  extras: ServiceCode[];
  onTogglePackage: (p: Package) => void;
  onToggleTest: (c: ServiceCode) => void;
  problem: string | null;
}) {
  return (
    <div className="space-y-7">
      <section aria-label="Check-up packages">
        <p className="mb-3 text-small text-foreground-2">Each check-up is done at home by a registered Nivar nurse.</p>
        {problem && (
          <p id="checkups-error" className={cn("mb-3", fieldErrorClass)}>
            {problem}
          </p>
        )}
        <div id="checkups" className="grid gap-3 sm:grid-cols-2">
          {catalog.packages.map((p) => {
            const selected = pkg?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={selected}
                aria-describedby={problem ? "checkups-error" : undefined}
                onClick={() => onTogglePackage(p)}
                className={cn(CHOICE_CARD, "relative flex flex-col p-4", chosen(selected))}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base leading-snug font-semibold">{p.name}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{p.tagline}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </span>
                <span className="mt-3 block text-small leading-snug text-foreground-2">{checksInWords(p.serviceCodes)}</span>
                {p.serviceCodes.includes("CONSULT") && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-small leading-snug text-foreground-2">
                    <Video className="size-4 shrink-0" aria-hidden /> {testName("CONSULT")}
                  </span>
                )}
                <span className="tabular mt-auto block pt-4 text-xl leading-none font-semibold">{formatINR(p.price)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Single tests">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-sm font-medium text-muted-foreground">{pkg ? "Add more tests" : "Or choose single tests"}</span>
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
                  "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset",
                  inPkg ? "cursor-default" : "hover:bg-muted/50",
                )}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tile(checked))}>
                  <Icon className="size-[1.125rem]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-small leading-snug font-semibold">{testName(s.code)}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{s.description}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  {inPkg ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-sm font-medium text-secondary-foreground">Included</span>
                  ) : (
                    <span className="tabular text-small font-semibold">{formatINR(s.price)}</span>
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
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: patient
// ---------------------------------------------------------------------------

function ChoiceChips<T extends string>({
  id,
  value,
  options,
  onChange,
  error,
  label,
}: {
  id: string;
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  error?: string;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className={cn(fieldLabelClass, error && "text-destructive")}>
        {label}
      </span>
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        onKeyDown={chooseWithArrowKeys}
        className="flex flex-wrap gap-2"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-12 rounded-full border px-5 text-small font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className={fieldErrorClass}>
          {error}
        </p>
      )}
    </div>
  );
}

const GENDER_OPTIONS = (["male", "female", "other"] as const).map((g) => ({ value: g, label: GENDER_LABEL[g] }));
const RELATION_OPTIONS = (["parent", "spouse", "child", "other"] as const).map((r) => ({
  value: r,
  label: r === "other" ? "Other" : RELATION_LABEL[r],
}));

function PatientStep(props: {
  onSubmit: () => void;
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
  people: FamilyDraft[];
  notes: string;
  setNotes: (v: string) => void;
  problems: Problem[];
}) {
  const { mode, setMode, family, setFamily, people } = props;
  const error = (field: string) => props.problems.find((p) => p.field === field)?.message;
  const isPerson = (p: FamilyDraft) =>
    mode === "family" && family.name.trim() === p.name && family.relation === p.relation && family.age === p.age && family.gender === p.gender;

  return (
    <form
      id={PATIENT_FORM}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Who is this for" onKeyDown={chooseWithArrowKeys}>
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
              className={cn(CHOICE_CARD, "flex flex-col items-start gap-3 p-4", chosen(selected))}
            >
              <span className="flex w-full items-start justify-between">
                <span className={cn("grid size-10 place-items-center rounded-xl", tile(selected))}>
                  <o.icon className="size-[1.125rem]" aria-hidden />
                </span>
                <RadioDot checked={selected} />
              </span>
              <span className="min-w-0 max-w-full">
                <span className="block text-small font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-sm leading-snug break-words text-muted-foreground">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {people.length > 0 && (
        <div className="space-y-2">
          <p id="booked-before" className={fieldLabelClass}>
            Booked for before
          </p>
          <div role="group" aria-labelledby="booked-before" className="grid gap-2 sm:grid-cols-2">
            {people.map((p) => {
              const selected = isPerson(p);
              return (
                <button
                  key={`${p.name}|${p.relation}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setMode("family");
                    setFamily(p);
                  }}
                  className={cn(CHOICE_CARD, "flex min-h-14 items-center gap-3 px-3.5 py-2.5", chosen(selected))}
                >
                  <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold", tile(selected))}>
                    {initials(p.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold">{p.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[p.relation ? (RELATION_LABEL[p.relation] ?? p.relation) : null, p.age ? `${p.age} years` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <RadioDot checked={selected} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Surface className="space-y-4 p-4 sm:p-5">
        {mode === "self" ? (
          <>
            <TextField
              id="p-name"
              label="Your name"
              value={props.selfName}
              onChange={props.setSelfName}
              placeholder="Full name"
              autoComplete="name"
              error={error("p-name")}
            />
            <TextField
              id="p-age"
              label="Age"
              value={props.selfAge}
              onChange={(v) => props.setSelfAge(v.replace(/\D/g, "").slice(0, 3))}
              placeholder="Years"
              inputMode="numeric"
              className="tabular w-28"
              error={error("p-age")}
            />
            <ChoiceChips id="p-gender" label="Gender" value={props.selfGender} options={GENDER_OPTIONS} onChange={props.setSelfGender} error={error("p-gender")} />
          </>
        ) : (
          <>
            <ChoiceChips
              id="f-relation"
              label="How are they related to you?"
              value={family.relation}
              options={RELATION_OPTIONS}
              onChange={(relation) => setFamily({ ...family, relation })}
              error={error("f-relation")}
            />
            <TextField
              id="f-name"
              label="Their full name"
              value={family.name}
              onChange={(name) => setFamily({ ...family, name })}
              placeholder="Full name"
              // The browser would offer the booker's own name here.
              autoComplete="off"
              error={error("f-name")}
            />
            <TextField
              id="f-age"
              label="Age"
              value={family.age}
              onChange={(v) => setFamily({ ...family, age: v.replace(/\D/g, "").slice(0, 3) })}
              placeholder="Years"
              inputMode="numeric"
              className="tabular w-28"
              error={error("f-age")}
            />
            <ChoiceChips
              id="f-gender"
              label="Gender"
              value={family.gender}
              options={GENDER_OPTIONS}
              onChange={(gender) => setFamily({ ...family, gender })}
              error={error("f-gender")}
            />
          </>
        )}
      </Surface>

      <div className="space-y-2">
        <label htmlFor="p-notes" className="block text-small font-semibold">
          Symptoms or notes for the doctor <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="p-notes"
          value={props.notes}
          onChange={(e) => props.setNotes(e.target.value)}
          placeholder="E.g. feels tired by evening, on BP tablets since 2022"
          rows={3}
          maxLength={2000}
          aria-describedby="p-notes-emergency"
          className="min-h-24 rounded-xl bg-card px-3.5 py-3 text-base md:text-base"
        />
        <div id="p-notes-emergency" className="flex items-start gap-2.5">
          <Phone className="mt-1 size-4 shrink-0 text-foreground-2" aria-hidden />
          <EmergencyLine />
        </div>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  className,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  className?: string;
} & Pick<React.ComponentProps<"input">, "placeholder" | "autoComplete" | "inputMode">) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cn(fieldLabelClass, error && "text-destructive")}>
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(inputClass, className)}
        enterKeyHint="next"
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className={fieldErrorClass}>
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: address
// ---------------------------------------------------------------------------

function AddressStep({
  addresses,
  addressId,
  adding,
  problem,
  onChoose,
  onAdd,
  onCancelAdd,
  onSave,
}: {
  addresses: Address[];
  addressId: string | null;
  adding: boolean;
  problem: string | null;
  onChoose: (id: string) => void;
  onAdd: () => void;
  onCancelAdd?: () => void;
  onSave: React.ComponentProps<typeof AddressForm>["onSave"];
}) {
  return (
    <div className="space-y-3">
      {problem && (
        <p id="address-error" className={fieldErrorClass}>
          {problem}
        </p>
      )}
      <div id="address-choices" className="space-y-3">
        {addresses.length > 0 && (
          <div
            role="radiogroup"
            aria-label="Saved addresses"
            aria-describedby={problem ? "address-error" : undefined}
            onKeyDown={chooseWithArrowKeys}
            className="grid gap-2.5"
          >
            {addresses.map((a) => {
              const selected = a.id === addressId && !adding;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChoose(a.id)}
                  className={cn(CHOICE_CARD, "flex w-full items-start gap-3.5 p-4", chosen(selected))}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tile(selected))}>
                    <House className="size-[1.125rem]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-semibold">{a.label || "Home"}</span>
                    <span className="mt-0.5 block text-small leading-snug text-foreground-2">{a.line1}</span>
                    <span className="mt-0.5 block text-small text-foreground-2">{[a.area, a.city, a.pincode].filter(Boolean).join(", ")}</span>
                  </span>
                  <RadioDot checked={selected} />
                </button>
              );
            })}
          </div>
        )}

        {adding ? (
          <Surface className="p-4 sm:p-5">
            <p className="mb-4 text-base font-semibold">Add a new address</p>
            {/* The bar's button saves this form, so the screen keeps one main action. */}
            <AddressForm formId={ADDRESS_FORM} hideSubmit onCancel={onCancelAdd} onSave={onSave} />
          </Surface>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-input p-4 text-left text-small font-semibold text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <span className="grid size-10 place-items-center rounded-xl border border-border bg-card text-foreground">
              <Plus className="size-[1.125rem]" aria-hidden />
            </span>
            Add new address
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: date and time
// ---------------------------------------------------------------------------

/** The next `n` days by India's calendar, whatever the phone's own date says. */
function nextDays(n: number): { iso: string; top: string; bottom: string }[] {
  const today = todayISO();
  return Array.from({ length: n }, (_, i) => {
    const iso = addDays(today, i);
    const parts = formatDayParts(iso);
    return { iso, top: i === 0 ? "Today" : i === 1 ? "Tomorrow" : parts.weekday, bottom: parts.day };
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
  return per(h) === per(h + 1) ? `${fmt(h)} to ${fmt(h + 1)} ${per(h + 1)}` : `${fmt(h)} ${per(h)} to ${fmt(h + 1)} ${per(h + 1)}`;
}

function ScheduleStep({
  date,
  slot,
  onDate,
  onSlot,
  problem,
}: {
  date: string;
  slot: string | null;
  onDate: (d: string) => void;
  onSlot: (s: string) => void;
  problem: string | null;
}) {
  const days = useMemo(() => nextDays(7), []);
  const [state, setState] = useState<{ date: string; slots: Slot[] | null; error: string | null; minutes: number }>({
    date: "",
    slots: null,
    error: null,
    minutes: 0,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<SlotsResponse>(`/slots?date=${date}`, { signal: controller.signal, anonymous: true })
      .then((res) => setState({ date, slots: res.slots, error: null, minutes: istParts().minutes }))
      .catch((err) => {
        if (!controller.signal.aborted) setState({ date, slots: null, error: errorMessage(err), minutes: 0 });
      });
    return () => controller.abort();
  }, [date, nonce]);

  const loading = state.date !== date;
  const slots = state.date === date ? state.slots : null;
  const hourly = slots?.filter((s) => s.slot !== EXPRESS_SLOT) ?? [];
  const anyHourly = hourly.some((s) => s.available);
  // The same-day visit: offered in working hours only. A demonstration keeps it at any hour, marked.
  const inHours = earliestOpenAt(state.minutes);
  const earliest = Boolean(slots?.some((s) => s.slot === EXPRESS_SLOT && s.available)) && (inHours || demoMode);
  const nextDay = days[days.findIndex((d) => d.iso === date) + 1]?.iso;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 flex items-center gap-2 text-small font-semibold">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden /> Date
        </p>
        {/* Phones scroll the week sideways with the next day peeking in; wider screens show all seven. */}
        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
          <div role="radiogroup" aria-label="Date" onKeyDown={chooseWithArrowKeys} className="flex gap-2">
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
                    "flex h-16 w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:w-auto md:min-w-0 md:flex-1",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <span className={cn("text-sm font-medium", selected ? "text-primary-foreground/85" : "text-muted-foreground")}>{d.top}</span>
                  <span className="tabular text-small font-semibold">{d.bottom}</span>
                </button>
              );
            })}
          </div>
        </div>
        <IndiaTimeNote className="mt-2" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {date === todayISO() && <Skeleton className="h-[5.75rem] rounded-2xl" />}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
      ) : state.error ? (
        <ErrorState title="Couldn't load time slots" message={state.error} onRetry={() => setNonce((n) => n + 1)} />
      ) : (
        <div id="slot-choices" className="space-y-6">
          {problem && (
            <p id="slot-error" className={fieldErrorClass}>
              {problem}
            </p>
          )}
          {earliest && (
            <button
              type="button"
              role="radio"
              aria-checked={slot === EXPRESS_SLOT}
              aria-describedby={problem ? "slot-error" : undefined}
              onClick={() => onSlot(EXPRESS_SLOT)}
              className={cn(CHOICE_CARD, "flex w-full items-center gap-4 p-4", chosen(slot === EXPRESS_SLOT))}
            >
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", tile(slot === EXPRESS_SLOT))}>
                <Clock className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{EARLIEST_VISIT.title}</span>
                  {!inHours && <DemoTag className="text-foreground-2" />}
                </span>
                <span className="mt-0.5 block text-small leading-snug text-foreground-2">
                  {inHours ? EARLIEST_VISIT.note : `Shown outside ${SITE.hours.short} for demonstrations only.`}
                </span>
              </span>
              <RadioDot checked={slot === EXPRESS_SLOT} />
            </button>
          )}

          <div>
            <p className="mb-3 flex items-center gap-2 text-small font-semibold">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              {earliest ? "Or choose a time slot" : "Time slot"}
            </p>
            {!anyHourly && (
              <div className="rounded-xl bg-muted px-3.5 py-3">
                <p className="text-small text-foreground-2">
                  {earliest
                    ? "Today's time slots are over. You can book the earliest visit today, or choose another day."
                    : "No time slots left on this day."}
                </p>
                {nextDay && (
                  <Button variant="outline" onClick={() => onDate(nextDay)} className="mt-2.5 h-11 rounded-full px-4 text-sm font-semibold">
                    See the next day <ArrowRight aria-hidden />
                  </Button>
                )}
              </div>
            )}
            <div
              role="radiogroup"
              aria-label="Time slot"
              aria-describedby={problem ? "slot-error" : undefined}
              onKeyDown={chooseWithArrowKeys}
              className={cn("space-y-4", !anyHourly && "hidden")}
            >
              {SLOT_GROUPS.map((g) => {
                const items = hourly.filter((s) => {
                  const h = Number(s.slot.slice(0, 2));
                  return h >= g.from && h < g.to;
                });
                if (!items.length) return null;
                return (
                  <div key={g.label}>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">{g.label}</p>
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
                              "tabular h-12 rounded-xl border text-small font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : s.available
                                  ? "border-border bg-card hover:border-primary/50"
                                  : "cursor-not-allowed border-transparent bg-muted/70 text-muted-foreground line-through decoration-muted-foreground/50",
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: review
// ---------------------------------------------------------------------------

type ServiceLookup = ReturnType<typeof serviceMap>;

function ReviewStep({
  pkg,
  codes,
  extras,
  services,
  total,
  patient,
  notes,
  address,
  date,
  slot,
  error,
  onEdit,
}: {
  pkg: Package | null;
  codes: ServiceCode[];
  extras: ServiceCode[];
  services: ServiceLookup;
  total: number;
  patient: { name: string; age: string; gender: Gender | ""; relation: Relation };
  notes: string;
  address: Address | null;
  date: string;
  slot: string | null;
  error: string | null;
  onEdit: (step: number) => void;
}) {
  const earliest = slot === EXPRESS_SLOT;
  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-card px-4 py-3">
          <p className="text-small font-semibold text-destructive">Couldn&apos;t place your booking</p>
          <p className="mt-0.5 text-small text-foreground-2">{error}</p>
        </div>
      )}

      <ReviewCard title="Check-up" icon={HeartPulse} onEdit={() => onEdit(0)}>
        <p className="text-small font-semibold">
          {pkg ? pkg.name : checksLabel(codes)}
          {pkg && <span className="ml-1.5 font-normal text-foreground-2">({checksLabel(codes)})</span>}
        </p>
        <p className="mt-1 text-small leading-snug text-foreground-2">{checksInWords(codes)}</p>
        {codes.includes("CONSULT") && (
          <p className="mt-1 flex items-center gap-1.5 text-small leading-snug text-foreground-2">
            <Video className="size-4 shrink-0" aria-hidden /> {testName("CONSULT")}
          </p>
        )}
      </ReviewCard>

      <ReviewCard title="Patient" icon={UserRound} onEdit={() => onEdit(1)}>
        <p className="text-small font-semibold">{patient.name}</p>
        <p className="text-small text-foreground-2">
          {[`${patient.age} years`, patient.gender ? GENDER_LABEL[patient.gender] : null, RELATION_LABEL[patient.relation]]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {notes.trim() && (
          <p className="mt-2 rounded-lg bg-muted/70 px-3 py-2 text-small leading-snug text-foreground-2">&ldquo;{notes.trim()}&rdquo;</p>
        )}
      </ReviewCard>

      <ReviewCard title="Address" icon={MapPin} onEdit={() => onEdit(2)}>
        {address && (
          <>
            <p className="text-small font-semibold">{address.label}</p>
            <p className="text-small leading-snug text-foreground-2">
              {address.line1}, {[address.area, address.city, address.pincode].filter(Boolean).join(", ")}
            </p>
          </>
        )}
      </ReviewCard>

      <ReviewCard title="Date and time" icon={earliest ? Clock : CalendarDays} onEdit={() => onEdit(3)}>
        <p className="text-small font-semibold">{earliest ? EARLIEST_VISIT.title : formatDayLong(date)}</p>
        <p className="tabular text-small text-foreground-2">{earliest ? EARLIEST_VISIT.note : slotLabel(slot)}</p>
      </ReviewCard>

      <Surface className="p-4">
        <p className="mb-3 text-small font-semibold">Price details</p>
        <dl className="space-y-2 text-small">
          {pkg && <PriceRow label={pkg.name} value={formatINR(pkg.price)} />}
          {extras.map((c) => (
            <PriceRow key={c} label={testName(c)} value={formatINR(services[c]?.price ?? 0)} />
          ))}
          <PriceRow label="Home visit" value="Free" />
          <div className="my-2 border-t border-dashed border-border" />
          <div className="flex items-baseline justify-between">
            <dt className="font-semibold">Total payable</dt>
            <dd className="tabular text-lg font-semibold">{formatINR(total)}</dd>
          </div>
        </dl>
      </Surface>
      <p className="flex items-start gap-2 px-1 text-small text-foreground-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {SITE.cancellation}.
      </p>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-foreground-2">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

function ReviewCard({
  title,
  icon: Icon,
  onEdit,
  children,
}: {
  title: string;
  icon: typeof MapPin;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Surface className="px-4 pt-2.5 pb-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">{title}</h2>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="-mr-2 inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-foreground underline underline-offset-4 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Edit
        </button>
      </div>
      <div className="mt-1.5">{children}</div>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Desktop summary card
// ---------------------------------------------------------------------------

function Summary({
  pkg,
  extras,
  services,
  codes,
  total,
  date,
  slot,
}: {
  pkg: Package | null;
  extras: ServiceCode[];
  services: ServiceLookup;
  codes: ServiceCode[];
  total: number;
  date: string | null;
  slot: string | null;
}) {
  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-small font-semibold">Your booking</p>
        <p className="text-sm text-muted-foreground">{codes.length ? `${checksLabel(codes)}, at home` : "Nothing selected yet"}</p>
      </div>
      <div className="space-y-2.5 px-4 py-3.5 text-small">
        {!pkg && extras.length === 0 && (
          <p className="py-2 text-center text-small text-foreground-2">Choose a check-up or tests to see your total.</p>
        )}
        {pkg && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium">{pkg.name}</span>
            <span className="tabular shrink-0">{formatINR(pkg.price)}</span>
          </div>
        )}
        {extras.map((c) => (
          <div key={c} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-foreground-2">+ {testName(c)}</span>
            <span className="tabular shrink-0">{formatINR(services[c]?.price ?? 0)}</span>
          </div>
        ))}
        {date && slot && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-2 text-sm">
            {slot === EXPRESS_SLOT ? (
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="tabular">{slot === EXPRESS_SLOT ? EARLIEST_VISIT.title : `${formatDate(date)}, ${slotLabel(slot)}`}</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between border-t border-dashed border-border px-4 py-3.5">
        <span className="text-small font-semibold">Total</span>
        <span className="tabular text-xl leading-none font-semibold">{formatINR(total)}</span>
      </div>
    </Surface>
  );
}
