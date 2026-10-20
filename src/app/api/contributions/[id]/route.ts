import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { entryBody, unitsLabel } from "@/lib/units";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireUser({ admin: true });
  const { id } = await params;
  const body = await parseBody(req, entryBody.partial());
  if (!Object.keys(body).length) throw new HttpError(400, "Nothing to change");
  const db = await getDb();
  const [row] = await db.update(t.contributions).set(body).where(eq(t.contributions.id, id)).returning();
  if (!row) throw new HttpError(404, "Entry not found");
  await logActivity(db, admin.id, "contribution", `Edited a contribution entry (${unitsLabel(row.units)})`, row.id);
  return { entry: row };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireUser({ admin: true });
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.delete(t.contributions).where(eq(t.contributions.id, id)).returning();
  if (!row) throw new HttpError(404, "Entry not found");
  await logActivity(db, admin.id, "contribution", `Deleted a contribution entry (${unitsLabel(row.units)})`, row.id);
  return { ok: true };
});
