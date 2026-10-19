import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { t, type DB, type Tx } from "@/db";
import { HttpError } from "./api";

// FIFO stock engine. Invariants, per item:
//   stock on hand        = SUM(stock_moves.qty)
//   SUM(lots.qty_left)   = stock + owed  (owed > 0 only while stock < 0)
//   items.owed           = units sold while the shelf was empty, not yet costed
// Every unit that leaves takes the cost of the oldest lot still holding stock.

type Alloc = { lotId: string; qty: number; unitCost: number };

/** Take `qty` units from the oldest lots. `short` is how many could not be covered. */
async function takeUnits(tx: Tx, itemId: string, qty: number) {
  const open = await tx
    .select()
    .from(t.lots)
    .where(and(eq(t.lots.itemId, itemId), gt(t.lots.qtyLeft, 0)))
    .orderBy(asc(t.lots.createdAt), asc(t.lots.id))
    .for("update");
  let need = qty;
  let cost = 0;
  const allocations: Alloc[] = [];
  for (const lot of open) {
    if (need <= 0) break;
    const take = Math.min(need, lot.qtyLeft);
    await tx
      .update(t.lots)
      .set({ qtyLeft: lot.qtyLeft - take })
      .where(eq(t.lots.id, lot.id));
    allocations.push({ lotId: lot.id, qty: take, unitCost: lot.unitCost });
    cost += take * lot.unitCost;
    need -= take;
  }
  return { cost, allocations, short: need };
}

/** Put units on the shelf at `unitCost`, paying off any oversold units first. */
async function putUnits(
  tx: Tx,
  itemId: string,
  qty: number,
  unitCost: number,
  userId: string | null,
  supplier?: string | null,
) {
  const [item] = await tx
    .select({ owed: t.items.owed })
    .from(t.items)
    .where(eq(t.items.id, itemId))
    .for("update");
  if (!item) throw new HttpError(404, "Item not found");
  const settle = Math.min(item.owed, qty);
  if (settle > 0) {
    await tx
      .update(t.items)
      .set({ owed: item.owed - settle })
      .where(eq(t.items.id, itemId));
    await tx.insert(t.stockMoves).values({
      itemId,
      kind: "settle",
      qty: 0,
      cost: settle * unitCost,
      unitCost,
      userId,
      note: `Cost of ${settle} unit${settle > 1 ? "s" : ""} sold while out of stock`,
    });
  }
  await tx.insert(t.lots).values({ itemId, qtyIn: qty, qtyLeft: qty - settle, unitCost, supplier });
}

async function lastUnitCost(tx: Tx, itemId: string) {
  const [lot] = await tx
    .select({ unitCost: t.lots.unitCost })
    .from(t.lots)
    .where(eq(t.lots.itemId, itemId))
    .orderBy(desc(t.lots.createdAt))
    .limit(1);
  return lot?.unitCost ?? 0;
}

export async function stockOf(db: DB | Tx, itemId: string) {
  const [row] = await db
    .select({ qty: sql<number>`coalesce(sum(${t.stockMoves.qty}), 0)::int` })
    .from(t.stockMoves)
    .where(eq(t.stockMoves.itemId, itemId));
  return row.qty;
}

/** itemId -> units on hand (negative when oversold). */
export async function stockLevels(db: DB | Tx) {
  const rows = await db
    .select({ itemId: t.stockMoves.itemId, qty: sql<number>`sum(${t.stockMoves.qty})::int` })
    .from(t.stockMoves)
    .groupBy(t.stockMoves.itemId);
  return new Map(rows.map((r) => [r.itemId, r.qty]));
}

export async function restock(
  tx: Tx,
  a: { itemId: string; qty: number; unitCost: number; supplier?: string | null; note?: string | null; userId: string },
) {
  if (a.qty <= 0) throw new HttpError(400, "Quantity must be positive");
  await tx.insert(t.stockMoves).values({
    itemId: a.itemId,
    kind: "restock",
    qty: a.qty,
    unitCost: a.unitCost,
    supplier: a.supplier,
    note: a.note,
    userId: a.userId,
  });
  await putUnits(tx, a.itemId, a.qty, a.unitCost, a.userId, a.supplier);
}

/** Waste, expiry or damage. Valued at FIFO cost. */
export async function writeOff(tx: Tx, a: { itemId: string; qty: number; note?: string | null; userId: string }) {
  if (a.qty <= 0) throw new HttpError(400, "Quantity must be positive");
  const onHand = await stockOf(tx, a.itemId);
  if (a.qty > onHand) throw new HttpError(400, `Only ${Math.max(onHand, 0)} on the shelf`);
  const { cost, allocations } = await takeUnits(tx, a.itemId, a.qty);
  await tx.insert(t.stockMoves).values({
    itemId: a.itemId,
    kind: "waste",
    qty: -a.qty,
    cost,
    allocations,
    note: a.note,
    userId: a.userId,
  });
}

/** Set stock to an actual shelf count; the difference is logged as a correction. */
export async function countCorrection(
  tx: Tx,
  a: { itemId: string; counted: number; note?: string | null; userId: string },
) {
  if (a.counted < 0) throw new HttpError(400, "Count can't be negative");
  const onHand = await stockOf(tx, a.itemId);
  const delta = a.counted - onHand;
  if (delta === 0) return 0;
  if (delta < 0) {
    const { cost, allocations } = await takeUnits(tx, a.itemId, -delta);
    await tx.insert(t.stockMoves).values({
      itemId: a.itemId,
      kind: "correction",
      qty: delta,
      cost,
      allocations,
      note: a.note,
      userId: a.userId,
    });
  } else {
    const unitCost = await lastUnitCost(tx, a.itemId);
    await tx.insert(t.stockMoves).values({
      itemId: a.itemId,
      kind: "correction",
      qty: delta,
      unitCost,
      note: a.note,
      userId: a.userId,
    });
    await putUnits(tx, a.itemId, delta, unitCost, a.userId);
  }
  return delta;
}

export type SaleInput = {
  id: string;
  userId: string;
  shiftId?: string | null;
  method: "cash" | "online";
  cashReceived?: number | null;
  createdAt: Date;
  preorderId?: string | null;
  // Price and name come from the device: it is what the customer was charged,
  // even if the menu price changed while the device was offline.
  lines: { itemId: string; name: string; qty: number; unitPrice: number }[];
};

/**
 * Record a sale. Idempotent on `id`, so an offline device can resend safely.
 * Selling more than is on the shelf is allowed and tracked as oversold.
 */
export async function recordSale(tx: Tx, s: SaleInput) {
  const [existing] = await tx.select({ id: t.sales.id }).from(t.sales).where(eq(t.sales.id, s.id));
  if (existing) return { duplicate: true };
  if (!s.lines.length) throw new HttpError(400, "Sale has no items");

  const total = s.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  // Insert the sale first: sale_lines reference it.
  await tx.insert(t.sales).values({
    id: s.id,
    userId: s.userId,
    shiftId: s.shiftId,
    method: s.method,
    total,
    cashReceived: s.method === "cash" ? (s.cashReceived ?? total) : null,
    change: s.method === "cash" ? (s.cashReceived ?? total) - total : null,
    preorderId: s.preorderId,
    createdAt: s.createdAt,
  });

  let saleCost = 0;
  let anyOversold = false;
  for (const line of s.lines) {
    const { cost, allocations, short } = await takeUnits(tx, line.itemId, line.qty);
    if (short > 0) {
      anyOversold = true;
      await tx
        .update(t.items)
        .set({ owed: sql`${t.items.owed} + ${short}` })
        .where(eq(t.items.id, line.itemId));
    }
    saleCost += cost;
    await tx.insert(t.stockMoves).values({
      itemId: line.itemId,
      kind: "sale",
      qty: -line.qty,
      cost,
      allocations,
      oversold: short,
      saleId: s.id,
      userId: s.userId,
      createdAt: s.createdAt,
    });
    await tx.insert(t.saleLines).values({
      saleId: s.id,
      itemId: line.itemId,
      name: line.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
      cost,
      oversold: short,
    });
  }
  await tx.update(t.sales).set({ cost: saleCost, oversold: anyOversold }).where(eq(t.sales.id, s.id));
  return { duplicate: false, total };
}

/** Undo a sale: units go back into the lots they came from and its cost is reversed. */
export async function voidSale(tx: Tx, a: { saleId: string; userId: string; reason: string }) {
  const [sale] = await tx.select().from(t.sales).where(eq(t.sales.id, a.saleId)).for("update");
  if (!sale) throw new HttpError(404, "Sale not found");
  if (sale.voided) throw new HttpError(400, "Sale is already voided");

  const moves = await tx
    .select()
    .from(t.stockMoves)
    .where(and(eq(t.stockMoves.saleId, a.saleId), eq(t.stockMoves.kind, "sale")));
  const lotIds = moves.flatMap((m) => (m.allocations ?? []).map((x) => x.lotId));
  const lotRows = lotIds.length
    ? await tx.select().from(t.lots).where(inArray(t.lots.id, lotIds)).for("update")
    : [];
  const left = new Map(lotRows.map((l) => [l.id, l.qtyLeft]));

  for (const m of moves) {
    for (const x of m.allocations ?? []) {
      const q = (left.get(x.lotId) ?? 0) + x.qty;
      left.set(x.lotId, q);
      await tx.update(t.lots).set({ qtyLeft: q }).where(eq(t.lots.id, x.lotId));
    }
    if (m.oversold > 0) {
      // Still-owed units simply stop being owed. Units already paid off by a
      // later restock come back onto the shelf at that restock's cost.
      const [item] = await tx
        .select({ owed: t.items.owed })
        .from(t.items)
        .where(eq(t.items.id, m.itemId))
        .for("update");
      const unOwe = Math.min(item.owed, m.oversold);
      if (unOwe) await tx.update(t.items).set({ owed: item.owed - unOwe }).where(eq(t.items.id, m.itemId));
      const back = m.oversold - unOwe;
      if (back > 0) {
        const unitCost = await lastUnitCost(tx, m.itemId);
        await tx.insert(t.lots).values({ itemId: m.itemId, qtyIn: back, qtyLeft: back, unitCost });
      }
    }
    await tx.insert(t.stockMoves).values({
      itemId: m.itemId,
      kind: "void",
      qty: -m.qty,
      cost: -m.cost,
      saleId: a.saleId,
      userId: a.userId,
      note: a.reason,
    });
  }
  await tx
    .update(t.sales)
    .set({ voided: true, voidReason: a.reason, voidedBy: a.userId, voidedAt: new Date() })
    .where(eq(t.sales.id, a.saleId));
  return sale;
}
