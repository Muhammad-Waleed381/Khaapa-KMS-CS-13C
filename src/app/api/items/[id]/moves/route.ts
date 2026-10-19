import { and, asc, desc, eq, gt } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { getItemOr404 } from "../../shared";

// Recent stock history plus the FIFO batches still on the shelf (oldest first).
export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 20, 200);
  const db = await getDb();
  await getItemOr404(db, id);

  const moves = await db
    .select({
      id: t.stockMoves.id,
      kind: t.stockMoves.kind,
      qty: t.stockMoves.qty,
      cost: t.stockMoves.cost,
      unitCost: t.stockMoves.unitCost,
      oversold: t.stockMoves.oversold,
      supplier: t.stockMoves.supplier,
      note: t.stockMoves.note,
      saleId: t.stockMoves.saleId,
      createdAt: t.stockMoves.createdAt,
      userName: t.users.name,
    })
    .from(t.stockMoves)
    .leftJoin(t.users, eq(t.users.id, t.stockMoves.userId))
    .where(eq(t.stockMoves.itemId, id))
    .orderBy(desc(t.stockMoves.createdAt))
    .limit(limit);

  const lots = await db
    .select({
      id: t.lots.id,
      qtyIn: t.lots.qtyIn,
      qtyLeft: t.lots.qtyLeft,
      unitCost: t.lots.unitCost,
      supplier: t.lots.supplier,
      createdAt: t.lots.createdAt,
    })
    .from(t.lots)
    .where(and(eq(t.lots.itemId, id), gt(t.lots.qtyLeft, 0)))
    .orderBy(asc(t.lots.createdAt), asc(t.lots.id));

  return { moves, lots };
});
