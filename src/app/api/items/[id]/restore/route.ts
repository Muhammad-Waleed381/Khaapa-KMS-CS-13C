import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { logActivity, requireUser, route } from "@/lib/server/api";
import { getItemOr404 } from "../../shared";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const db = await getDb();
  const item = await getItemOr404(db, id);
  await db.update(t.items).set({ active: true, updatedAt: new Date() }).where(eq(t.items.id, id));
  await logActivity(db, user.id, "item", `Restored ${item.name}`, id);
  return { ok: true };
});
