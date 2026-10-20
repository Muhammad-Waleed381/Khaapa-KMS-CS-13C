import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { entryBody, unitsLabel } from "@/lib/units";

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
