"use client";

import Link from "next/link";
import { BadgeCheck, ChevronLeft, FilePenLine, Globe, MapPin, Phone, Printer } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { EcgStrip } from "@/components/live/ecg-strip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EARLIEST_VISIT, EXPRESS_SLOT, formatDateLong, formatDateTimeLong, formatTime, frequencyInWords, slotLabel, testName } from "@/lib/format";
import { SITE } from "@/lib/site-facts";
import { useBooking } from "@/lib/socket";
import { populated, type Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorState, GENDER_LABEL, RELATION_LABEL, bookingTitle, useCatalog } from "./shared";
import { buildVitalCards } from "./vitals-section";

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm 12mm 14mm; }
  html, body { background: #fff !important; }
  div:has(> main) > header, div:has(> main) > nav, [data-sonner-toaster] { display: none !important; }
  main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .report-root { margin: 0 !important; }
  /* Visible overflow, so the signature and the stamp are not clipped at the page edge. */
  .report-sheet { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; overflow: visible !important; }
  .report-avoid { break-inside: avoid; }
  /* Keep each section's heading with its content (e.g. the ECG strip) instead of stranding it at a page end. */
  .report-sheet section { break-inside: avoid; }
  .report-sheet section > h2 { break-after: avoid; }
  .report-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export function MedicalReport({ id }: { id: string }) {
  const { booking, loading, error, errorStatus, reload } = useBooking(id);
  const { catalog } = useCatalog();

  if (loading) {
    return (
      <div className="space-y-4 lg:-mx-20">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-[70vh] rounded-2xl" />
      </div>
    );
  }
  if (!booking) {
    const gone = errorStatus === 404 || errorStatus === 403;
    return (
      <div className="pt-2">
        <ErrorState
          className="mt-4"
          title={errorStatus === 404 ? "Report not found" : "Couldn't load this report"}
          message={gone ? "Check the link, or open it from My bookings." : error}
          onRetry={gone ? undefined : reload}
        />
        {gone && (
          <Link href="/app/bookings" className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-12 w-full rounded-full text-small font-semibold")}>
            Go to My bookings
          </Link>
        )}
      </div>
    );
  }

  const report = booking.report;
  const published = booking.status === "completed" && report?.publishedAt;

  return (
    <div className="report-root lg:-mx-20">
      <style>{PRINT_CSS}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/app/bookings/${booking.id}`}
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pr-3 pl-2 text-small font-medium text-foreground-2 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" aria-hidden /> Back to visit
        </Link>
        {published && (
          // The browser's print dialog is also where a phone saves the report as a PDF.
          <Button onClick={() => window.print()} className="h-11 rounded-full px-5 text-small font-semibold">
            <Printer aria-hidden /> Save or print
          </Button>
        )}
      </div>

      {!published ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-border bg-card text-foreground">
            <FilePenLine className="size-5" aria-hidden />
          </span>
          <p className="font-semibold">Your report isn&apos;t ready yet</p>
          <p className="max-w-sm text-small text-foreground-2">It will appear here as soon as your doctor publishes it.</p>
          <Link href={`/app/bookings/${booking.id}`} className={cn(buttonVariants({ variant: "outline" }), "mt-1 h-11 rounded-full px-5 text-small font-semibold")}>
            Track your visit
          </Link>
        </div>
      ) : (
        <ReportSheet booking={booking} title={bookingTitle(booking, catalog)} />
      )}
    </div>
  );
}

function ReportSheet({ booking, title }: { booking: Booking; title: string }) {
  const report = booking.report!;
  const nurse = populated(booking.nurse);
  const doctor = populated(booking.doctor);
  const vitals = buildVitalCards(booking).filter((c) => c.value);
  const reportId = `${booking.code}-R`;
  const taken = [...(booking.timeline ?? [])].reverse().find((t) => t.status === "testing" || t.status === "arrived");
  const site = new URL(SITE.url).host;
  const visitTime = booking.slot === EXPRESS_SLOT ? EARLIEST_VISIT.label : slotLabel(booking.slot);

  return (
    // Phones get reading sizes (15px text); paper keeps the compact A4 sizes.
    <article className="report-sheet overflow-hidden rounded-2xl border border-border bg-white px-4 py-5 text-small text-ink shadow-soft sm:px-10 sm:py-9 sm:text-sm print:text-[0.8125rem]">
      {/* Letterhead: only facts from site-facts.ts. A phone line appears once a real number is set there. */}
      <div className="flex flex-col gap-4 border-b-2 border-primary pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12" />
          <div>
            <p className="font-display text-[1.65rem] leading-none font-semibold tracking-[-0.03em]">nivar.</p>
            <p className={cn("mt-1 font-medium text-muted-foreground", LABEL)}>Health check-ups at home</p>
          </div>
        </div>
        <div className={cn("space-y-0.5 leading-relaxed text-muted-foreground sm:text-right", SMALL)}>
          <p className="font-medium text-foreground">{SITE.legalName}</p>
          <p className="flex items-center gap-1.5 sm:justify-end">
            <Globe className="size-3.5 shrink-0" aria-hidden /> {site}
          </p>
          <p className="flex items-center gap-1.5 sm:justify-end">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {SITE.area}, {SITE.city}
          </p>
          {SITE.phone && (
            <p className="tabular flex items-center gap-1.5 sm:justify-end">
              <Phone className="size-3.5 shrink-0" aria-hidden /> {SITE.phone.display}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight sm:text-2xl">Home Health Check-up Report</h1>
          <p className={cn("text-muted-foreground", LABEL)}>{title}</p>
        </div>
        <dl className={cn("grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5", LABEL)}>
          <dt className="text-muted-foreground">Report ID</dt>
          <dd className="tabular font-mono font-semibold">{reportId}</dd>
          <dt className="text-muted-foreground">Report date</dt>
          <dd className="tabular font-medium">{formatDateTimeLong(report.publishedAt)}</dd>
        </dl>
      </div>

      {/* Patient block */}
      <section className="report-avoid mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl border border-border bg-muted/60 px-4 py-3.5 sm:grid-cols-4">
        <Info label="Patient name" value={booking.patient.name} strong />
        <Info
          label="Age / Gender"
          value={`${booking.patient.age} years / ${GENDER_LABEL[booking.patient.gender] ?? booking.patient.gender}`}
        />
        <Info label="Booking ID" value={booking.code} mono />
        <Info label="Relation" value={RELATION_LABEL[booking.patient.relation] ?? "Self"} />
        <Info label="Visit date" value={`${formatDateLong(booking.scheduledDate)}, ${visitTime}`} />
        <Info label="Readings taken" value={taken ? formatDateTimeLong(taken.at) : "Home visit"} />
        <Info label="Place" value={`Home, ${booking.address.area || booking.address.city}`} />
        <Info label="Nurse" value={nurse?.name ?? "Nivar nurse"} />
      </section>

      {/* Vitals */}
      {vitals.length > 0 && (
        <ReportSection title="Vital signs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={cn("border-y border-border bg-muted font-medium text-muted-foreground", LABEL)}>
                  <th className="py-2 pr-2 pl-3">Test</th>
                  <th className="px-2 py-2 text-right">Result</th>
                  <th className="hidden px-2 py-2 sm:table-cell">Unit</th>
                  <th className="hidden px-2 py-2 sm:table-cell">Normal range</th>
                  <th className="py-2 pr-3 pl-2 text-right">Flag</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => {
                  const abnormal = v.assessment && v.assessment.level !== "normal";
                  return (
                    <tr key={v.key} className="border-b border-border/70 align-top">
                      <td className="py-2.5 pr-2 pl-3 font-medium">
                        {v.label}
                        {v.sub && <span className={cn("block font-normal text-muted-foreground", SMALL)}>{v.sub}</span>}
                        <span className={cn("tabular block font-normal text-muted-foreground sm:hidden", SMALL)}>
                          Normal {lowerFirst(v.range)}
                        </span>
                      </td>
                      <td className={cn("tabular px-2 py-2.5 text-right font-semibold", abnormal && "text-danger")}>
                        {v.value}
                        <span className={cn("ml-1 font-normal text-muted-foreground sm:hidden", SMALL)}>{v.unit}</span>
                      </td>
                      <td className="hidden px-2 py-2.5 text-muted-foreground sm:table-cell">{v.unit}</td>
                      <td className="tabular hidden px-2 py-2.5 text-muted-foreground sm:table-cell">{v.range}</td>
                      <td className="py-2.5 pr-3 pl-2 text-right">
                        <span
                          className={cn(
                            "font-semibold",
                            SMALL,
                            !abnormal ? "text-success" : v.assessment?.label === "Elevated" ? "text-saffron" : "text-danger",
                          )}
                        >
                          {v.assessment?.label ?? "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReportSection>
      )}

      {/* ECG */}
      {booking.ecg && (
        <ReportSection title="Electrocardiogram (ECG)">
          <div className="report-avoid">
            <dl className={cn("mb-2.5 flex flex-wrap gap-x-6 gap-y-1", LABEL)}>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Heart rate</dt>
                <dd className="tabular font-semibold">{booking.ecg.heartRate ? `${Math.round(booking.ecg.heartRate)} bpm` : "-"}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Rhythm</dt>
                <dd className="font-semibold">{booking.ecg.rhythm}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Lead</dt>
                <dd className="font-semibold">II, 25 mm/s, 10 mm/mV</dd>
              </div>
            </dl>
            {booking.ecg.samples?.length ? (
              <EcgStrip
                samples={booking.ecg.samples}
                sampleRate={booking.ecg.sampleRate}
                heartRate={booking.ecg.heartRate}
                variant="paper"
                caption={booking.ecg.capturedAt ? `Captured ${formatDateTimeLong(booking.ecg.capturedAt)}` : undefined}
              />
            ) : null}
            {booking.ecg.interpretation && (
              <p className="mt-2.5 leading-relaxed">
                <span className="font-semibold">Interpretation: </span>
                {booking.ecg.interpretation}
              </p>
            )}
          </div>
        </ReportSection>
      )}

      {/* Stethoscope */}
      {booking.stethoscope && (
        <ReportSection title="Heart and lung sounds (smart stethoscope)">
          <p className="leading-relaxed">
            {booking.stethoscope.findings}
            {booking.stethoscope.heartRate ? (
              <span className="text-muted-foreground"> · Heart rate {Math.round(booking.stethoscope.heartRate)} bpm</span>
            ) : null}
            {booking.stethoscope.capturedAt ? (
              <span className="text-muted-foreground"> · Recorded {formatTime(booking.stethoscope.capturedAt)}</span>
            ) : null}
          </p>
        </ReportSection>
      )}

      {/* Doctor's assessment */}
      <ReportSection title="Doctor's assessment">
        <div className="report-avoid">
          <p className={cn("font-medium text-muted-foreground", LABEL)}>Diagnosis</p>
          <p className="mt-0.5 text-[1.0625rem] font-semibold print:text-[0.9375rem]">{report.diagnosis}</p>
          {report.summary && <p className="mt-2 leading-relaxed whitespace-pre-line">{report.summary}</p>}
        </div>
      </ReportSection>

      {/* Prescription */}
      <ReportSection
        title={
          <span className="flex items-center gap-2">
            <span className="font-display text-xl leading-none font-semibold tracking-normal text-primary normal-case italic">Rx</span> Prescription
          </span>
        }
      >
        {report.prescription?.length ? (
          <>
            <table className="hidden w-full border-collapse text-left sm:table">
              <thead>
                <tr className={cn("border-y border-border bg-muted font-medium text-muted-foreground", LABEL)}>
                  <th className="w-8 py-2 pl-3">#</th>
                  <th className="px-2 py-2">Medicine</th>
                  <th className="px-2 py-2">Dosage</th>
                  <th className="px-2 py-2">Frequency</th>
                  <th className="px-2 py-2">Duration</th>
                  <th className="py-2 pr-3 pl-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {report.prescription.map((rx, i) => (
                  <tr key={i} className="report-avoid border-b border-border/70 align-top">
                    <td className="tabular py-2.5 pl-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2.5 font-semibold">{rx.medicine}</td>
                    <td className="px-2 py-2.5">{rx.dosage || "-"}</td>
                    <td className="px-2 py-2.5">{frequencyInWords(rx.frequency) || "-"}</td>
                    <td className="px-2 py-2.5">{rx.duration || "-"}</td>
                    <td className="py-2.5 pr-3 pl-2 text-muted-foreground">{rx.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ol className="space-y-2 sm:hidden">
              {report.prescription.map((rx, i) => (
                <li key={i} className="rounded-xl border border-border px-3.5 py-3">
                  <p className="font-semibold">
                    <span className="tabular mr-1.5 text-muted-foreground">{i + 1}.</span>
                    {rx.medicine}
                    {rx.dosage ? <span className="font-normal text-muted-foreground"> · {rx.dosage}</span> : null}
                  </p>
                  <p className="mt-0.5 text-foreground-2">{[frequencyInWords(rx.frequency), rx.duration].filter(Boolean).join(" · ")}</p>
                  {rx.notes && <p className="mt-1">{rx.notes}</p>}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-muted-foreground">No medicines prescribed.</p>
        )}
      </ReportSection>

      {(report.advice?.length || report.followUp) && (
        <ReportSection title="Advice and follow-up">
          <div className="report-avoid">
            {report.advice?.length ? (
              <ul className="space-y-1.5">
                {report.advice.map((a, i) => (
                  <li key={i} className="flex gap-2.5 leading-relaxed">
                    <span className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            ) : null}
            {report.followUp && (
              <p className="mt-3 rounded-lg border border-border bg-muted px-3 py-2">
                <span className="font-semibold">Follow-up: </span>
                {report.followUp}
              </p>
            )}
          </div>
        </ReportSection>
      )}

      {/* Signature */}
      <section className="report-avoid mt-8 flex flex-col-reverse items-start justify-between gap-6 border-t border-border pt-6 sm:flex-row sm:items-end">
        <PublishedStamp date={report.publishedAt} />
        <div className="sm:text-right">
          <p className="font-display text-2xl leading-none text-primary italic">{doctor?.name ?? "Nivar doctor"}</p>
          <div className="mt-2 h-px w-56 bg-ink/60 sm:ml-auto" />
          <p className="mt-2 font-semibold">{doctor?.name}</p>
          {doctor?.qualifications && <p className={cn("text-muted-foreground", LABEL)}>{doctor.qualifications}</p>}
          {doctor?.specialization && <p className={cn("text-muted-foreground", LABEL)}>{doctor.specialization}, {SITE.legalName}</p>}
          {doctor?.registrationNo && <p className={cn("tabular text-muted-foreground", LABEL)}>Reg. No. {doctor.registrationNo}</p>}
        </div>
      </section>

      <footer className={cn("mt-8 border-t border-dashed border-border pt-3 leading-relaxed text-muted-foreground", FINE)}>
        <p>
          Tests: {booking.serviceCodes.map((c, i) => (i ? lowerFirst(testName(c)) : testName(c))).join(", ")}. Readings were
          taken at home by a Nivar nurse and reviewed by the doctor named above.
        </p>
        <p className="mt-1">
          This is an electronically generated report and does not require a physical signature. Please consult your
          doctor before making changes to any medication. In an emergency, call 112 (or 108 for an ambulance).
        </p>
      </footer>
    </article>
  );
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// Type sizes on the sheet: readable on a phone, the compact A4 sizes from 640px and on paper.
const LABEL = "text-sm print:text-[0.75rem]";
const SMALL = "text-sm print:text-[0.6875rem]";
const FINE = "text-sm print:text-[0.65625rem]";

function Info({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-medium text-muted-foreground", SMALL)}>{label}</p>
      <p className={cn("mt-0.5", strong ? "font-semibold" : "font-medium", mono && "tabular font-mono")}>{value}</p>
    </div>
  );
}

function ReportSection({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 flex items-center gap-3 font-semibold text-foreground">
        {title}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </h2>
      {children}
    </section>
  );
}

/** Marks when the doctor published the report. It is a mark, not a digital signature. */
function PublishedStamp({ date }: { date?: string }) {
  return (
    <div
      className="relative grid size-[7.5rem] shrink-0 -rotate-[8deg] place-items-center rounded-full border-[2.5px] border-primary/80 text-primary"
      role="img"
      aria-label={`Published electronically by Nivar${date ? ` on ${formatDateLong(date)}` : ""}`}
    >
      <div className="absolute inset-[5px] rounded-full border border-dashed border-primary/60" />
      <div className="relative flex flex-col items-center text-center leading-none" aria-hidden>
        <span className="text-[0.53125rem] font-bold tracking-[0.1em] uppercase">Published</span>
        <span className="mt-0.5 text-[0.53125rem] font-bold tracking-[0.1em] uppercase">electronically</span>
        <BadgeCheck className="my-1 size-6" />
        <span className="font-display text-[0.9375rem] font-semibold tracking-tight">nivar.</span>
        {date && <span className="tabular mt-1 text-[0.5rem] font-semibold">{formatDateLong(date)}</span>}
      </div>
    </div>
  );
}
