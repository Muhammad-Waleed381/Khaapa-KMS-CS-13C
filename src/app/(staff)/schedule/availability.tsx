"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Badge, Button, cx, Spinner, StaleNote } from "@/components/ui";
import { api, useApi } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { WEEKDAYS } from "@/lib/time";
import { cellKey, cellsToWindows, hourLabel, HOURS, windowsToCells, type Window } from "./types";

/**
 * Members tap (or drag across) the hours they can usually work each week.
 * Saving replaces their whole week; HR plans duties from these.
 */
export function MyAvailability() {
  const { user, isAdmin } = useMe();
  const { data, stale, reload } = useApi<{ availability: Window[]; availabilityOpen: boolean }>("/api/availability");
  const mine = (data?.availability ?? []).filter((w) => w.userId === user.id);
  const savedKey = JSON.stringify(cellsToWindows(windowsToCells(mine)));

  const [cells, setCells] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  // Fill the grid from the server once, then whenever a save lands.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!data || loadedKey.current === savedKey) return;
    loadedKey.current = savedKey;
    setCells(windowsToCells(mine));
  }, [data, savedKey, mine]);

  const open = data?.availabilityOpen ?? false;
  const canEdit = open || isAdmin;
  const dirty = cells !== null && JSON.stringify(cellsToWindows(cells)) !== savedKey;

  // Dragging paints every cell the pointer passes over the same way as the first.
  const paint = useRef<boolean | null>(null);
  useEffect(() => {
    const stop = () => (paint.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  function set(key: string, on: boolean) {
    setCells((c) => {
      const next = new Set(c);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleDay(d: number) {
    if (!canEdit || !cells) return;
    const all = HOURS.every((h) => cells.has(cellKey(d, h)));
    setCells((c) => {
      const next = new Set(c);
      for (const h of HOURS) {
        if (all) next.delete(cellKey(d, h));
        else next.add(cellKey(d, h));
      }
      return next;
    });
  }

  async function save() {
    if (!cells) return;
    setBusy(true);
    try {
      await api("/api/availability", { method: "PUT", body: { windows: cellsToWindows(cells) } });
      toast("Availability saved");
      await reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !cells)
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    );

  const hours = cells.size;

  return (
    <div className="space-y-5">
      <StaleNote stale={stale} />
      <div className="flex flex-wrap items-center gap-3">
        {open ? <Badge tone="good">HR is collecting times</Badge> : <Badge>Closed until HR asks for times</Badge>}
        <span className="text-sm text-ink-soft">
          You&apos;re free <b className="text-ink">{hours}</b> hour{hours === 1 ? "" : "s"} a week
        </span>
      </div>
      <p className="text-sm text-ink-soft">
        {canEdit
          ? "Tap the hours you can usually work, or drag across several. Tap a day's name to fill or clear the whole day."
          : "HR opens this when they're planning a new week. You can look, but changes are locked for now."}
      </p>

      <div className="rounded-2xl border border-line bg-surface p-2 sm:p-4">
        <div className="grid select-none gap-1 sm:gap-1.5" style={{ gridTemplateColumns: "2.25rem repeat(7, minmax(0, 1fr))" }}>
          <div />
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              disabled={!canEdit}
              onClick={() => toggleDay(i)}
              className="rounded-lg py-1.5 text-xs font-semibold text-ink-soft hover:bg-muted hover:text-ink disabled:hover:bg-transparent"
            >
              {d}
            </button>
          ))}
          {HOURS.map((h) => (
            <Row key={h}>
              <div className="flex items-center justify-end pr-1 text-[10px] text-ink-faint tabular-nums sm:text-[11px]">{hourLabel(h)}</div>
              {WEEKDAYS.map((_, d) => {
                const k = cellKey(d, h);
                const on = cells.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={on}
                    aria-label={`${WEEKDAYS[d]} ${hourLabel(h)}`}
                    onPointerDown={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      paint.current = !on;
                      set(k, !on);
                    }}
                    onPointerEnter={() => paint.current !== null && set(k, paint.current)}
                    onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), set(k, !on))}
                    className={cx(
                      "grid h-9 place-items-center rounded-lg text-xs font-medium transition sm:h-10",
                      on ? "bg-primary text-primary-foreground" : "bg-muted text-transparent",
                      canEdit && !on && "hover:bg-primary-soft",
                    )}
                  >
                    ✓
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {dirty && <span className="text-sm text-ink-soft">You have unsaved changes</span>}
          <Button
            variant="ghost"
            disabled={!dirty || busy}
            onClick={() => setCells(windowsToCells(mine))}
          >
            Undo changes
          </Button>
          <Button variant="primary" size="lg" disabled={!dirty || busy} onClick={save}>
            {busy ? "Saving…" : "Save my availability"}
          </Button>
        </div>
      )}
    </div>
  );
}

// A grid row is just its cells; this keeps the JSX readable.
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
