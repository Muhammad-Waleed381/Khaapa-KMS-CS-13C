"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Button, Card, cx, Field, Input, Modal, PageHeader, Select, Spinner, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { addDays, fmtClock, fmtDate, pkDate, pkTime, weekStart, WEEKDAYS } from "@/lib/time";
import { MyAvailability } from "./availability";
import { MyDuties } from "./duties";
import { AllAvailability } from "./overview";
import { PlanWeek } from "./plan";
import { weekDates, type Person, type Slot } from "./types";

type Tab = "duties" | "mine" | "timetable" | "everyone" | "plan";

const TABS: Record<Tab, { label: string; intro: string }> = {
  duties: {
    label: "My duties",
    intro: "When you're on counter duty this week and next. Your counter shift ends automatically at the end of each duty.",
  },
  mine: {
    label: "My availability",
    intro: "Tell HR when you're usually free each week. HR uses this to plan duties.",
  },
  timetable: {
    label: "Timetable",
    intro: "Who is on counter duty and when. Counter shifts end automatically at the end of a duty slot. Click a slot to change it.",
  },
  everyone: {
    label: "Availability",
    intro: "When each person said they're free. Ask everyone for times before planning a new week.",
  },
  plan: {
    label: "Plan week",
    intro: "Assign who works the counter when for the whole week, then Save all. People's availability is shown so you can pick someone who's free.",
  },
};

// Members only see their own duties; HR (admins) see and plan everyone's.
export default function SchedulePage() {
  const { isAdmin } = useMe();
  const tabs: Tab[] = isAdmin ? ["timetable", "everyone", "plan", "mine"] : ["duties", "mine"];
  const [picked, setTab] = useState<Tab | null>(null);
  const tab = picked && tabs.includes(picked) ? picked : tabs[0];
  const [today, setToday] = useState<string | null>(null);
  const [week, setWeek] = useState<string | null>(null);

  useEffect(() => {
    const d = pkDate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(d);
    setWeek(weekStart(d));
  }, []);

  const weekly = tab === "timetable" || tab === "plan";
  const slotsApi = useApi<{ slots: Slot[] }>(
    weekly && week ? `/api/slots?from=${week}&to=${addDays(week, 6)}` : null,
  );

  return (
    <div>
      <PageHeader title="Schedule" sub="Counter duty. Times are Pakistan time." />

      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
              tab === id ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {TABS[id].label}
          </button>
        ))}
      </div>
      <p className="mb-4 max-w-2xl text-sm text-ink-soft">{TABS[tab].intro}</p>

      {tab === "mine" ? (
        <MyAvailability />
      ) : tab === "everyone" ? (
        <AllAvailability />
      ) : !week || !today ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : tab === "duties" ? (
        <MyDuties today={today} />
      ) : (
        <>
          <WeekNav week={week} today={today} onChange={setWeek} />
          <StaleNote stale={slotsApi.stale} />
          {tab === "timetable" ? (
            <WeekView week={week} today={today} slots={slotsApi.data?.slots ?? []} reload={slotsApi.reload} />
          ) : (
            <PlanWeek week={week} slots={slotsApi.data?.slots ?? []} onSaved={slotsApi.reload} />
          )}
        </>
      )}
    </div>
  );
}

function WeekNav({ week, today, onChange }: { week: string; today: string; onChange: (w: string) => void }) {
  const thisWeek = weekStart(today);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button size="sm" aria-label="Previous week" onClick={() => onChange(addDays(week, -7))}>
        ‹
      </Button>
      <Button size="sm" disabled={week === thisWeek} onClick={() => onChange(thisWeek)}>
        This week
      </Button>
      <Button size="sm" aria-label="Next week" onClick={() => onChange(addDays(week, 7))}>
        ›
      </Button>
      <div className="ml-1 text-sm font-medium">
        {fmtDate(week)} – {fmtDate(addDays(week, 6))}
      </div>
    </div>
  );
}

function WeekView({
  week,
  today,
  slots,
  reload,
}: {
  week: string;
  today: string;
  slots: Slot[];
  reload: () => void;
}) {
  const { user, isAdmin, onCounter } = useMe();
  const [editing, setEditing] = useState<Slot | null>(null);
  const [copying, setCopying] = useState(false);
  const dates = weekDates(week, addDays);
  const mine = slots.filter((s) => s.userId === user.id);

  async function copyPrevious() {
    if (!confirm(`Copy every slot from the week of ${fmtDate(addDays(week, -7))} into this week?`)) return;
    setCopying(true);
    try {
      const { created } = await api<{ created: number }>("/api/slots/copy-week", {
        body: { fromWeek: addDays(week, -7), toWeek: week },
      });
      toast(`Copied ${created} slots`);
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs font-medium text-ink-soft">On the counter now</div>
          {onCounter.length === 0 ? (
            <div className="mt-1 text-sm text-ink-faint">Nobody has started a shift.</div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {onCounter.map((c) => (
                <span key={c.userId} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {c.name}
                  <span className="text-xs font-normal opacity-75">since {fmtClock(pkTime(c.startedAt))}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-ink-soft">My slots this week</div>
            {isAdmin && (
              <Button size="sm" variant="ghost" disabled={copying} onClick={copyPrevious}>
                <Icon name="copy" /> Copy last week
              </Button>
            )}
          </div>
          {mine.length === 0 ? (
            <div className="mt-1 text-sm text-ink-faint">No duties for you this week.</div>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm">
              {mine.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{fmtDate(s.date)}</span>{" "}
                  <span className="tabular-nums text-ink-soft">
                    {fmtClock(s.start)}–{fmtClock(s.end)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Desktop: 7-column grid. Phone: stacked days. */}
      <div className="hidden gap-2 lg:grid lg:grid-cols-7">
        {dates.map((date, i) => (
          <div
            key={date}
            className={cx(
              "min-h-40 rounded-xl border p-2",
              date === today ? "border-primary bg-primary-soft/40" : "border-line bg-surface",
            )}
          >
            <div className="mb-2 px-1">
              <div className={cx("text-xs font-semibold", date === today ? "text-primary" : "text-ink-soft")}>
                {WEEKDAYS[i]}
              </div>
              <div className="text-xs text-ink-faint">{fmtDate(date).split(", ").pop()}</div>
            </div>
            <div className="space-y-1.5">
              {slots
                .filter((s) => s.date === date)
                .map((s) => (
                  <SlotCard key={s.id} slot={s} mine={s.userId === user.id} onClick={isAdmin ? () => setEditing(s) : undefined} />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 lg:hidden">
        {dates.map((date) => {
          const list = slots.filter((s) => s.date === date);
          return (
            <Card key={date} className={cx("p-3", date === today && "border-primary")}>
              <div className={cx("mb-2 text-sm font-semibold", date === today && "text-primary")}>
                {fmtDate(date)}
                {date === today && " · Today"}
              </div>
              {list.length === 0 ? (
                <div className="text-xs text-ink-faint">Nobody scheduled</div>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {list.map((s) => (
                    <SlotCard key={s.id} slot={s} mine={s.userId === user.id} onClick={isAdmin ? () => setEditing(s) : undefined} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {editing && (
        <EditSlot
          slot={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function SlotCard({ slot, mine, onClick }: { slot: Slot; mine: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        "block w-full rounded-lg border px-2 py-1.5 text-left transition disabled:cursor-default",
        mine ? "border-primary/40 bg-primary-soft" : "border-line bg-muted/60",
        onClick && "hover:border-primary",
      )}
    >
      <div className={cx("truncate text-sm font-medium", mine && "text-primary")}>
        {slot.name}
        {mine && " (you)"}
      </div>
      <div className="text-xs tabular-nums text-ink-soft">
        {fmtClock(slot.start)} – {fmtClock(slot.end)}
      </div>
      {slot.note && <div className="truncate text-xs text-ink-faint">{slot.note}</div>}
    </button>
  );
}

function EditSlot({ slot, onClose, onSaved }: { slot: Slot; onClose: () => void; onSaved: () => void }) {
  const people = useApi<{ users: Person[] }>("/api/users?active=1");
  const [form, setForm] = useState({ ...slot, note: slot.note ?? "" });
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "bad");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit slot">
      <div className="space-y-3">
        <Field label="Person">
          <Select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
            {!people.data && <option value={slot.userId}>{slot.name}</option>}
            {people.data?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </Field>
        </div>
        <Field label="Note">
          <Input
            placeholder="Optional, e.g. counter, restock run"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </Field>
        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => run(() => api(`/api/slots/${slot.id}`, { method: "DELETE" }), "Removed")}
          >
            <Icon name="trash" /> Remove
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  api(`/api/slots/${slot.id}`, {
                    method: "PATCH",
                    body: { userId: form.userId, date: form.date, start: form.start, end: form.end, note: form.note || null },
                  }),
                "Saved",
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
