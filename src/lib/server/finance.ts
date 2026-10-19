import { and, gte, inArray, lt, sql } from "drizzle-orm";
import { t, type DB } from "@/db";

export type Summary = {
  revenue: number;
  cash: number;
  online: number;
  salesCount: number;
  voidedCount: number;
  /** FIFO cost of goods sold (sales + oversold settlements − voids). */
  cogs: number;
  /** Waste, expiry and shrinkage found by counts. */
  writeOffs: number;
  /** Running costs from the costs ledger. */
  costs: number;
  grossProfit: number;
  netProfit: number;
};

/** Money summary over [from, to). Omit both for all time. */
export async function summary(db: DB, from?: Date, to?: Date): Promise<Summary> {
  const saleRange = [
    from ? gte(t.sales.createdAt, from) : undefined,
    to ? lt(t.sales.createdAt, to) : undefined,
  ];
  const moveRange = [
    from ? gte(t.stockMoves.createdAt, from) : undefined,
    to ? lt(t.stockMoves.createdAt, to) : undefined,
  ];
  const isoDate = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

  const [s] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${t.sales.total}) filter (where not ${t.sales.voided}), 0)::int`,
      cash: sql<number>`coalesce(sum(${t.sales.total}) filter (where not ${t.sales.voided} and ${t.sales.method} = 'cash'), 0)::int`,
      online: sql<number>`coalesce(sum(${t.sales.total}) filter (where not ${t.sales.voided} and ${t.sales.method} = 'online'), 0)::int`,
      salesCount: sql<number>`count(*) filter (where not ${t.sales.voided})::int`,
      voidedCount: sql<number>`count(*) filter (where ${t.sales.voided})::int`,
    })
    .from(t.sales)
    .where(and(...saleRange));

  const [m] = await db
    .select({
      cogs: sql<number>`coalesce(sum(${t.stockMoves.cost}) filter (where ${inArray(t.stockMoves.kind, ["sale", "settle", "void"])}), 0)::int`,
      writeOffs: sql<number>`coalesce(sum(${t.stockMoves.cost}) filter (where ${inArray(t.stockMoves.kind, ["waste", "correction"])}), 0)::int`,
    })
    .from(t.stockMoves)
    .where(and(...moveRange));

  const [c] = await db
    .select({ costs: sql<number>`coalesce(sum(${t.costs.amount}), 0)::int` })
    .from(t.costs)
    .where(
      and(
        from ? gte(t.costs.date, isoDate(from)) : undefined,
        to ? lt(t.costs.date, isoDate(to)) : undefined,
      ),
    );

  const grossProfit = s.revenue - m.cogs;
  return {
    ...s,
    ...m,
    costs: c.costs,
    grossProfit,
    netProfit: grossProfit - m.writeOffs - c.costs,
  };
}

/** Value of stock currently on the shelf at FIFO cost. */
export async function stockValue(db: DB) {
  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${t.lots.qtyLeft} * ${t.lots.unitCost}), 0)::int` })
    .from(t.lots)
    .where(sql`${t.lots.qtyLeft} > 0`);
  return row.value;
}

