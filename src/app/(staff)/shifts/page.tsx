"use client";

import { useMemo } from "react";
import { Badge, Card, cx, Empty, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { fmtClock, fmtDate, pkDate, pkTime } from "@/lib/time";
import { PeriodPicker, periodLabel, periodQuery, usePeriod } from "../sales/period";

type Shift = {
  id: string;
  userId: string;
  name: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
  planned: { start: string; end: string } | null;
  lateBy: number | null;
  leftEarlyBy: number | null;
  sales: number;
  cash: number;
  online: number;
};

type Missed = { userId: string; name: string; date: string; start: string; end: string };

type Person = {
  userId: string;
  name: string;
  shifts: number;
  minutes: number;
  sales: number;
  cash: number;
  online: number;
  late: number;
  missed: number;
};

type Data = {
  from: string;
  to: string;
  shifts: Shift[];
  missed: Missed[];
  people: Person[];
  onCounter: { userId: string; name: string; startedAt: string }[];
};

// Same grace as the server (LATE_GRACE): a few minutes either side is on time.
const GRACE = 5;

const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;

export default function ShiftsPage() {
  const [period, setPeriod] = usePeriod("week");
  const { data, loading, error, stale } = useApi<Data>(period ? `/api/shifts?${periodQuery(period)}` : null);

  // Shifts and no-shows together, grouped by day, newest day first.
  const days = useMemo(() => {
    const map = new Map<string, { shifts: Shift[]; missed: Missed[] }>();
    const day = (d: string) => {
      if (!map.has(d)) map.set(d, { shifts: [], missed: [] });
      return map.get(d)!;
    };
    for (const s of data?.shifts ?? []) day(s.date).shifts.push(s);
    for (const m of data?.missed ?? []) day(m.date).missed.push(m);
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [data]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Shifts"
        sub={
          <>
            A shift is the time someone actually worked the counter: from Start shift to End shift. The Schedule is the
            plan; this is what happened. Times are Pakistan time.
          </>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        {period && <span className="text-sm text-muted-foreground">{periodLabel(period)}</span>}
      </div>
      <StaleNote stale={stale} />

      <Card className="mb-5 p-4">
        <div className="mb-2 text-xs font-medium text-ink-soft">On the counter now</div>
        {!data ? (
          loading && <Spinner />
        ) : data.onCounter.length === 0 ? (
          <p className="text-sm text-ink-faint">Nobody is on shift.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.onCounter.map((o) => (
              <span key={o.userId} className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm text-primary">
                <span className="size-2 rounded-full bg-primary" />
                {o.name} · since {fmtClock(pkTime(o.startedAt))}
              </span>
            ))}
          </div>
        )}
      </Card>

      {error && !data && <Empty>{error}</Empty>}

      {data && data.people.length > 0 && <PeopleTable people={data.people} />}

      {data && days.length === 0 && <Empty>No shifts in this period.</Empty>}

      <div className="space-y-5">
        {days.map(([day, { shifts, missed }]) => (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{fmtDate(day)}</h2>
              <span className="text-xs text-ink-faint tabular-nums">
                {hm(shifts.reduce((s, x) => s + x.minutes, 0))} worked · {rs(shifts.reduce((s, x) => s + x.cash, 0))} cash
              </span>
            </div>
            <Card className="divide-y divide-line">
              {shifts.map((s) => (
                <ShiftRow key={s.id} shift={s} />
              ))}
              {missed.map((m) => (
                <div key={`${m.userId}-${m.start}`} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} muted />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-ink-faint tabular-nums">
                      Duty {fmtClock(m.start)} – {fmtClock(m.end)} · no shift started
                    </div>
                  </div>
                  <Badge tone="bad">Missed</Badge>
                </div>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <div
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
        muted ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary",
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ShiftRow({ shift: s }: { shift: Shift }) {
  const late = (s.lateBy ?? 0) > GRACE;
  const early = (s.leftEarlyBy ?? 0) > GRACE;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Avatar name={s.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{s.name}</span>
          {!s.endedAt && <Badge tone="good">On shift</Badge>}
          {late && <Badge tone="warn">Late {s.lateBy}m</Badge>}
          {early && <Badge tone="warn">Left {s.leftEarlyBy}m early</Badge>}
        </div>
        <div className="mt-0.5 text-xs text-ink-faint tabular-nums">
          {s.planned ? `Duty ${fmtClock(s.planned.start)} – ${fmtClock(s.planned.end)}` : "No duty slot"}
          {" · worked "}
          {fmtClock(pkTime(s.startedAt))} – {s.endedAt ? fmtClock(pkTime(s.endedAt)) : "now"}
          {s.endedAt && pkDate(s.endedAt) !== s.date ? ` (${fmtDate(pkDate(s.endedAt))})` : ""}
        </div>
      </div>
      <div className="flex shrink-0 gap-4 text-right text-xs tabular-nums text-ink-soft">
        <div>
          <div className="text-sm font-medium text-foreground">{hm(s.minutes)}</div>
          hours
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{s.sales}</div>
          sales
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{rs(s.cash)}</div>
          cash
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-medium text-foreground">{rs(s.online)}</div>
          online
        </div>
      </div>
    </div>
  );
}

/** Per-person totals for the period, for HR. */
function PeopleTable({ people }: { people: Person[] }) {
  return (
    <Card className="mb-5 overflow-x-auto p-4">
      <h2 className="mb-3 text-sm font-semibold">By person</h2>
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="text-left text-xs text-ink-faint">
          <tr>
            <th className="pb-2 font-medium">Person</th>
            <th className="pb-2 text-right font-medium">Shifts</th>
            <th className="pb-2 text-right font-medium">Hours</th>
            <th className="pb-2 text-right font-medium">Sales</th>
            <th className="pb-2 text-right font-medium">Cash</th>
            <th className="pb-2 text-right font-medium">Online</th>
            <th className="pb-2 text-right font-medium">Late</th>
            <th className="pb-2 text-right font-medium">Missed</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {people.map((p) => (
            <tr key={p.userId} className="border-t border-line">
              <td className="py-1.5">{p.name}</td>
              <td className="py-1.5 text-right">{p.shifts}</td>
              <td className="py-1.5 text-right">{hm(p.minutes)}</td>
              <td className="py-1.5 text-right">{p.sales}</td>
              <td className="py-1.5 text-right">{rs(p.cash)}</td>
              <td className="py-1.5 text-right">{rs(p.online)}</td>
              <td className={cx("py-1.5 text-right", p.late > 0 && "text-warn")}>{p.late}</td>
              <td className={cx("py-1.5 text-right", p.missed > 0 && "text-destructive")}>{p.missed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
