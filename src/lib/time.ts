// The shop runs on Pakistan time (UTC+5, no DST). Dates are "YYYY-MM-DD"
// strings in PKT; times of day are "HH:MM".

const PKT_MS = 5 * 60 * 60 * 1000;

export const pkDate = (d: Date | number | string = Date.now()) =>
  new Date(new Date(d).getTime() + PKT_MS).toISOString().slice(0, 10);

export const pkTime = (d: Date | number | string = Date.now()) =>
  new Date(new Date(d).getTime() + PKT_MS).toISOString().slice(11, 16);

/** UTC instants bounding a PKT calendar day: [start, end). */
export function pkDayRange(date: string) {
  const start = new Date(`${date}T00:00:00+05:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Monday of the week containing `date`. */
export const weekStart = (date: string) => addDays(date, -weekday(date));

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const fmtDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export const fmtDateTime = (d: Date | string | number) =>
  new Date(d).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });

/** "14:30" -> "2:30 pm" */
export function fmtClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
