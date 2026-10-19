import { and, eq, isNull } from "drizzle-orm";
import { getDb, t } from "@/db";
import { currentUser, HttpError, route } from "@/lib/server/api";

// Who is signed in, their open shift, and who else is on the counter.
// Pending users get their row too so the app can show the approval screen.
export const GET = route(async () => {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in first");
  const db = await getDb();
  const open = await db
    .select({ id: t.shifts.id, userId: t.shifts.userId, startedAt: t.shifts.startedAt, name: t.users.name })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .where(isNull(t.shifts.endedAt));
  const [mine] = await db
    .select()
    .from(t.shifts)
    .where(and(eq(t.shifts.userId, user.id), isNull(t.shifts.endedAt)));
  return {
    user: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role, status: user.status },
    shift: mine ?? null,
    onCounter: open.map((s) => ({ userId: s.userId, name: s.name, startedAt: s.startedAt })),
  };
});
