import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb, t } from "@/db";
import { currentUser, HttpError, route } from "@/lib/server/api";
import { closeOverdueShifts } from "@/lib/server/shifts";
import { addDays, pkDate } from "@/lib/time";

// Who is signed in, their open shift, who else is on the counter, and the duty
// slots around today (so the device can show who's on duty and end shifts offline).
// Pending users get their row too so the app can show the approval screen.
export const GET = route(async () => {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in first");
  const db = await getDb();
  await closeOverdueShifts(db);
  const open = await db
    .select({ id: t.shifts.id, userId: t.shifts.userId, startedAt: t.shifts.startedAt, name: t.users.name })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .where(isNull(t.shifts.endedAt));
  const [mine] = await db
    .select()
    .from(t.shifts)
    .where(and(eq(t.shifts.userId, user.id), isNull(t.shifts.endedAt)));
  const today = pkDate();
  const slots =
    user.status === "active"
      ? await db
          .select({ userId: t.slots.userId, name: t.users.name, date: t.slots.date, start: t.slots.start, end: t.slots.end })
          .from(t.slots)
          .innerJoin(t.users, eq(t.users.id, t.slots.userId))
          .where(and(gte(t.slots.date, addDays(today, -1)), lte(t.slots.date, addDays(today, 1))))
          .orderBy(asc(t.slots.date), asc(t.slots.start))
      : [];
  return {
    user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role, status: user.status },
    shift: mine ?? null,
    onCounter: open.map((s) => ({ userId: s.userId, name: s.name, startedAt: s.startedAt })),
    slots,
  };
});
