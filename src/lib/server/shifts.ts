import { and, eq, gte, inArray, isNull, lte, max } from "drizzle-orm";
import { t, type DB, type Tx } from "@/db";
import { slotForShift, slotInstant } from "@/lib/duty";
import { fmtClock, pkDate } from "@/lib/time";
import { logActivity } from "./api";

/**
 * Closes counter shifts whose duty slot has ended. There's no cron on the free
 * Vercel plan, so the routes that read shifts call this first. The device runs
 * the same rule offline (see useShiftAutoEnd), and whichever side closes the
 * shift first wins: the other side's shift_end is a duplicate.
 */
export async function closeOverdueShifts(db: DB | Tx) {
  const open = await db.select().from(t.shifts).where(isNull(t.shifts.endedAt));
  if (!open.length) return;
  const dates = open.map((s) => pkDate(s.startedAt)).sort();
  const slots = await db
    .select({ userId: t.slots.userId, date: t.slots.date, start: t.slots.start, end: t.slots.end })
    .from(t.slots)
    .where(
      and(
        inArray(t.slots.userId, [...new Set(open.map((s) => s.userId))]),
        gte(t.slots.date, dates[0]),
        lte(t.slots.date, dates[dates.length - 1]),
      ),
    );
  const now = Date.now();
  for (const s of open) {
    const slot = slotForShift(s, slots);
    if (!slot) continue;
    let endedAt = slotInstant(slot.date, slot.end);
    if (endedAt.getTime() > now) continue;
    // A sale rung up after the slot ended (a handover that ran over) stays inside the shift.
    const [last] = await db.select({ at: max(t.sales.createdAt) }).from(t.sales).where(eq(t.sales.shiftId, s.id));
    if (last?.at && last.at > endedAt) endedAt = last.at;
    const closed = await db
      .update(t.shifts)
      .set({ endedAt })
      .where(and(eq(t.shifts.id, s.id), isNull(t.shifts.endedAt)))
      .returning({ id: t.shifts.id });
    if (closed.length)
      await logActivity(db, s.userId, "shift", `Shift ended automatically at the end of the duty slot (${fmtClock(slot.end)})`, s.id);
  }
}
