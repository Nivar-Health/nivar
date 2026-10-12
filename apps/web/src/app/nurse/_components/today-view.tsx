"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, CircleCheckBig, Coffee, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dayLabel, firstName, todayISO } from "@/lib/format";
import { useSocket, useSocketEvent } from "@/lib/socket";
import { refId, type Booking } from "@/lib/types";
import { VisitHeroCard, VisitRow } from "./visit-bits";
import { NURSE_DONE, ONGOING, compareVisits, slotStart } from "./visit-utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
      {count !== undefined && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] text-foreground tabular-nums">
          {count}
        </span>
      )}
    </h2>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-border bg-card px-3 py-3 shadow-soft">
      <span
        className={
          accent
            ? "truncate font-display text-xl leading-8 font-medium text-primary tabular-nums"
            : "truncate font-display text-2xl leading-8 font-medium tabular-nums"
        }
      >
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[74px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-3xl" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-[92px] rounded-2xl" />
        <Skeleton className="h-[92px] rounded-2xl" />
      </div>
    </div>
  );
}

export function TodayView() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const s = useSocket();

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ bookings: Booking[] }>("/bookings", { signal: controller.signal })
      .then(({ bookings }) => {
        setBookings(bookings);
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(err, "Couldn't load your visits."));
      });
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Catch up after a dropped connection.
  useEffect(() => {
    if (!s) return;
    s.io.on("reconnect", reload);
    return () => {
      s.io.off("reconnect", reload);
    };
  }, [s, reload]);

  useSocketEvent<{ booking: Booking }>("booking:updated", (payload) => {
    const next = payload?.booking;
    if (!next || !user) return;
    const mine = refId(next.nurse) === user.id;
    setBookings((prev) => {
      if (!prev) return prev;
      const rest = prev.filter((b) => b.id !== next.id);
      return mine ? [...rest, next] : rest;
    });
  });

  const today = todayISO();
  const groups = useMemo(() => {
    const list = [...(bookings ?? [])].filter((b) => b.status !== "cancelled").sort(compareVisits);
    const todays = list.filter((b) => b.scheduledDate === today);
    const done = todays.filter((b) => NURSE_DONE.includes(b.status));
    const open = todays.filter((b) => !NURSE_DONE.includes(b.status));
    const hero = open.find((b) => ONGOING.includes(b.status)) ?? open[0] ?? null;
    const rest = open.filter((b) => b !== hero);
    const upcoming = list.filter((b) => b.scheduledDate > today && !NURSE_DONE.includes(b.status));
    return { todays, done, open, hero, rest, upcoming };
  }, [bookings, today]);

  const nextVisit = groups.open.find((b) => !ONGOING.includes(b.status));
  const nextAt = nextVisit ? slotStart(nextVisit.slot) : "None";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{format(new Date(), "EEEE, d MMMM")}</p>
        <h1 className="font-display text-[2rem] leading-tight font-medium tracking-tight">Today</h1>
        {user && (
          <p className="text-sm text-muted-foreground">
            {greeting()}, <span className="font-medium text-foreground">{firstName(user.name)}</span>
            {user.baseLocation?.label ? ` · ${user.baseLocation.label}` : ""}
          </p>
        )}
      </header>

      {error && !bookings ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="lg" onClick={reload}>
            <RotateCw /> Try again
          </Button>
        </div>
      ) : !bookings ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <Kpi label="Visits today" value={String(groups.todays.length)} />
            <Kpi label="Completed" value={String(groups.done.length)} />
            <Kpi label="Next at" value={nextAt} accent />
          </div>

          {groups.hero ? (
            <VisitHeroCard key={groups.hero.id} booking={groups.hero} />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-mint text-primary">
                {groups.done.length ? <CircleCheckBig className="size-6" /> : <Coffee className="size-6" />}
              </span>
              <p className="mt-1 font-semibold">
                {groups.done.length ? "All visits done for today" : "No visits scheduled today"}
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                New visits appear here the moment they are assigned to you.
              </p>
            </div>
          )}

          {groups.rest.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle count={groups.rest.length}>
                {groups.rest.some((b) => ONGOING.includes(b.status)) ? "Also today" : "Later today"}
              </SectionTitle>
              <div className="flex flex-col gap-2.5">
                {groups.rest.map((b) => (
                  <VisitRow key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}

          {groups.upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle count={groups.upcoming.length}>Upcoming</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {groups.upcoming.map((b, i) => {
                  const prev = groups.upcoming[i - 1];
                  const newDay = !prev || prev.scheduledDate !== b.scheduledDate;
                  return (
                    <div key={b.id} className="flex flex-col gap-2">
                      {newDay && (
                        <p className="flex items-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {dayLabel(b.scheduledDate)}
                        </p>
                      )}
                      <VisitRow booking={b} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {groups.done.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle count={groups.done.length}>Completed today</SectionTitle>
              <div className="flex flex-col gap-2.5 opacity-90">
                {groups.done.map((b) => (
                  <VisitRow key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
