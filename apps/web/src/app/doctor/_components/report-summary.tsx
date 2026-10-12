import { CalendarCheck, CheckCircle2, Pill, Sparkles } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { populated, type Booking, type Report } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Read-only view of a published (or draft) report, letterhead style. */
export function ReportSummary({
  booking,
  report,
  className,
}: {
  booking: Booking;
  report: Report;
  className?: string;
}) {
  const doctor = populated(booking.doctor);
  return (
    <article className={cn("overflow-hidden rounded-2xl border bg-card shadow-soft", className)}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b bg-[linear-gradient(135deg,var(--mint),#ffffff_70%)] px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">Diagnosis</p>
          <h3 className="mt-1 font-display text-2xl leading-tight font-medium">
            {report.diagnosis || "Not specified"}
          </h3>
        </div>
        {report.publishedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 ring-inset">
            <CheckCircle2 className="size-3.5" /> Published {formatDateTime(report.publishedAt)}
          </span>
        )}
      </header>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {report.summary && (
            <section>
              <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Clinical summary
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-line">{report.summary}</p>
            </section>
          )}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Pill className="size-3.5" /> Prescription
            </h4>
            {report.prescription?.length ? (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-muted/60 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Medicine</th>
                      <th className="px-3 py-2 font-semibold">Dosage</th>
                      <th className="px-3 py-2 font-semibold">Frequency</th>
                      <th className="px-3 py-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.prescription.map((p, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-3 py-2">
                          <span className="font-medium">{p.medicine}</span>
                          {p.notes && <span className="block text-xs text-muted-foreground">{p.notes}</span>}
                        </td>
                        <td className="px-3 py-2">{p.dosage || "-"}</td>
                        <td className="px-3 py-2">{p.frequency || "-"}</td>
                        <td className="px-3 py-2">{p.duration || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No medicines prescribed.</p>
            )}
          </section>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Sparkles className="size-3.5" /> Advice
            </h4>
            {report.advice?.length ? (
              <ul className="flex flex-col gap-1.5">
                {report.advice.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific advice.</p>
            )}
          </section>
          {report.followUp && (
            <section className="flex items-start gap-2.5 rounded-xl bg-secondary px-3.5 py-3">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <h4 className="text-xs font-semibold text-secondary-foreground">Follow-up</h4>
                <p className="text-sm">{report.followUp}</p>
              </div>
            </section>
          )}
          {doctor && (
            <section className="mt-auto border-t pt-4">
              <p className="font-display text-lg leading-tight italic">{doctor.name}</p>
              <p className="text-xs text-muted-foreground">
                {[doctor.qualifications, doctor.registrationNo ? `Reg. ${doctor.registrationNo}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
