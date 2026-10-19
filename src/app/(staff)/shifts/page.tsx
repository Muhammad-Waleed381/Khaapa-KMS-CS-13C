"use client";

import { CircleCheck, Clock, TriangleAlert, UserX } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarList, Legend } from "@/components/charts";
import { EmptyState, Section } from "@/components/kit";
import { Card, cx, PageHeader, Spinner, StaleNote } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { addDays, fmtClock, fmtDate, pkDate, pkTime, weekStart } from "@/lib/time";
import { Avatar, duration, Segmented } from "../stats/bits";

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

type Preset = "today" | "yesterday" | "week" | "30d";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "30d", label: "Last 30 days" },
];

function presetRange(p: Preset, today: string) {
  if (p === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
  if (p === "week") return { from: weekStart(today), to: today };
  if (p === "30d") return { from: addDays(today, -29), to: today };
  return { from: today, to: today };
}

// Same grace as the server (LATE_GRACE): a few minutes either side is on time.
const GRACE = 5;

/** "HH:MM" -> minutes after midnight. */
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const clockOf = (iso: string) => mins(pkTime(iso));

export default function ShiftsPage() {
  const [preset, setPreset] = useState<Preset>("week");
  const [today, setToday] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(pkDate()), []);
  const range = today ? presetRange(preset, today) : null;
  const { data, loading, error, stale } = useApi<Data>(range ? `/api/shifts?from=${range.from}&to=${range.to}` : null);

  // Shifts and no-shows together, grouped by day, newest day first.
  const days = useMemo(() => {
    const map = new Map<string, { shifts: Shift[]; missed: Missed[] }>();
    const day = (d: string) => {
      if (!map.has(d)) map.set(d, { shifts: [], missed: [] });
      return map.get(d)!;
    };
    for (const s of data?.shifts ?? []) day(s.date).shifts.push(s);
    for (const m of data?.missed ?? []) day(m.date).missed.push(m);
    for (const v of map.values()) v.shifts.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [data]);



  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-10">
      <div>
        <PageHeader title="Shifts" sub="Who actually worked the counter, compared with the duty plan." />
        <StaleNote stale={stale} />
        <OnCounter data={data} loading={loading} />
      </div>

      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-8">
          <h2 className="text-xl font-semibold text-ink">History</h2>
          <Segmented label="Period" options={PRESETS} value={preset} onChange={setPreset} />
        </div>

        {error && !data && <EmptyState title="Couldn't load shifts" description={error} />}
        {data && days.length === 0 && <EmptyState title="No shifts in this period" description="Shifts start when someone presses Start shift at the Counter." />}

        {data && data.people.length > 0 && (
          <Section title="Hours worked" description="Each person's time on the counter in this period.">
            <Card className="border border-line p-5">
              <BarList
                rows={data.people.map((p) => ({
                  label: p.name,
                  value: p.minutes,
                  hint: <PersonNotes p={p} />,
                }))}
                format={duration}
              />
            </Card>
          </Section>
        )}

        {days.length > 0 && (
          <Section
            title="Day by day"
            description="The grey band is the planned duty, the green bar is when they actually worked."
            action={
              <Legend
                items={[
                  { label: "Planned", color: "var(--series-muted)" },
                  { label: "Worked", color: "var(--series-1)" },
                ]}
              />
            }
          >
            <div className="space-y-6">
              {days.map(([day, { shifts, missed }]) => (
                <div key={day} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">{fmtDate(day)}</h3>
                    <span className="text-xs text-ink-faint tabular-nums">{duration(shifts.reduce((s, x) => s + x.minutes, 0))} worked</span>
                  </div>
                  <DayCard shifts={shifts} missed={missed} />
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function OnCounter({ data, loading }: { data?: Data; loading: boolean }) {
  if (!data) return loading ? <Spinner /> : null;
  if (!data.onCounter.length)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-5 py-4 text-sm text-ink-soft">
        <Clock className="size-4 shrink-0" aria-hidden /> Nobody is on the counter right now.
      </div>
    );
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary-soft/60 p-5">
      <div className="text-sm font-medium text-ink-soft">On the counter now</div>
      <div className="mt-3 flex flex-wrap gap-4">
        {data.onCounter.map((o) => (
          <div key={o.userId} className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={o.name} className="bg-primary text-primary-foreground" />
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-[var(--series-1)]" />
            </div>
            <div>
              <div className="font-medium text-ink">{o.name}</div>
              <div className="text-xs text-ink-soft">since {fmtClock(pkTime(o.startedAt))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonNotes({ p }: { p: Person }) {
  const bits: string[] = [`${p.shifts} ${p.shifts === 1 ? "shift" : "shifts"}`, `${p.sales} sales`];
  if (p.late) bits.push(`late ${p.late}×`);
  if (p.missed) bits.push(`missed ${p.missed}×`);
  return <>{bits.join(" · ")}</>;
}

type Scale = { lo: number; hi: number };

/** One time scale per day: shop hours, stretched to fit what happened that day. */
function scaleFor(shifts: Shift[], missed: Missed[]): Scale {
  let lo = 9 * 60;
  let hi = 17 * 60;
  for (const s of shifts) {
    lo = Math.min(lo, clockOf(s.startedAt), s.planned ? mins(s.planned.start) : lo);
    if (s.endedAt && pkDate(s.endedAt) === s.date) hi = Math.max(hi, clockOf(s.endedAt));
    if (s.planned) hi = Math.max(hi, mins(s.planned.end));
  }
  for (const m of missed) {
    lo = Math.min(lo, mins(m.start));
    hi = Math.max(hi, mins(m.end));
  }
  return { lo: Math.floor(lo / 60) * 60, hi: Math.ceil(hi / 60) * 60 };
}

function DayCard({ shifts, missed }: { shifts: Shift[]; missed: Missed[] }) {
  const scale = scaleFor(shifts, missed);
  return (
    <Card className="divide-y divide-line border border-line">
      {shifts.map((s) => (
        <ShiftRow key={s.id} shift={s} scale={scale} />
      ))}
      {missed.map((m) => (
        <MissedRow key={`${m.userId}-${m.start}`} missed={m} scale={scale} />
      ))}
    </Card>
  );
}

/** A 1-line timeline: planned slot as a grey band, actual time as a green bar. */
function Timeline({ scale, planned, actual }: { scale: Scale; planned?: [number, number] | null; actual?: [number, number] | null }) {
  const span = scale.hi - scale.lo;
  const pos = (m: number) => `${(Math.min(Math.max(m, scale.lo), scale.hi) - scale.lo) / span * 100}%`;
  const width = ([a, b]: [number, number]) =>
    `${(Math.max(0, Math.min(b, scale.hi) - Math.max(a, scale.lo)) / span) * 100}%`;
  const hours: number[] = [];
  for (let h = scale.lo; h <= scale.hi; h += 60) hours.push(h);
  return (
    <div className="w-full">
      <div className="relative h-5">
        {hours.map((h) => (
          <span key={h} className="absolute inset-y-0 border-l border-line" style={{ left: pos(h) }} />
        ))}
        {planned && <span className="absolute inset-y-0 rounded-md bg-[var(--series-muted)]" style={{ left: pos(planned[0]), width: width(planned) }} />}
        {actual && (
          <span className="absolute inset-y-1.5 rounded-full bg-[var(--series-1)]" style={{ left: pos(actual[0]), width: width(actual) }} />
        )}
      </div>
      <div className="relative mt-1 h-3 text-[10px] text-ink-faint">
        {hours
          .filter((_, i) => i % 2 === 0)
          .map((h) => (
            <span
              key={h}
              className={cx(
                "absolute whitespace-nowrap",
                h === scale.lo ? "" : h === scale.hi ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: pos(h) }}
            >
              {fmtClock(`${String(h / 60).padStart(2, "0")}:00`).replace(":00", "")}
            </span>
          ))}
      </div>
    </div>
  );
}

function Status({ tone, icon, children }: { tone: "good" | "warn" | "bad" | "live"; icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        tone === "good" && "bg-muted text-ink-soft",
        tone === "live" && "bg-primary-soft text-primary",
        tone === "warn" && "bg-warn/12 text-warn",
        tone === "bad" && "bg-destructive/10 text-destructive",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function ShiftRow({ shift: s, scale }: { shift: Shift; scale: Scale }) {
  const late = (s.lateBy ?? 0) > GRACE;
  const early = (s.leftEarlyBy ?? 0) > GRACE;
  const start = clockOf(s.startedAt);
  const end = s.endedAt ? (pkDate(s.endedAt) === s.date ? clockOf(s.endedAt) : 24 * 60) : clockOf(new Date().toISOString());
  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={s.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-ink">{s.name}</span>
            {!s.endedAt && <Status tone="live" icon={<span className="size-1.5 rounded-full bg-current" />}>On shift now</Status>}
            {late && <Status tone="warn" icon={<TriangleAlert className="size-3" />}>{s.lateBy} min late</Status>}
            {early && <Status tone="warn" icon={<TriangleAlert className="size-3" />}>left {s.leftEarlyBy} min early</Status>}
            {s.planned && !late && !early && s.endedAt && <Status tone="good" icon={<CircleCheck className="size-3" />}>On time</Status>}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft tabular-nums">
            Worked {fmtClock(pkTime(s.startedAt))} – {s.endedAt ? fmtClock(pkTime(s.endedAt)) : "now"}
            {s.planned ? ` · planned ${fmtClock(s.planned.start)} – ${fmtClock(s.planned.end)}` : " · no duty planned"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-ink tabular-nums">{rs(s.cash + s.online)}</div>
          <div className="text-xs text-ink-faint tabular-nums">{s.sales} sales</div>
        </div>
      </div>
      <Timeline scale={scale} planned={s.planned ? [mins(s.planned.start), mins(s.planned.end)] : null} actual={[start, Math.max(end, start + 1)]} />
    </div>
  );
}

function MissedRow({ missed: m, scale }: { missed: Missed; scale: Scale }) {
  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={m.name} muted />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-ink">{m.name}</span>
            <Status tone="bad" icon={<UserX className="size-3" />}>Missed</Status>
          </div>
          <div className="mt-0.5 text-xs text-ink-soft tabular-nums">
            Planned {fmtClock(m.start)} – {fmtClock(m.end)} · no shift started
          </div>
        </div>
      </div>
      <Timeline scale={scale} planned={[mins(m.start), mins(m.end)]} />
    </div>
  );
}
