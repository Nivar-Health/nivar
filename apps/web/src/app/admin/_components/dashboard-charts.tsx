"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_META, formatINR, formatINRCompact, formatNumber } from "@/lib/format";
import type { AdminStats, BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// Nivar chart palette: one hue (teal) for magnitude, the latest period in full
// strength and earlier periods a lighter step of the same ramp.
const TEAL = "var(--chart-1)";
const TEAL_SOFT = "#B9D6CE";

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

export interface Delta {
  /** Signed percentage change, or null when the base is zero. */
  pct: number | null;
  /** Absolute change, used when pct is null. */
  abs: number;
  label: string;
  /** Whether up is good (colour follows direction x goodness). */
  upIsGood?: boolean;
  format?: (n: number) => string;
}

export function deltaOf(current: number, previous: number, label: string, fmt?: (n: number) => string): Delta {
  return {
    pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
    abs: current - previous,
    label,
    format: fmt,
  };
}

function DeltaChip({ delta }: { delta: Delta }) {
  const value = delta.pct ?? delta.abs;
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const good = delta.upIsGood ?? true;
  const tone =
    dir === "flat"
      ? "text-muted-foreground"
      : (dir === "up") === good
        ? "text-emerald-700"
        : "text-red-700";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const fmt = delta.format ?? formatNumber;
  const text =
    delta.pct !== null ? `${Math.abs(delta.pct)}%` : dir === "flat" ? "No change" : fmt(Math.abs(delta.abs));
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
      <span className={cn("inline-flex items-center font-semibold", tone)}>
        <Icon className="size-3.5" strokeWidth={2.5} />
        {text}
      </span>
      <span className="text-muted-foreground">{delta.label}</span>
    </span>
  );
}

function Sparkline({ data, id }: { data: number[]; id: string }) {
  const rows = data.map((v, i) => ({ i, v }));
  const config = { v: { label: "Value", color: TEAL } } satisfies ChartConfig;
  return (
    <ChartContainer id={id} config={config} className="-mb-1 hidden aspect-auto h-9 w-24 shrink-0 sm:flex">
      <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-v)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-v)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, "dataMax"]} />
        <Area
          dataKey="v"
          type="monotone"
          stroke="var(--color-v)"
          strokeWidth={1.75}
          fill={`url(#fill-${id})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  delta,
  sub,
  spark,
  sparkId,
  live,
  loading,
  footer,
  compact,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  delta?: Delta;
  sub?: ReactNode;
  spark?: number[];
  sparkId?: string;
  live?: boolean;
  loading?: boolean;
  footer?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-[14px] border border-border bg-card shadow-soft",
        compact ? "gap-2 px-4 py-3.5" : "gap-3 p-4",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground sm:text-[13px]">
          <span className="hidden size-6 shrink-0 place-items-center rounded-md bg-secondary text-primary sm:grid [&_svg]:size-3.5">
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </span>
        {live && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-emerald-800 uppercase sm:px-2">
            <span className="live-dot size-1.5 text-success" />
            <span className="hidden sm:inline">Live</span>
          </span>
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className={cn(compact ? "h-6 w-14" : "h-8 w-24")} />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div className="min-w-0">
          <div className={cn("flex items-end justify-between gap-3", !compact && "sm:min-h-9")}>
            <div
              className={cn(
                "min-w-0 leading-none font-semibold tracking-tight text-foreground",
                compact ? "text-[22px]" : "text-[28px]",
              )}
            >
              {value}
            </div>
            {spark && spark.length > 1 && sparkId && <Sparkline data={spark} id={sparkId} />}
          </div>
          {(delta || sub) && (
            <div className={cn("flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1", compact ? "mt-1.5" : "mt-2")}>
              {delta && <DeltaChip delta={delta} />}
              {sub && <span className="text-xs leading-snug text-muted-foreground">{sub}</span>}
            </div>
          )}
        </div>
      )}
      {footer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7-day trend charts (two small single-axis charts, never a dual axis)
// ---------------------------------------------------------------------------

function dayTick(date: string) {
  return format(parseISO(date), "EEE");
}

function TrendTooltip({
  active,
  payload,
  render,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { date: string; bookings: number; revenue: number } }>;
  render: (row: { date: string; bookings: number; revenue: number }) => ReactNode;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-popover px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-medium text-foreground">{format(parseISO(row.date), "EEE, d MMM")}</div>
      <div className="mt-0.5 text-muted-foreground">{render(row)}</div>
    </div>
  );
}

function ChartHeader({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div>
        <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xl font-semibold tracking-tight">{value}</div>
      </div>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

export function TrendCharts({ stats, loading }: { stats: AdminStats | null; loading: boolean }) {
  const data = stats?.last7Days ?? [];
  const totalBookings = data.reduce((s, d) => s + d.bookings, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const lastIdx = data.length - 1;
  const bookingsConfig = { bookings: { label: "Bookings", color: TEAL } } satisfies ChartConfig;
  const revenueConfig = { revenue: { label: "Revenue", color: TEAL } } satisfies ChartConfig;

  if (loading) {
    return (
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
    );
  }

  const axisProps = {
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
  } as const;

  return (
    <div className="grid gap-x-8 gap-y-6 p-5 md:grid-cols-2">
      <div className="min-w-0">
        <ChartHeader label="New bookings" value={formatNumber(totalBookings)} sub="by booking date" />
        <ChartContainer id="bookings-7d" config={bookingsConfig} className="aspect-auto h-60 w-full">
          <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -16 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis dataKey="date" tickFormatter={dayTick} {...axisProps} />
            <YAxis allowDecimals={false} width={48} {...axisProps} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={<TrendTooltip render={(r) => `${r.bookings} booking${r.bookings === 1 ? "" : "s"}`} />}
            />
            <Bar dataKey="bookings" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.date} fill={i === lastIdx ? TEAL : TEAL_SOFT} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
      <div className="min-w-0">
        <ChartHeader label="Revenue collected" value={formatINR(totalRevenue)} sub="by payment date" />
        <ChartContainer id="revenue-7d" config={revenueConfig} className="aspect-auto h-60 w-full">
          <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis dataKey="date" tickFormatter={dayTick} {...axisProps} />
            <YAxis tickFormatter={(v: number) => formatINRCompact(v)} width={56} {...axisProps} />
            <ChartTooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={<TrendTooltip render={(r) => formatINR(r.revenue)} />}
            />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              fill="url(#revenue-fill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-revenue)" }}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status breakdown: active pipeline as a bar list, outcomes as a summary
// ---------------------------------------------------------------------------

const PIPELINE: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "assigned",
  "en_route",
  "arrived",
  "testing",
  "consult",
  "reporting",
];

export function StatusBreakdown({
  stats,
  loading,
  onPick,
}: {
  stats: AdminStats | null;
  loading: boolean;
  onPick?: (status: BookingStatus) => void;
}) {
  if (loading || !stats) {
    return (
      <div className="flex flex-col gap-3 p-5">
        {PIPELINE.map((s) => (
          <Skeleton key={s} className="h-5" />
        ))}
      </div>
    );
  }
  const counts = stats.statusBreakdown;
  const max = Math.max(1, ...PIPELINE.map((s) => counts[s] ?? 0));
  const completed = counts.completed ?? 0;
  const cancelled = counts.cancelled ?? 0;
  const closed = completed + cancelled;
  const completionRate = closed ? Math.round((completed / closed) * 100) : 0;

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col gap-0.5 px-3 py-3">
        {PIPELINE.map((s) => {
          const n = counts[s] ?? 0;
          const meta = STATUS_META[s];
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onPick?.(s)}
                className="group grid w-full grid-cols-[minmax(0,8.5rem)_1fr_1.75rem] items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label={`${meta.staffLabel}: ${n}`}
              >
                <span className="flex min-w-0 items-center gap-2 text-[13px]">
                  <span className={cn("size-2 shrink-0 rounded-full", meta.dotClass)} />
                  <span className={cn("truncate", n === 0 && "text-muted-foreground")}>{meta.staffLabel}</span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/85 transition-[width] duration-500 group-hover:bg-primary"
                    style={{ width: n ? `${Math.max(4, (n / max) * 100)}%` : 0 }}
                  />
                </span>
                <span className={cn("text-right text-[13px] font-semibold tabular", n === 0 && "text-muted-foreground/70")}>
                  {n}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto grid grid-cols-3 divide-x divide-border/70 border-t border-border/70">
        <div className="px-4 py-3">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Completed</div>
          <div className="mt-0.5 text-lg font-semibold">{formatNumber(completed)}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Cancelled</div>
          <div className="mt-0.5 text-lg font-semibold">{formatNumber(cancelled)}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Success</div>
          <div className="mt-0.5 text-lg font-semibold">{completionRate}%</div>
        </div>
      </div>
    </div>
  );
}
