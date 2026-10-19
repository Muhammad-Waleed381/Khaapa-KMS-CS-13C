export type Slot = {
  id: string;
  userId: string;
  name: string;
  date: string;
  start: string;
  end: string;
  note: string | null;
};

export type Window = {
  id: string;
  userId: string;
  name: string;
  weekday: number;
  start: string;
  end: string;
  note: string | null;
};

export type Person = { id: string; name: string };

/** Mon..Sun dates of the week starting at `monday`. */
export const weekDates = (monday: string, addDays: (d: string, n: number) => string) =>
  Array.from({ length: 7 }, (_, i) => addDays(monday, i));

// The availability grid works in one-hour blocks across the shop's day.
export const FIRST_HOUR = 9;
export const LAST_HOUR = 17; // blocks run 9–10 … 16–17
export const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
export const cellKey = (weekday: number, hour: number) => `${weekday}-${hour}`;
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

/** Blocks fully covered by the windows. */
export function windowsToCells(windows: Pick<Window, "weekday" | "start" | "end">[]) {
  const cells = new Set<string>();
  for (const w of windows)
    for (const h of HOURS) if (w.start <= pad(h) && w.end >= pad(h + 1)) cells.add(cellKey(w.weekday, h));
  return cells;
}

/** Back to windows: runs of consecutive blocks on a day become one window. */
export function cellsToWindows(cells: Set<string>) {
  const out: { weekday: number; start: string; end: string }[] = [];
  for (let d = 0; d < 7; d++) {
    let runStart: number | null = null;
    for (const h of [...HOURS, LAST_HOUR]) {
      const on = h < LAST_HOUR && cells.has(cellKey(d, h));
      if (on && runStart === null) runStart = h;
      if (!on && runStart !== null) {
        out.push({ weekday: d, start: pad(runStart), end: pad(h) });
        runStart = null;
      }
    }
  }
  return out;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** "09:00","11:00" -> "9–11 am"; "11:00","13:30" -> "11 am–1:30 pm". */
export function timeRangeShort(start: string, end: string) {
  const part = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return { t: `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}`, ap: h < 12 ? "am" : "pm" };
  };
  const a = part(start);
  const b = part(end);
  return a.ap === b.ap ? `${a.t}–${b.t} ${b.ap}` : `${a.t} ${a.ap}–${b.t} ${b.ap}`;
}
