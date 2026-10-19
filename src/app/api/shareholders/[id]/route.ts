import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { shareholderInput } from "../schema";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  const body = await parseBody(req, shareholderInput.partial());
  const db = await getDb();
  const [row] = await db.update(t.shareholders).set(body).where(eq(t.shareholders.id, id)).returning();
  if (!row) throw new HttpError(404, "Shareholder not found");
  await logActivity(db, user.id, "shares", `Updated shareholder ${row.name}`, row.id);
  return { shareholder: row };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.delete(t.shareholders).where(eq(t.shareholders.id, id)).returning();
  if (!row) throw new HttpError(404, "Shareholder not found");
  await logActivity(db, user.id, "shares", `Removed shareholder ${row.name}`, row.id);
  return { ok: true };
});
