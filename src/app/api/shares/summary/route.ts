import { asc } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { stockValue, summary } from "@/lib/server/finance";
import { pkDayRange } from "@/lib/time";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

// Profit for a period (inclusive PKT dates, omit both for all time), split
// evenly across every share. Each shareholder gets their money back plus
// their shares' part of the profit.
export const GET = route(async (req) => {
  await requireUser({ admin: true });
  const q = new URL(req.url).searchParams;
  const fromQ = q.get("from");
  const toQ = q.get("to");
  const from = fromQ && dateRe.test(fromQ) ? pkDayRange(fromQ).start : undefined;
  const to = toQ && dateRe.test(toQ) ? pkDayRange(toQ).end : undefined;

  const db = await getDb();
  const [money, onShelf, holders] = await Promise.all([
    summary(db, from, to),
    stockValue(db),
    db.select().from(t.shareholders).orderBy(asc(t.shareholders.boughtOn), asc(t.shareholders.createdAt)),
  ]);

  const totalShares = holders.reduce((s, h) => s + h.shares, 0);
  const totalInvestment = holders.reduce((s, h) => s + h.shares * h.pricePerShare, 0);
  // Fractional paisa per share is fine here; each payout is rounded once.
  const profitPerShare = totalShares ? money.netProfit / totalShares : 0;

  const shareholders = holders.map((h) => {
    const invested = h.shares * h.pricePerShare;
    const profitShare = Math.round(h.shares * profitPerShare);
    return {
      id: h.id,
      name: h.name,
      contact: h.contact,
      shares: h.shares,
      pricePerShare: h.pricePerShare,
      boughtOn: h.boughtOn,
      note: h.note,
      ownership: totalShares ? h.shares / totalShares : 0,
      invested,
      profitShare,
      payout: invested + profitShare,
      returnPct: invested ? profitShare / invested : null,
    };
  });

  return {
    period: { from: fromQ ?? null, to: toQ ?? null },
    summary: money,
    stockValue: onShelf,
    totalShares,
    totalInvestment,
    profitPerShare: Math.round(profitPerShare),
    netWorth: {
      investment: totalInvestment,
      sales: money.revenue,
      costOfStockSold: money.cogs,
      stockWrittenOff: money.writeOffs,
      costs: money.costs,
      netProfit: money.netProfit,
      total: totalInvestment + money.netProfit,
      collected: { cash: money.cash, online: money.online },
      stockOnShelf: onShelf,
    },
    shareholders,
  };
});
