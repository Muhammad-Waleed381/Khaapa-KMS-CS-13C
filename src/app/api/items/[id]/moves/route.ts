import { and, asc, desc, eq, gt, max, min, sql } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { getItemOr404 } from "../../shared";

// Recent stock history, the FIFO batches still on the shelf (oldest first),
// every batch ever bought (newest first) and the prices it has sold at.
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

  const batches = await db
    .select({
      id: t.lots.id,
      qtyIn: t.lots.qtyIn,
      qtyLeft: t.lots.qtyLeft,
      unitCost: t.lots.unitCost,
      supplier: t.lots.supplier,
      createdAt: t.lots.createdAt,
    })
    .from(t.lots)
    .where(eq(t.lots.itemId, id))
    .orderBy(desc(t.lots.createdAt), desc(t.lots.id))
    .limit(50);

  const prices = await db
    .select({
      unitPrice: t.saleLines.unitPrice,
      first: min(t.sales.createdAt),
      last: max(t.sales.createdAt),
      qty: sql<number>`sum(${t.saleLines.qty})::int`,
    })
    .from(t.saleLines)
    .innerJoin(t.sales, eq(t.sales.id, t.saleLines.saleId))
    .where(and(eq(t.saleLines.itemId, id), eq(t.sales.voided, false)))
    .groupBy(t.saleLines.unitPrice)
    .orderBy(desc(max(t.sales.createdAt)));

  return { moves, lots, batches, prices };
});
