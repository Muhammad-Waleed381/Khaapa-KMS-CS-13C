import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { fmtClock, fmtDate } from "@/lib/time";
import { isoDate, slotBody, slotColumns } from "../schedule/shared";

// Members only ever see their own duties; HR (admins) see everyone's.
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  const to = q.get("to");
  if (!from || !to || !isoDate.safeParse(from).success || !isoDate.safeParse(to).success)
    throw new HttpError(400, "from and to (YYYY-MM-DD) are required");
  const db = await getDb();
  const slots = await db
    .select(slotColumns)
    .from(t.slots)
    .innerJoin(t.users, eq(t.users.id, t.slots.userId))
    .where(
      and(
        gte(t.slots.date, from),
        lte(t.slots.date, to),
        user.role === "admin" ? undefined : eq(t.slots.userId, user.id),
      ),
    )
    .orderBy(asc(t.slots.date), asc(t.slots.start));
  return { slots };
});

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const s = await parseBody(req, slotBody);
  const db = await getDb();
  const [person] = await db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, s.userId));
  if (!person) throw new HttpError(404, "Person not found");
  const [row] = await db
    .insert(t.slots)
    .values({ ...s, note: s.note || null, createdBy: user.id })
    .returning();
  await logActivity(
    db,
    user.id,
    "schedule",
    `Assigned ${person.name} ${fmtDate(s.date)}, ${fmtClock(s.start)}–${fmtClock(s.end)}`,
    row.id,
  );
  return { slot: { ...row, name: person.name } };
});
