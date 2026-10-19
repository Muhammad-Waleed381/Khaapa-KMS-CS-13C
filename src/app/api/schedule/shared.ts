import { z } from "zod";
import { t } from "@/db";

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

/** Rejects windows that end before they start. */
export const timeRange = <T extends { start: string; end: string }>(v: T) => v.end > v.start;
export const rangeMsg = { message: "end must be after start", path: ["end"] };

export const slotBody = z
  .object({
    userId: z.string().uuid(),
    date: isoDate,
    start: hhmm,
    end: hhmm,
    note: z.string().trim().max(200).optional().nullable(),
  })
  .refine(timeRange, rangeMsg);

export const slotColumns = {
  id: t.slots.id,
  userId: t.slots.userId,
  name: t.users.name,
  date: t.slots.date,
  start: t.slots.start,
  end: t.slots.end,
  note: t.slots.note,
};
