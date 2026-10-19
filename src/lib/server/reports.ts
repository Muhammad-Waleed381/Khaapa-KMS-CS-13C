import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { t, type DB } from "@/db";
import { addDays, pkDate, pkDayRange } from "@/lib/time";
import { stockValue, summary } from "./finance";
import { stockLevels } from "./stock";

// PKT calendar day / hour of a timestamp column, for grouping in SQL.
const pkDay = (col: unknown) => sql<string>`to_char((${col} at time zone 'UTC') + interval '5 hours', 'YYYY-MM-DD')`;
const pkHour = (col: unknown) => sql<number>`extract(hour from (${col} at time zone 'UTC') + interval '5 hours')::int`;

export type SaleRow = Awaited<ReturnType<typeof salesForDay>>["sales"][number];

export async function salesForDay(
  db: DB,
  date: string,
  f: { method?: string | null; userId?: string | null; voided?: string | null },
) {
  const { start, end } = pkDayRange(date);
  const voider = alias(t.users, "voider");
  const rows = await db
    .select({
      id: t.sales.id,
      method: t.sales.method,
      total: t.sales.total,
      cost: t.sales.cost,
      cashReceived: t.sales.cashReceived,
      change: t.sales.change,
      oversold: t.sales.oversold,
      preorderId: t.sales.preorderId,
      voided: t.sales.voided,
      voidReason: t.sales.voidReason,
      voidedAt: t.sales.voidedAt,
      voidedBy: voider.name,
      createdAt: t.sales.createdAt,
      userId: t.sales.userId,
      cashier: t.users.name,
    })
    .from(t.sales)
    .innerJoin(t.users, eq(t.users.id, t.sales.userId))
    .leftJoin(voider, eq(voider.id, t.sales.voidedBy))
    .where(
      and(
        gte(t.sales.createdAt, start),
        lt(t.sales.createdAt, end),
        f.method === "cash" || f.method === "online" ? eq(t.sales.method, f.method) : undefined,
        f.userId ? eq(t.sales.userId, f.userId) : undefined,
        f.voided === "1" ? eq(t.sales.voided, true) : f.voided === "0" ? eq(t.sales.voided, false) : undefined,
      ),
    )
    .orderBy(desc(t.sales.createdAt));

  const lines = rows.length
    ? await db
        .select()
        .from(t.saleLines)
        .where(inArray(t.saleLines.saleId, rows.map((r) => r.id)))
    : [];
  const bySale = new Map<string, typeof lines>();
  for (const l of lines) bySale.set(l.saleId, [...(bySale.get(l.saleId) ?? []), l]);

  const sales = rows.map((r) => ({
    ...r,
    lines: (bySale.get(r.id) ?? []).map((l) => ({
      itemId: l.itemId,
      name: l.name,
      qty: l.qty,
      unitPrice: l.unitPrice,
      cost: l.cost,
      oversold: l.oversold,
    })),
  }));

  const live = sales.filter((s) => !s.voided);
  const totals = {
    total: live.reduce((a, s) => a + s.total, 0),
    cash: live.filter((s) => s.method === "cash").reduce((a, s) => a + s.total, 0),
    online: live.filter((s) => s.method === "online").reduce((a, s) => a + s.total, 0),
    count: live.length,
    voids: sales.length - live.length,
  };

  // Everyone who sold that day, for the cashier filter.
  const cashiers = [...new Map(rows.map((r) => [r.userId, { id: r.userId, name: r.cashier }])).values()];
  return { date, sales, totals, cashiers };
}

export const RANGES = ["today", "7d", "30d", "all"] as const;
export type Range = (typeof RANGES)[number];

function rangeBounds(range: Range): { from?: Date; to?: Date; days: string[] } {
  const today = pkDate();
  const n = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 0;
  if (!n) return { days: [] };
  const first = addDays(today, -(n - 1));
  return {
    from: pkDayRange(first).start,
    to: pkDayRange(today).end,
    days: Array.from({ length: n }, (_, i) => addDays(first, i)),
  };
}

export async function stats(db: DB, range: Range) {
  const { from, to, days: fixedDays } = rangeBounds(range);
  const saleWhere = and(
    eq(t.sales.voided, false),
    from ? gte(t.sales.createdAt, from) : undefined,
    to ? lt(t.sales.createdAt, to) : undefined,
  );

  const [sum, value] = await Promise.all([summary(db, from, to), stockValue(db)]);

  const revenueByDay = await db
    .select({ day: pkDay(t.sales.createdAt), revenue: sql<number>`sum(${t.sales.total})::int` })
    .from(t.sales)
    .where(saleWhere)
    .groupBy(sql`1`);
  // Profit per day = revenue − FIFO cost of everything that left that day.
  const costByDay = await db
    .select({ day: pkDay(t.stockMoves.createdAt), cost: sql<number>`sum(${t.stockMoves.cost})::int` })
    .from(t.stockMoves)
    .where(
      and(
        inArray(t.stockMoves.kind, ["sale", "settle", "void"]),
        from ? gte(t.stockMoves.createdAt, from) : undefined,
        to ? lt(t.stockMoves.createdAt, to) : undefined,
      ),
    )
    .groupBy(sql`1`);

  const rev = new Map(revenueByDay.map((r) => [r.day, r.revenue]));
  const cost = new Map(costByDay.map((r) => [r.day, r.cost]));
  let days = fixedDays;
  if (!days.length) {
    // All time: from the first sale to today, capped to the last 60 days for the chart.
    const seen = [...new Set([...rev.keys(), ...cost.keys()])].sort();
    if (seen.length) {
      const today = pkDate();
      let d = seen[0] < addDays(today, -59) ? addDays(today, -59) : seen[0];
      days = [];
      while (d <= today) {
        days.push(d);
        d = addDays(d, 1);
      }
    }
  }
  const daily = days.map((day) => {
    const r = rev.get(day) ?? 0;
    return { day, revenue: r, profit: r - (cost.get(day) ?? 0) };
  });

  const hourRows = await db
    .select({
      hour: pkHour(t.sales.createdAt),
      revenue: sql<number>`sum(${t.sales.total})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(t.sales)
    .where(saleWhere)
    .groupBy(sql`1`);
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const h = hourRows.find((r) => r.hour === hour);
    return { hour, revenue: h?.revenue ?? 0, count: h?.count ?? 0 };
  });

  const topItems = await db
    .select({
      itemId: t.saleLines.itemId,
      name: sql<string>`max(${t.saleLines.name})`,
      qty: sql<number>`sum(${t.saleLines.qty})::int`,
      revenue: sql<number>`sum(${t.saleLines.qty} * ${t.saleLines.unitPrice})::int`,
      cost: sql<number>`sum(${t.saleLines.cost})::int`,
    })
    .from(t.saleLines)
    .innerJoin(t.sales, eq(t.sales.id, t.saleLines.saleId))
    .where(saleWhere)
    .groupBy(t.saleLines.itemId)
    .orderBy(desc(sql`3`))
    .limit(15);

  const byCashier = await db
    .select({
      userId: t.sales.userId,
      name: t.users.name,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`sum(${t.sales.total})::int`,
      cash: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'cash'), 0)::int`,
      online: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'online'), 0)::int`,
    })
    .from(t.sales)
    .innerJoin(t.users, eq(t.users.id, t.sales.userId))
    .where(saleWhere)
    .groupBy(t.sales.userId, t.users.name)
    .orderBy(desc(sql`4`));

  const levels = await stockLevels(db);
  const active = await db
    .select({ id: t.items.id, name: t.items.name, lowStockAt: t.items.lowStockAt })
    .from(t.items)
    .where(eq(t.items.active, true))
    .orderBy(asc(t.items.name));
  const lowStock = active
    .map((i) => ({ ...i, stock: levels.get(i.id) ?? 0 }))
    .filter((i) => i.stock <= i.lowStockAt)
    .sort((a, b) => a.stock - b.stock);

  return { range, summary: sum, stockValue: value, daily, hourly, topItems, byCashier, lowStock };
}

export async function dayReport(db: DB, date: string) {
  const { start, end } = pkDayRange(date);
  const day = await salesForDay(db, date, {});
  const live = day.sales.filter((s) => !s.voided);

  const items = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
  for (const s of live)
    for (const l of s.lines) {
      const it = items.get(l.itemId) ?? { name: l.name, qty: 0, revenue: 0, cost: 0 };
      it.qty += l.qty;
      it.revenue += l.qty * l.unitPrice;
      it.cost += l.cost;
      items.set(l.itemId, it);
    }
  const itemsSold = [...items.entries()]
    .map(([itemId, v]) => ({ itemId, ...v, profit: v.revenue - v.cost }))
    .sort((a, b) => b.qty - a.qty);

  const oversold = live.flatMap((s) =>
    s.lines.filter((l) => l.oversold > 0).map((l) => ({ saleId: s.id, name: l.name, qty: l.oversold, at: s.createdAt })),
  );

  const moves = await db
    .select({
      kind: t.stockMoves.kind,
      qty: t.stockMoves.qty,
      cost: t.stockMoves.cost,
      unitCost: t.stockMoves.unitCost,
      note: t.stockMoves.note,
      supplier: t.stockMoves.supplier,
      name: t.items.name,
      by: t.users.name,
      createdAt: t.stockMoves.createdAt,
    })
    .from(t.stockMoves)
    .innerJoin(t.items, eq(t.items.id, t.stockMoves.itemId))
    .leftJoin(t.users, eq(t.users.id, t.stockMoves.userId))
    .where(
      and(
        inArray(t.stockMoves.kind, ["restock", "waste", "correction"]),
        gte(t.stockMoves.createdAt, start),
        lt(t.stockMoves.createdAt, end),
      ),
    )
    .orderBy(asc(t.stockMoves.createdAt));

  const restocks = moves
    .filter((m) => m.kind === "restock")
    .map((m) => ({ name: m.name, qty: m.qty, cost: m.qty * (m.unitCost ?? 0), supplier: m.supplier, by: m.by }));
  const writeOffs = moves
    .filter((m) => m.kind === "waste" || (m.kind === "correction" && m.qty < 0))
    .map((m) => ({ name: m.name, kind: m.kind, qty: -m.qty, cost: m.cost, note: m.note, by: m.by }));

  const shiftRows = await db
    .select({ name: t.users.name, startedAt: t.shifts.startedAt, endedAt: t.shifts.endedAt })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .where(
      and(lt(t.shifts.startedAt, end), or(isNull(t.shifts.endedAt), gte(t.shifts.endedAt, start))),
    )
    .orderBy(asc(t.shifts.startedAt));

  const preorderRows = await db
    .select({ code: t.preorders.code, customerName: t.preorders.customerName, total: t.preorders.total })
    .from(t.preorders)
    .innerJoin(t.sales, eq(t.sales.id, t.preorders.saleId))
    .where(and(eq(t.preorders.status, "collected"), gte(t.sales.createdAt, start), lt(t.sales.createdAt, end)));

  // Same FIFO cost as /stats: includes oversold units costed by today's restocks.
  const { cogs } = await summary(db, start, end);
  return {
    date,
    totals: { ...day.totals, cogs, grossProfit: day.totals.total - cogs },
    expectedCash: day.totals.cash,
    itemsSold,
    oversold,
    writeOffs,
    writeOffTotal: writeOffs.reduce((a, w) => a + w.cost, 0),
    restocks,
    restockTotal: restocks.reduce((a, r) => a + r.cost, 0),
    shifts: shiftRows,
    preorders: preorderRows,
  };
}

export async function activityPage(db: DB, o: { limit: number; before?: Date | null; kind?: string | null }) {
  const rows = await db
    .select({
      id: t.activity.id,
      kind: t.activity.kind,
      message: t.activity.message,
      ref: t.activity.ref,
      createdAt: t.activity.createdAt,
      userId: t.activity.userId,
      userName: t.users.name,
    })
    .from(t.activity)
    .leftJoin(t.users, eq(t.users.id, t.activity.userId))
    .where(
      and(
        o.before ? lt(t.activity.createdAt, o.before) : undefined,
        o.kind ? sql`${t.activity.kind} like ${o.kind + "%"}` : undefined,
      ),
    )
    .orderBy(desc(t.activity.createdAt))
    .limit(o.limit + 1);
  const more = rows.length > o.limit;
  const page = rows.slice(0, o.limit);
  return { rows: page, next: more ? page[page.length - 1].createdAt : null };
}
