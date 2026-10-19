import { eq, isNull } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { periodFromQuery, shiftsForPeriod } from "@/lib/server/reports";
import { closeOverdueShifts } from "@/lib/server/shifts";

// Counter shifts in a PKT period (?from=&to=; default the last 7 days), each set
// against its planned duty slot, plus who is on the counter right now.
export const GET = route(async (req) => {
  await requireUser();
  const db = await getDb();
  await closeOverdueShifts(db);
  const onCounter = await db
    .select({ userId: t.shifts.userId, name: t.users.name, startedAt: t.shifts.startedAt })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .where(isNull(t.shifts.endedAt));
  return { ...(await shiftsForPeriod(db, periodFromQuery(new URL(req.url).searchParams, 7))), onCounter };
});
