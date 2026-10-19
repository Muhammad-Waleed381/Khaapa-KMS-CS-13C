import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.delete(t.costs).where(eq(t.costs.id, id)).returning();
  if (!row) throw new HttpError(404, "Cost not found");
  await logActivity(db, user.id, "cost", `Deleted cost ${rs(row.amount)}: ${row.note}`, row.id);
  return { ok: true };
});
