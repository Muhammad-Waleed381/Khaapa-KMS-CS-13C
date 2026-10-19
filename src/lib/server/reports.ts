import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { t, type DB } from "@/db";
import { slotForShift, slotInstant } from "@/lib/duty";
import { addDays, pkDate, pkDayRange } from "@/lib/time";
import { stockValue, summary } from "./finance";
import { stockLevels } from "./stock";

// PKT calendar day / hour of a timestamp column, for grouping in SQL.
const pkDay = (col: unknown) => sql<string>`to_char((${col} at time zone 'UTC') + interval '5 hours', 'YYYY-MM-DD')`;
const pkHour = (col: unknown) => sql<number>`extract(hour from (${col} at time zone 'UTC') + interval '5 hours')::int`;

export type SaleRow = Awaited<ReturnType<typeof salesForDay>>["sales"][number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** An inclusive range of PKT calendar days. */
export type Period = { from: string; to: string };

/**
 * ?from=&to= (or ?date= for one day) as a PKT period. Missing dates default to
 * the last `defaultDays` days up to today; the span is capped at about a year.
 */
export function periodFromQuery(q: URLSearchParams, defaultDays = 1): Period {
  const today = pkDate();
  const date = q.get("date") ?? "";
  if (DATE.test(date)) return { from: date, to: date };
  let from = q.get("from") ?? "";
  let to = q.get("to") ?? "";
  if (!DATE.test(to)) to = today;
  if (!DATE.test(from)) from = addDays(to, -(defaultDays - 1));
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -400)) from = addDays(to, -400);
  return { from, to };
}

type SaleFilters = { method?: string | null; userId?: string | null; voided?: string | null };

const saleFilters = (f: SaleFilters) => [
  f.method === "cash" || f.method === "online" ? eq(t.sales.method, f.method) : undefined,
  f.userId ? eq(t.sales.userId, f.userId) : undefined,
  f.voided === "1" ? eq(t.sales.voided, true) : f.voided === "0" ? eq(t.sales.voided, false) : undefined,
];

/** Online money (not voided) per receiving account. accountId null = sales from before accounts were recorded. */
async function onlineByAccount(db: DB, start: Date, end: Date, f: SaleFilters = {}) {
  if (f.method === "cash" || f.voided === "1") return [];
  return db
    .select({
      accountId: t.sales.accountId,
      label: t.paymentAccounts.label,
      provider: t.paymentAccounts.provider,
      total: sql<number>`sum(${t.sales.total})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(t.sales)
    .leftJoin(t.paymentAccounts, eq(t.paymentAccounts.id, t.sales.accountId))
    .where(
      and(
        gte(t.sales.createdAt, start),
        lt(t.sales.createdAt, end),
        eq(t.sales.method, "online"),
        eq(t.sales.voided, false),
        f.userId ? eq(t.sales.userId, f.userId) : undefined,
      ),
    )
    .groupBy(t.sales.accountId, t.paymentAccounts.label, t.paymentAccounts.provider)
    .orderBy(desc(sql`4`));
}

/**
 * Sales over a period: totals, per-day subtotals and online money per account.
 * The individual sales (with lines) come back only for a single day; for longer
 * periods the page loads a day's sales when it is opened.
 */
export async function salesForPeriod(db: DB, p: Period, f: SaleFilters) {
  const start = pkDayRange(p.from).start;
  const end = pkDayRange(p.to).end;
  const where = and(gte(t.sales.createdAt, start), lt(t.sales.createdAt, end), ...saleFilters(f));

  const days = await db
    .select({
      date: pkDay(t.sales.createdAt),
      total: sql<number>`coalesce(sum(${t.sales.total}) filter (where not ${t.sales.voided}), 0)::int`,
      cash: sql<number>`coalesce(sum(${t.sales.total}) filter (where not ${t.sales.voided} and ${t.sales.method} = 'cash'), 0)::int`,
      online: sql<number>`coalesce(sum(${t.sales.total}) filter (where not ${t.sales.voided} and ${t.sales.method} = 'online'), 0)::int`,
      count: sql<number>`count(*) filter (where not ${t.sales.voided})::int`,
      voids: sql<number>`count(*) filter (where ${t.sales.voided})::int`,
    })
    .from(t.sales)
    .where(where)
    .groupBy(sql`1`)
    .orderBy(desc(sql`1`));

  const totals = days.reduce(
    (a, d) => ({
      total: a.total + d.total,
      cash: a.cash + d.cash,
      online: a.online + d.online,
      count: a.count + d.count,
      voids: a.voids + d.voids,
    }),
    { total: 0, cash: 0, online: 0, count: 0, voids: 0 },
  );

  // Everyone who sold in the period, for the cashier filter.
  const cashiers = await db
    .selectDistinct({ id: t.sales.userId, name: t.users.name })
    .from(t.sales)
    .innerJoin(t.users, eq(t.users.id, t.sales.userId))
    .where(and(gte(t.sales.createdAt, start), lt(t.sales.createdAt, end)))
    .orderBy(asc(t.users.name));

  const single = p.from === p.to;
  return {
    ...p,
    totals,
    accounts: await onlineByAccount(db, start, end, f),
    days,
    cashiers,
    sales: single ? (await salesForDay(db, p.from, f)).sales : null,
  };
}

export async function salesForDay(
  db: DB,
  date: string,
  f: SaleFilters,
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
      accountId: t.sales.accountId,
      account: t.paymentAccounts.label,
      accountProvider: t.paymentAccounts.provider,
    })
    .from(t.sales)
    .innerJoin(t.users, eq(t.users.id, t.sales.userId))
    .leftJoin(voider, eq(voider.id, t.sales.voidedBy))
    .leftJoin(t.paymentAccounts, eq(t.paymentAccounts.id, t.sales.accountId))
    .where(and(gte(t.sales.createdAt, start), lt(t.sales.createdAt, end), ...saleFilters(f)))
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
    .select({
      day: pkDay(t.sales.createdAt),
      revenue: sql<number>`sum(${t.sales.total})::int`,
      cash: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'cash'), 0)::int`,
      online: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'online'), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
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
  const byDay = new Map(revenueByDay.map((r) => [r.day, r]));
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
    const d = byDay.get(day);
    return { day, revenue: r, profit: r - (cost.get(day) ?? 0), cash: d?.cash ?? 0, online: d?.online ?? 0, count: d?.count ?? 0 };
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

  const accounts = await onlineByAccount(db, from ?? new Date(0), to ?? new Date("2100-01-01T00:00:00Z"));

  return { range, summary: sum, stockValue: value, daily, hourly, topItems, byCashier, lowStock, accounts };
}

/** Sales, profit, cash and online per PKT day for the last `n` days (today last), for sparklines. */
export async function recentDays(db: DB, n = 7) {
  const today = pkDate();
  const first = addDays(today, -(n - 1));
  const from = pkDayRange(first).start;
  const to = pkDayRange(today).end;
  const sales = await db
    .select({
      day: pkDay(t.sales.createdAt),
      revenue: sql<number>`sum(${t.sales.total})::int`,
      cash: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'cash'), 0)::int`,
      online: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'online'), 0)::int`,
    })
    .from(t.sales)
    .where(and(eq(t.sales.voided, false), gte(t.sales.createdAt, from), lt(t.sales.createdAt, to)))
    .groupBy(sql`1`);
  const costs = await db
    .select({ day: pkDay(t.stockMoves.createdAt), cost: sql<number>`sum(${t.stockMoves.cost})::int` })
    .from(t.stockMoves)
    .where(
      and(inArray(t.stockMoves.kind, ["sale", "settle", "void"]), gte(t.stockMoves.createdAt, from), lt(t.stockMoves.createdAt, to)),
    )
    .groupBy(sql`1`);
  const s = new Map(sales.map((r) => [r.day, r]));
  const c = new Map(costs.map((r) => [r.day, r.cost]));
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(first, i);
    const r = s.get(day);
    return { day, revenue: r?.revenue ?? 0, cash: r?.cash ?? 0, online: r?.online ?? 0, profit: (r?.revenue ?? 0) - (c.get(day) ?? 0) };
  });
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
    onlineByAccount: await onlineByAccount(db, start, end),
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

/**
 * Today so far, against yesterday and the same weekday last week up to the
 * same time of day, so the comparison is fair before closing.
 */
export async function todaySoFar(db: DB) {
  const now = new Date();
  const today = pkDate(now);
  const elapsed = now.getTime() - pkDayRange(today).start.getTime();
  const upTo = async (date: string) => {
    const start = pkDayRange(date).start;
    const s = await summary(db, start, new Date(start.getTime() + elapsed));
    return { revenue: s.revenue, cash: s.cash, online: s.online, salesCount: s.salesCount, grossProfit: s.grossProfit };
  };
  const [now_, yesterday, lastWeek] = await Promise.all([upTo(today), upTo(addDays(today, -1)), upTo(addDays(today, -7))]);
  return { date: today, asOf: now.toISOString(), today: now_, yesterday, lastWeek };
}

/**
 * Counter shifts in a period, each set against the duty slot it belongs to
 * (planned vs actual), with the money taken during it. Also slots that ended
 * with nobody starting a shift, and per-person totals for HR.
 */
export async function shiftsForPeriod(db: DB, p: Period) {
  const start = pkDayRange(p.from).start;
  const end = pkDayRange(p.to).end;
  const rows = await db
    .select({
      id: t.shifts.id,
      userId: t.shifts.userId,
      name: t.users.name,
      startedAt: t.shifts.startedAt,
      endedAt: t.shifts.endedAt,
    })
    .from(t.shifts)
    .innerJoin(t.users, eq(t.users.id, t.shifts.userId))
    .where(and(gte(t.shifts.startedAt, start), lt(t.shifts.startedAt, end)))
    .orderBy(desc(t.shifts.startedAt));

  const slots = await db
    .select({ userId: t.slots.userId, name: t.users.name, date: t.slots.date, start: t.slots.start, end: t.slots.end })
    .from(t.slots)
    .innerJoin(t.users, eq(t.users.id, t.slots.userId))
    .where(and(gte(t.slots.date, p.from), lte(t.slots.date, p.to)))
    .orderBy(asc(t.slots.date), asc(t.slots.start));

  const money = rows.length
    ? await db
        .select({
          shiftId: t.sales.shiftId,
          sales: sql<number>`count(*)::int`,
          cash: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'cash'), 0)::int`,
          online: sql<number>`coalesce(sum(${t.sales.total}) filter (where ${t.sales.method} = 'online'), 0)::int`,
        })
        .from(t.sales)
        .where(and(inArray(t.sales.shiftId, rows.map((r) => r.id)), eq(t.sales.voided, false)))
        .groupBy(t.sales.shiftId)
    : [];
  const byShift = new Map(money.map((m) => [m.shiftId, m]));

  const now = Date.now();
  const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);
  const covered = new Set<string>();
  const shifts = rows.map((s) => {
    const slot = slotForShift(s, slots);
    if (slot) covered.add(`${slot.userId}|${slot.date}|${slot.start}`);
    const m = byShift.get(s.id);
    return {
      ...s,
      date: pkDate(s.startedAt),
      minutes: minutesBetween(s.startedAt, s.endedAt ?? new Date(now)),
      planned: slot ? { start: slot.start, end: slot.end } : null,
      // Positive = started after the slot began.
      lateBy: slot ? minutesBetween(slotInstant(slot.date, slot.start), s.startedAt) : null,
      // Positive = ended before the slot was over.
      leftEarlyBy: slot && s.endedAt ? minutesBetween(s.endedAt, slotInstant(slot.date, slot.end)) : null,
      sales: m?.sales ?? 0,
      cash: m?.cash ?? 0,
      online: m?.online ?? 0,
    };
  });

  const missed = slots
    .filter((sl) => slotInstant(sl.date, sl.end).getTime() < now && !covered.has(`${sl.userId}|${sl.date}|${sl.start}`))
    .map((sl) => ({ userId: sl.userId, name: sl.name, date: sl.date, start: sl.start, end: sl.end }));

  const people = new Map<
    string,
    { userId: string; name: string; shifts: number; minutes: number; sales: number; cash: number; online: number; late: number; missed: number }
  >();
  const person = (userId: string, name: string) => {
    let row = people.get(userId);
    if (!row) people.set(userId, (row = { userId, name, shifts: 0, minutes: 0, sales: 0, cash: 0, online: 0, late: 0, missed: 0 }));
    return row;
  };
  for (const s of shifts) {
    const row = person(s.userId, s.name);
    row.shifts++;
    row.minutes += s.minutes;
    row.sales += s.sales;
    row.cash += s.cash;
    row.online += s.online;
    if ((s.lateBy ?? 0) > LATE_GRACE) row.late++;
  }
  for (const m of missed) person(m.userId, m.name).missed++;

  return {
    ...p,
    shifts,
    missed,
    people: [...people.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

/** Minutes after the slot start before a shift counts as late. */
export const LATE_GRACE = 5;

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
