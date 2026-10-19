"use client";

import { useMemo } from "react";
import { Badge, Card, Empty, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { fmtClock, fmtDate, pkDate, pkTime } from "@/lib/time";

type Shift = {
  id: string;
  userId: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
};

type Data = { shifts: Shift[]; onCounter: { userId: string; name: string; startedAt: string }[] };

const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;

export default function ShiftsPage() {
  const { data, loading, stale } = useApi<Data>("/api/shifts?limit=200");

  const days = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of data?.shifts ?? []) {
      const d = pkDate(s.startedAt);
      map.set(d, [...(map.get(d) ?? []), s]);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Shifts" sub="Who worked the counter, and for how long. Times are Pakistan time." />
      <StaleNote stale={stale} />

      <Card className="mb-6 p-4">
        <div className="mb-2 text-xs font-medium text-ink-soft">On the counter now</div>
        {!data ? (
          loading && <Spinner />
        ) : data.onCounter.length === 0 ? (
          <p className="text-sm text-ink-faint">Nobody is on shift.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.onCounter.map((o) => (
              <span
                key={o.userId}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              >
                <span className="size-2 rounded-full bg-emerald-500" />
                {o.name} · since {fmtClock(pkTime(o.startedAt))}
              </span>
            ))}
          </div>
        )}
      </Card>

      {data && days.length === 0 && <Empty>No shifts yet.</Empty>}

      <div className="space-y-5">
        {days.map(([day, shifts]) => (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{fmtDate(day)}</h2>
              <span className="text-xs text-ink-faint tabular-nums">
                {hm(shifts.reduce((s, x) => s + x.minutes, 0))} total
              </span>
            </div>
            <Card className="divide-y divide-line">
              {shifts.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                    {s.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-ink-faint tabular-nums">
                      {fmtClock(pkTime(s.startedAt))} – {s.endedAt ? fmtClock(pkTime(s.endedAt)) : "now"}
                      {s.endedAt && pkDate(s.endedAt) !== day ? ` (${fmtDate(pkDate(s.endedAt))})` : ""}
                    </div>
                  </div>
                  {s.endedAt ? (
                    <span className="text-sm tabular-nums text-ink-soft">{hm(s.minutes)}</span>
                  ) : (
                    <Badge tone="good">On shift · {hm(s.minutes)}</Badge>
                  )}
                </div>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
