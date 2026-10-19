"use client";

import { useState } from "react";
import { ActionCard, Explainer, Section } from "@/components/kit";
import { toast } from "@/components/toast";
import { Badge, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { WEEKDAYS } from "@/lib/time";
import { cellKey, hourLabel, HOURS, initials, windowsToCells, type Person, type Window } from "./types";

/**
 * HR's view of everyone's weekly availability: a heat grid (darker = more
 * people free), tap a block to see who, plus who hasn't answered yet.
 */
export function AllAvailability() {
  const avail = useApi<{ availability: Window[]; availabilityOpen: boolean }>("/api/availability");
  const people = useApi<{ users: Person[] }>("/api/users?active=1");
  const [picked, setPicked] = useState<string | null>(null);
  const windows = avail.data?.availability ?? [];
  const users = people.data?.users ?? [];
  const open = avail.data?.availabilityOpen ?? false;

  // Who is free in each block.
  const free = new Map<string, string[]>();
  for (const u of users) {
    for (const k of windowsToCells(windows.filter((w) => w.userId === u.id))) free.set(k, [...(free.get(k) ?? []), u.name]);
  }
  const most = Math.max(1, ...[...free.values()].map((v) => v.length));
  const respondents = new Set(windows.map((w) => w.userId));
  const missing = users.filter((u) => !respondents.has(u.id));

  async function toggleCollection() {
    try {
      await api("/api/schedule/settings", { body: { availabilityOpen: !open } });
      toast(open ? "Stopped collecting times" : "Everyone can now enter their times");
      avail.reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  const pickedNames = picked ? (free.get(picked) ?? []) : [];
  const [pd, ph] = picked ? picked.split("-").map(Number) : [0, 0];

  return (
    <div className="space-y-8">
      <StaleNote stale={avail.stale} />
      <ActionCard
        title={open ? "Collecting times now" : "Planning a new week?"}
        description={
          open
            ? `${respondents.size} of ${users.length} people have answered. Stop collecting once you have enough to plan.`
            : "Ask everyone to fill in when they're free. They'll see the grid unlocked on their Schedule page."
        }
        cta={open ? "Stop collecting" : "Ask everyone for times"}
        onClick={toggleCollection}
      />

      <Section title="Who's free when" description="Darker blocks have more people free. Tap a block to see who.">
        <div className="rounded-2xl border border-line bg-surface p-2 sm:p-4">
          <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: "2.25rem repeat(7, minmax(0, 1fr))" }}>
            <div />
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1.5 text-center text-xs font-semibold text-ink-soft">
                {d}
              </div>
            ))}
            {HOURS.map((h) => (
              <HourRow key={h}>
                <div className="flex items-center justify-end pr-1 text-[10px] text-ink-faint tabular-nums sm:text-[11px]">{hourLabel(h)}</div>
                {WEEKDAYS.map((_, d) => {
                  const k = cellKey(d, h);
                  const n = free.get(k)?.length ?? 0;
                  // One hue, light to dark: the share of the busiest block.
                  const strength = n === 0 ? 0 : 0.18 + 0.82 * (n / most);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPicked(picked === k ? null : k)}
                      aria-label={`${WEEKDAYS[d]} ${hourLabel(h)}: ${n} free`}
                      className="relative grid h-9 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-semibold tabular-nums sm:h-10"
                    >
                      <span className="absolute inset-0" style={{ background: "var(--series-1)", opacity: strength }} />
                      <span className={n / most > 0.55 ? "relative text-white" : "relative text-ink"}>{n || ""}</span>
                      {picked === k && <span className="absolute inset-0 rounded-lg ring-2 ring-ink" />}
                    </button>
                  );
                })}
              </HourRow>
            ))}
          </div>
        </div>
        {picked && (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-sm font-medium">
              {WEEKDAYS[pd]} {hourLabel(ph)} – {hourLabel(ph + 1)}
            </div>
            {pickedNames.length === 0 ? (
              <div className="mt-1 text-sm text-ink-faint">Nobody said they&apos;re free.</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {pickedNames.map((n) => (
                  <PersonChip key={n} name={n} />
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Haven't answered yet"
        description={missing.length ? "Remind these people to fill in their times." : undefined}
        action={missing.length > 0 && <Badge tone="warn">{missing.length}</Badge>}
      >
        {missing.length === 0 ? (
          <Explainer>Everyone has entered their times.</Explainer>
        ) : (
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <PersonChip key={m.id} name={m.name} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function HourRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function PersonChip({ name, highlight }: { name: string; highlight?: boolean }) {
  return (
    <span
      className={
        highlight
          ? "inline-flex items-center gap-2 rounded-full bg-primary-soft py-1 pr-3 pl-1 text-sm font-medium text-primary"
          : "inline-flex items-center gap-2 rounded-full bg-muted py-1 pr-3 pl-1 text-sm font-medium text-ink"
      }
    >
      <span
        className={
          highlight
            ? "grid size-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
            : "grid size-6 place-items-center rounded-full bg-surface text-[10px] font-bold text-ink-soft"
        }
      >
        {initials(name)}
      </span>
      {name}
    </span>
  );
}
