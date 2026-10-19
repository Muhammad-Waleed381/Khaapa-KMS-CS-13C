"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Field, Input, Select, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { fmtClock, WEEKDAYS } from "@/lib/time";
import type { Window } from "./types";

/** Members enter the weekly windows they can work; HR plans from these. */
export function MyAvailability() {
  const { user, isAdmin } = useMe();
  const { data, stale, reload } = useApi<{ availability: Window[]; availabilityOpen: boolean }>(
    "/api/availability",
  );
  const [form, setForm] = useState({ weekday: "0", start: "09:00", end: "11:00", note: "" });
  const [busy, setBusy] = useState(false);

  const open = data?.availabilityOpen ?? false;
  const canEdit = open || isAdmin;
  const mine = (data?.availability ?? []).filter((w) => w.userId === user.id);

  async function add() {
    setBusy(true);
    try {
      await api("/api/availability", {
        body: { weekday: Number(form.weekday), start: form.start, end: form.end, note: form.note || null },
      });
      toast("Added");
      setForm((f) => ({ ...f, note: "" }));
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/availability/${id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  return (
    <div className="space-y-4">
      <StaleNote stale={stale} />
      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <div className="text-sm font-medium">Your weekly availability</div>
          <div className="text-xs text-ink-soft">
            Add every time window you can be at the counter. HR uses these to plan the duties.
          </div>
        </div>
        {open ? <Badge tone="good">Collection open</Badge> : <Badge>Closed until HR opens it</Badge>}
      </Card>

      {canEdit && (
        <Card className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] sm:items-end">
            <Field label="Day">
              <Select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From">
              <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </Field>
            <Field label="Note">
              <Input
                placeholder="Optional, e.g. only after lab"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
            <Button variant="primary" className="col-span-2 sm:col-span-1" disabled={busy} onClick={add}>
              <Icon name="plus" /> Add
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAYS.map((d, i) => {
          const list = mine.filter((w) => w.weekday === i);
          return (
            <Card key={d} className="p-3">
              <div className="mb-2 text-xs font-semibold text-ink-soft">{d}</div>
              {list.length === 0 ? (
                <div className="text-xs text-ink-faint">Not available</div>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((w) => (
                    <li key={w.id} className="flex items-start justify-between gap-2 rounded-md bg-muted px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium tabular-nums">
                          {fmtClock(w.start)} – {fmtClock(w.end)}
                        </div>
                        {w.note && <div className="truncate text-xs text-ink-soft">{w.note}</div>}
                      </div>
                      {canEdit && (
                        <button
                          aria-label="Remove"
                          onClick={() => remove(w.id)}
                          className="rounded p-1 text-ink-faint hover:bg-surface hover:text-red-600"
                        >
                          <Icon name="x" className="size-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
