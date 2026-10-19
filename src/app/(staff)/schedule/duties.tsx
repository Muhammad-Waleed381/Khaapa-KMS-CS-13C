"use client";

import { EmptyState, Section } from "@/components/kit";
import { cx, Spinner, StaleNote } from "@/components/ui";
import { addDays, fmtClock, fmtDate, pkTime, weekStart } from "@/lib/time";
import { useApi } from "@/lib/client/api";
import type { Slot } from "./types";

const hoursOf = (s: Slot) => {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
};

/** A member's own duty slots for this week and next. The API only returns their own. */
export function MyDuties({ today }: { today: string }) {
  const from = weekStart(today);
  const to = addDays(from, 13);
  const { data, stale } = useApi<{ slots: Slot[] }>(`/api/slots?from=${from}&to=${to}`);

  if (!data)
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );

  const now = pkTime();
  const isPast = (s: Slot) => s.date < today || (s.date === today && s.end <= now);
  const upcoming = data.slots.filter((s) => !isPast(s));
  const next = upcoming[0];
  const onNow = next && next.date === today && next.start <= now;
  const thisWeek = data.slots.filter((s) => s.date <= addDays(from, 6));
  const nextWeek = data.slots.filter((s) => s.date > addDays(from, 6));
  const dayName = (d: string) => (d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : fmtDate(d));

  return (
    <div className="space-y-8">
      <StaleNote stale={stale} />

      {next ? (
        <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
          <div className="text-sm font-medium opacity-80">{onNow ? "You're on duty now" : "Your next duty"}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{dayName(next.date)}</div>
          <div className="mt-1 text-xl tabular-nums opacity-95">
            {fmtClock(next.start)} – {fmtClock(next.end)}
          </div>
          {next.note && <div className="mt-2 text-sm opacity-80">{next.note}</div>}
          <div className="mt-4 text-sm opacity-80">
            {onNow
              ? "Start your shift at the Counter if you haven't. It ends by itself when your duty ends."
              : `${upcoming.length} dut${upcoming.length === 1 ? "y" : "ies"} coming up in the next two weeks.`}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No duties coming up"
          description="HR adds your duties here once the week is planned. Make sure your availability is filled in."
        />
      )}

      {[
        { title: "This week", list: thisWeek },
        { title: "Next week", list: nextWeek },
      ].map(({ title, list }) =>
        list.length === 0 ? null : (
          <Section
            key={title}
            title={title}
            description={`${list.length} dut${list.length === 1 ? "y" : "ies"} · ${list.reduce((h, s) => h + hoursOf(s), 0)} hours`}
          >
            <ul className="space-y-2">
              {list.map((s) => (
                <li
                  key={s.id}
                  className={cx(
                    "flex items-center gap-4 rounded-2xl border border-line bg-surface p-4",
                    s.date === today && !isPast(s) && "border-primary/50 bg-primary-soft/40",
                    isPast(s) && "opacity-50",
                  )}
                >
                  <div className="w-24 shrink-0">
                    <div className="text-sm font-semibold">{dayName(s.date)}</div>
                    {isPast(s) && <div className="text-xs text-ink-faint">Done</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium tabular-nums">
                      {fmtClock(s.start)} – {fmtClock(s.end)}
                    </div>
                    {s.note && <div className="truncate text-sm text-ink-soft">{s.note}</div>}
                  </div>
                  <div className="shrink-0 text-sm text-ink-faint tabular-nums">{hoursOf(s)} h</div>
                </li>
              ))}
            </ul>
          </Section>
        ),
      )}
    </div>
  );
}
