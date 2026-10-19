"use client";

import { useEffect, useState } from "react";
import { cx, Input } from "@/components/ui";
import { addDays, fmtDate, pkDate, weekStart } from "@/lib/time";

// A PKT date range picker shared by the Sales and Shifts pages.

export type Preset = "today" | "yesterday" | "week" | "month" | "custom";
export type Period = { preset: Preset; from: string; to: string };

const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

function presetRange(preset: Preset, today: string): { from: string; to: string } {
  if (preset === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
  if (preset === "week") return { from: weekStart(today), to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: today, to: today };
}

/** The chosen period; null until mounted, since "today" depends on the device clock. */
export function usePeriod(initial: Preset = "today") {
  const [period, setPeriod] = useState<Period | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPeriod({ preset: initial, ...presetRange(initial, pkDate()) }), [initial]);
  return [period, setPeriod] as const;
}

export const periodLabel = (p: { from: string; to: string }) =>
  p.from === p.to ? fmtDate(p.from) : `${fmtDate(p.from)} – ${fmtDate(p.to)}`;

export const periodQuery = (p: { from: string; to: string }) => `from=${p.from}&to=${p.to}`;

export function PeriodPicker({ value, onChange }: { value: Period | null; onChange: (p: Period) => void }) {
  const today = value ? pkDate() : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-lg bg-muted p-0.5">
        {[...PRESETS, { id: "custom" as const, label: "Custom" }].map((p) => (
          <button
            key={p.id}
            onClick={() =>
              onChange(
                p.id === "custom"
                  ? { preset: "custom", from: value?.from ?? today, to: value?.to ?? today }
                  : { preset: p.id, ...presetRange(p.id, pkDate()) },
              )
            }
            className={cx(
              "rounded-md px-2.5 py-1.5 text-sm font-medium",
              value?.preset === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value?.preset === "custom" && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Input
            type="date"
            aria-label="From"
            className="w-38"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          to
          <Input
            type="date"
            aria-label="To"
            className="w-38"
            value={value.to}
            min={value.from}
            max={today}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
