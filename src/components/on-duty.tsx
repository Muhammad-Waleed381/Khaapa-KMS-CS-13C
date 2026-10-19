"use client";

import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui";
import type { DutySlotRow } from "@/lib/client/me";
import { dutyAt } from "@/lib/duty";
import { fmtClock } from "@/lib/time";

const TICK = 30_000;

/** The clock, rounded to 30 s so it only re-renders when the answer can change. 0 while prerendering. */
function useNow() {
  return useSyncExternalStore(
    (l) => {
      const timer = setInterval(l, TICK);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / TICK) * TICK,
    () => 0,
  );
}

const names = (slots: DutySlotRow[]) => slots.map((s) => s.name).join(", ");

/** Who the schedule puts at the counter right now, and who reports next. */
export function OnDuty({ slots, className }: { slots: DutySlotRow[]; className?: string }) {
  const now = useNow();
  if (!now) return null;
  const { current, next } = dutyAt(slots, now);

  return (
    <div className={cx("rounded-2xl bg-muted px-3 py-2.5 text-xs", className)}>
      <div className="font-medium text-ink-faint">On duty now</div>
      {current.length ? (
        <ul className="mt-1 space-y-0.5">
          {current.map((s) => (
            <li key={`${s.userId}-${s.start}`} className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-ink">{s.name}</span>
              <span className="shrink-0 text-ink-soft tabular-nums">until {fmtClock(s.end)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-ink-soft">No one scheduled</div>
      )}
      {next.length > 0 && (
        <div className="mt-1.5 border-t border-line pt-1.5 text-ink-soft">
          Next: <span className="font-medium text-ink">{names(next)}</span> at{" "}
          <span className="tabular-nums">{fmtClock(next[0].start)}</span>
        </div>
      )}
    </div>
  );
}
