import { z } from "zod";

// Contributions are counted in 30-minute units: 1 unit = 30 min, 2 = 1 h.
export const UNIT_MINUTES = 30;
/** A day's worth at most (24 hours). */
export const MAX_UNITS = 48;

/** "30m", "1h", "2h 30m" */
export function unitsLabel(units: number) {
  const m = units * UNIT_MINUTES;
  const h = Math.floor(m / 60);
  return h ? `${h}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
}

/** What an admin sends to log or edit a contribution entry. */
export const entryBody = z.object({
  userId: z.uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
    .refine((d) => d <= new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10), "date can't be in the future"),
  units: z.number().int().min(1).max(MAX_UNITS),
  note: z.string().trim().max(200).default(""),
});
