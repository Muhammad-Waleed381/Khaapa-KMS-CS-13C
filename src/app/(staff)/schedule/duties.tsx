"use client";

import { Card, cx, Empty, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { addDays, fmtClock, fmtDate, pkTime, weekStart } from "@/lib/time";
import type { Slot } from "./types";

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

  const slots = data.slots;
  const now = pkTime();
  const next = slots.find((s) => s.date > today || (s.date === today && s.end > now));
  const days = [...new Set(slots.map((s) => s.date))];

  return (
    <div className="space-y-4">
      <StaleNote stale={stale} />
      {next && (
        <Card className="border-primary bg-primary-soft/40 p-4">
          <div className="text-xs font-medium text-primary">
            {next.date === today && next.start <= now ? "On duty now" : "Your next duty"}
          </div>
          <div className="mt-1 text-lg font-semibold">
            {next.date === today ? "Today" : fmtDate(next.date)}, {fmtClock(next.start)} – {fmtClock(next.end)}
          </div>
          {next.note && <div className="text-sm text-ink-soft">{next.note}</div>}
        </Card>
      )}

      {slots.length === 0 ? (
        <Empty>No duties for you this week or next. HR will add them here once the week is planned.</Empty>
      ) : (
        <div className="space-y-2">
          {days.map((date) => (
            <Card key={date} className={cx("p-3", date === today && "border-primary")}>
              <div className={cx("mb-1.5 text-sm font-semibold", date === today && "text-primary")}>
                {fmtDate(date)}
                {date === today && " · Today"}
              </div>
              <ul className="space-y-1">
                {slots
                  .filter((s) => s.date === date)
                  .map((s) => (
                    <li
                      key={s.id}
                      className={cx("flex items-baseline gap-2 text-sm", s.date < today || (s.date === today && s.end <= now) ? "text-ink-faint" : "")}
                    >
                      <span className="font-medium tabular-nums">
                        {fmtClock(s.start)} – {fmtClock(s.end)}
                      </span>
                      {s.note && <span className="truncate text-xs text-ink-soft">{s.note}</span>}
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
