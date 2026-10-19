import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { getSetting, HttpError, requireUser, route } from "@/lib/server/api";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select().from(t.availability).where(eq(t.availability.id, id));
  if (!row) throw new HttpError(404, "Not found");
  const isAdmin = user.role === "admin";
  if (!isAdmin && row.userId !== user.id) throw new HttpError(403, "Not yours");
  if (!isAdmin && !(await getSetting("availability_open", false)))
    throw new HttpError(403, "Availability collection is closed");
  await db.delete(t.availability).where(eq(t.availability.id, id));
  return { ok: true };
});
