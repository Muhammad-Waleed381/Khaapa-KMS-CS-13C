"use client";

import { toast } from "@/components/toast";
import { Badge, Button, Card, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { fmtClock, WEEKDAYS } from "@/lib/time";
import type { Person, Window } from "./types";

/** HR's view of everyone's weekly availability, and who hasn't entered theirs. */
export function AllAvailability() {
  const avail = useApi<{ availability: Window[]; availabilityOpen: boolean }>("/api/availability");
  const people = useApi<{ users: Person[] }>("/api/users?active=1");
  const windows = avail.data?.availability ?? [];
  const users = people.data?.users ?? [];
  const respondents = new Set(windows.map((w) => w.userId));
  const missing = users.filter((u) => !respondents.has(u.id));

  async function toggleCollection() {
    try {
      await api("/api/schedule/settings", { body: { availabilityOpen: !avail.data?.availabilityOpen } });
      avail.reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  return (
    <div className="space-y-4">
      <StaleNote stale={avail.stale} />
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            Collecting availability
            {avail.data?.availabilityOpen ? <Badge tone="good">Open</Badge> : <Badge>Closed</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">
            {respondents.size} of {users.length} people have entered their times.
            {missing.length > 0 && ` Not yet: ${missing.map((m) => m.name).join(", ")}.`}
          </div>
        </div>
        <Button onClick={toggleCollection}>
          {avail.data?.availabilityOpen ? "Stop collecting" : "Ask everyone for times"}
        </Button>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAYS.map((d, i) => {
          const list = windows.filter((w) => w.weekday === i).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <Card key={d} className="p-3">
              <div className="mb-2 text-xs font-semibold text-ink-soft">{d}</div>
              {list.length === 0 ? (
                <div className="text-xs text-ink-faint">Nobody free</div>
              ) : (
                <ul className="space-y-1">
                  {list.map((w) => (
                    <li key={w.id} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{w.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                        {fmtClock(w.start)}–{fmtClock(w.end)}
                      </span>
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
