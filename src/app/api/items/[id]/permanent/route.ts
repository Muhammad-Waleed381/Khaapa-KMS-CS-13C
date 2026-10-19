import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, requireUser, route } from "@/lib/server/api";
import { getItemOr404 } from "../../shared";

// Hard delete, only for items with no history at all (e.g. typos).
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  const db = await getDb();
  const item = await getItemOr404(db, id);
  const [move] = await db.select({ id: t.stockMoves.id }).from(t.stockMoves).where(eq(t.stockMoves.itemId, id)).limit(1);
  const [line] = await db.select({ id: t.saleLines.id }).from(t.saleLines).where(eq(t.saleLines.itemId, id)).limit(1);
  if (move || line) throw new HttpError(400, "This item has stock or sales history. Archive it instead.");
  await db.transaction(async (tx) => {
    await tx.delete(t.lots).where(eq(t.lots.itemId, id));
    await tx.delete(t.items).where(eq(t.items.id, id));
  });
  await logActivity(db, user.id, "item", `Deleted ${item.name} permanently`, id);
  return { ok: true };
});
