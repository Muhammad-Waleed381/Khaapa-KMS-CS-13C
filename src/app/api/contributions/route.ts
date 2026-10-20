import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { entryBody, unitsLabel } from "@/lib/units";
import { activeMembers, contributionBoard, periodFromQuery } from "@/lib/server/contributions";

// The board for signed-in staff. Only totals and hand-logged entries are shown;
// shift start and end times stay private. Admins also get the member list to log against.
export const GET = route(async (req) => {
  const user = await requireUser();
  const db = await getDb();
  const canEdit = user.role === "admin";
  const board = await contributionBoard(db, periodFromQuery(new URL(req.url).searchParams));
  return { ...board, canEdit, members: canEdit ? await activeMembers(db) : undefined };
});

// Admins log time by hand, in 30-minute units.
export const POST = route(async (req) => {
  const admin = await requireUser({ admin: true });
  const body = await parseBody(req, entryBody);
  const db = await getDb();
  const [member] = await db
    .select({ id: t.users.id, name: t.users.name, status: t.users.status })
    .from(t.users)
    .where(eq(t.users.id, body.userId));
  if (!member || member.status !== "active") throw new HttpError(400, "Pick an active member");
  const [row] = await db.insert(t.contributions).values({ ...body, createdBy: admin.id }).returning();
  await logActivity(
    db,
    admin.id,
    "contribution",
    `Logged ${unitsLabel(row.units)} for ${member.name}${row.note ? `: ${row.note}` : ""}`,
    row.id,
  );
  return { entry: row };
});
