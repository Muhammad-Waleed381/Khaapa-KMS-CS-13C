import { desc, eq, isNull } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";

// Shift history, newest first, plus who is on the counter right now.
export const GET = route(async (req) => {
  await requireUser();
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 100, 1), 500);
  const db = await getDb();
  const rows = await db
    .select({
      id: t.shifts.id,
      userId: t.shifts.userId,
      name: t.users.name,
      startedAt: t.shifts.startedAt,
      endedAt: t.shifts.endedAt,
    })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .orderBy(desc(t.shifts.startedAt))
    .limit(limit);
  const open = await db
    .select({ userId: t.shifts.userId, name: t.users.name, startedAt: t.shifts.startedAt })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .where(isNull(t.shifts.endedAt));
  const now = Date.now();
  return {
    shifts: rows.map((s) => ({
      ...s,
      minutes: Math.round(((s.endedAt?.getTime() ?? now) - s.startedAt.getTime()) / 60000),
    })),
    onCounter: open,
  };
});
