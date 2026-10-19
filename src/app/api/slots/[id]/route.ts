import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { fmtClock, fmtDate } from "@/lib/time";
import { hhmm, isoDate } from "../../schedule/shared";

const patch = z.object({
  userId: z.string().uuid().optional(),
  date: isoDate.optional(),
  start: hhmm.optional(),
  end: hhmm.optional(),
  note: z.string().trim().max(200).optional().nullable(),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  const p = await parseBody(req, patch);
  const db = await getDb();
  const [old] = await db.select().from(t.slots).where(eq(t.slots.id, id));
  if (!old) throw new HttpError(404, "Slot not found");
  const next = { ...old, ...p, note: p.note === undefined ? old.note : p.note || null };
  if (next.end <= next.start) throw new HttpError(400, "end must be after start");
  const [row] = await db
    .update(t.slots)
    .set({ userId: next.userId, date: next.date, start: next.start, end: next.end, note: next.note })
    .where(eq(t.slots.id, id))
    .returning();
  const [person] = await db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, row.userId));
  await logActivity(
    db,
    user.id,
    "schedule",
    `Changed slot: ${person?.name ?? "?"} ${fmtDate(row.date)}, ${fmtClock(row.start)}–${fmtClock(row.end)}`,
    row.id,
  );
  return { slot: { ...row, name: person?.name ?? "" } };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  const db = await getDb();
  const [old] = await db
    .select({ date: t.slots.date, start: t.slots.start, end: t.slots.end, name: t.users.name })
    .from(t.slots)
    .innerJoin(t.users, eq(t.users.id, t.slots.userId))
    .where(eq(t.slots.id, id));
  if (!old) throw new HttpError(404, "Slot not found");
  await db.delete(t.slots).where(eq(t.slots.id, id));
  await logActivity(
    db,
    user.id,
    "schedule",
    `Removed ${old.name} from ${fmtDate(old.date)}, ${fmtClock(old.start)}–${fmtClock(old.end)}`,
    id,
  );
  return { ok: true };
});
