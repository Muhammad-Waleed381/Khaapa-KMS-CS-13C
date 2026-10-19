"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Button, Card, Input, Select } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { addDays, fmtClock, fmtDate, weekday } from "@/lib/time";
import { weekDates, type Person, type Slot, type Window } from "./types";

type Draft = { key: number; userId: string; date: string; start: string; end: string; note: string };

let draftKey = 1;

/**
 * HR's planning board: for each day of the week, who said they're available,
 * what's already assigned, and a draft list of new slots saved in one go.
 */
export function PlanWeek({ week, slots, onSaved }: { week: string; slots: Slot[]; onSaved: () => void }) {
  const avail = useApi<{ availability: Window[]; availabilityOpen: boolean }>("/api/availability");
  const people = useApi<{ users: Person[] }>("/api/users?active=1");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  const windows = avail.data?.availability ?? [];
  const users = people.data?.users ?? [];
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "?";
  const weekDrafts = drafts.filter((d) => d.date >= week && d.date <= addDays(week, 6));

  const addDraft = (d: Omit<Draft, "key">) => setDrafts((list) => [...list, { ...d, key: draftKey++ }]);

  async function saveAll() {
    setSaving(true);
    try {
      const { created } = await api<{ created: number }>("/api/slots/bulk", {
        body: {
          slots: weekDrafts.map((d) => ({ userId: d.userId, date: d.date, start: d.start, end: d.end, note: d.note || null })),
        },
      });
      toast(`Assigned ${created} slot${created > 1 ? "s" : ""}`);
      setDrafts((list) => list.filter((d) => !weekDrafts.includes(d)));
      onSaved();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setSaving(false);
    }
  }

  const respondents = new Set(windows.map((w) => w.userId));
  const missing = users.filter((u) => !respondents.has(u.id));

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        {respondents.size} of {users.length} people have told you when they&apos;re free
        {missing.length > 0 && <> · not yet: {missing.map((m) => m.name).join(", ")}</>}. Tap a free person to add
        their time, or use Quick assign.
      </p>

      {weekDrafts.length > 0 && (
        <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 shadow-sm md:top-3">
          <div className="text-sm font-semibold text-primary">
            {weekDrafts.length} new dut{weekDrafts.length > 1 ? "ies" : "y"} not saved yet
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDrafts((l) => l.filter((d) => !weekDrafts.includes(d)))}>
              Discard
            </Button>
            <Button variant="primary" disabled={saving} onClick={saveAll}>
              {saving ? "Saving…" : "Save all"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {weekDates(week, addDays).map((date) => (
          <DayPlan
            key={date}
            date={date}
            windows={windows.filter((w) => w.weekday === weekday(date))}
            slots={slots.filter((s) => s.date === date)}
            drafts={weekDrafts.filter((d) => d.date === date)}
            users={users}
            nameOf={nameOf}
            onAdd={addDraft}
            onRemove={(key) => setDrafts((l) => l.filter((d) => d.key !== key))}
          />
        ))}
      </div>
    </div>
  );
}

function DayPlan({
  date,
  windows,
  slots,
  drafts,
  users,
  nameOf,
  onAdd,
  onRemove,
}: {
  date: string;
  windows: Window[];
  slots: Slot[];
  drafts: Draft[];
  users: Person[];
  nameOf: (id: string) => string;
  onAdd: (d: Omit<Draft, "key">) => void;
  onRemove: (key: number) => void;
}) {
  const [userId, setUserId] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);

  const availableIds = new Set(windows.map((w) => w.userId));
  const choices = showAll || availableIds.size === 0 ? users : users.filter((u) => availableIds.has(u.id));

  function pick(id: string) {
    setUserId(id);
    // Default the time to the person's first window that day.
    const w = windows.find((x) => x.userId === id);
    if (w) {
      setStart(w.start);
      setEnd(w.end);
    }
  }

  function add() {
    if (!userId) return toast("Pick a person", "bad");
    if (end <= start) return toast("End must be after start", "bad");
    onAdd({ userId, date, start, end, note });
    setNote("");
  }

  return (
    <Card className="border border-line p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div className="text-base font-semibold">{fmtDate(date)}</div>
        <div className="text-xs text-ink-faint">
          {slots.length + drafts.length} slot{slots.length + drafts.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-sm font-medium text-ink-soft">Free that day</div>
          {windows.length === 0 ? (
            <div className="text-xs text-ink-faint">Nobody has said they&apos;re free.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {windows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => onAdd({ userId: w.userId, date, start: w.start, end: w.end, note: "" })}
                  title={w.note ?? "Click to assign this window"}
                  className="rounded-full border border-line bg-muted px-3 py-1.5 text-left text-sm hover:border-primary hover:bg-primary-soft"
                >
                  <span className="font-medium">{w.name}</span>{" "}
                  <span className="tabular-nums text-ink-soft">
                    {fmtClock(w.start)}–{fmtClock(w.end)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 mb-2 text-sm font-medium text-ink-soft">On duty</div>
          {slots.length + drafts.length === 0 ? (
            <div className="text-xs text-ink-faint">Nobody scheduled</div>
          ) : (
            <ul className="space-y-1">
              {slots.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <Icon name="check" className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums text-ink-soft">
                    {fmtClock(s.start)}–{fmtClock(s.end)}
                  </span>
                  {s.note && <span className="truncate text-xs text-ink-faint">{s.note}</span>}
                </li>
              ))}
              {drafts.map((d) => (
                <li key={d.key} className="flex items-center gap-2 text-sm text-primary">
                  <Icon name="plus" className="size-3.5" />
                  <span className="font-medium">{nameOf(d.userId)}</span>
                  <span className="tabular-nums">
                    {fmtClock(d.start)}–{fmtClock(d.end)}
                  </span>
                  {d.note && <span className="truncate text-xs">{d.note}</span>}
                  <button
                    aria-label="Remove draft"
                    onClick={() => onRemove(d.key)}
                    className="ml-auto rounded p-0.5 text-ink-faint hover:text-destructive"
                  >
                    <Icon name="x" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-muted/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-ink-soft">Quick assign</div>
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show everyone
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select className="col-span-2" value={userId} onChange={(e) => pick(e.target.value)}>
              <option value="">Pick a person…</option>
              {choices.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {availableIds.has(u.id) ? "" : " (not marked available)"}
                </option>
              ))}
            </Select>
            <Input type="time" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input type="time" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} />
            <Input
              className="col-span-2"
              placeholder="Note, e.g. counter, restock run"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button className="col-span-2" onClick={add}>
              <Icon name="plus" /> Add to plan
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

