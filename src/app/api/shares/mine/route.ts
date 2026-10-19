import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { summary } from "@/lib/server/finance";
import { accountById, readShareSettings, remainingFor } from "../shared";

// The signed-in person's own shares: holdings, requests, an all-time profit
// estimate, and what they can still buy. Works for members (no admin APIs).
export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const settings = await readShareSettings(db);
  const [holdings, purchases, [all], money, account, remaining] = await Promise.all([
    db
      .select()
      .from(t.shareholders)
      .where(eq(t.shareholders.userId, user.id))
      .orderBy(asc(t.shareholders.boughtOn), asc(t.shareholders.createdAt)),
    db
      .select({
        id: t.sharePurchases.id,
        shares: t.sharePurchases.shares,
        pricePerShare: t.sharePurchases.pricePerShare,
        total: t.sharePurchases.total,
        paymentRef: t.sharePurchases.paymentRef,
        hasProof: sql<boolean>`${t.sharePurchases.proof} is not null`,
        status: t.sharePurchases.status,
        note: t.sharePurchases.note,
        decidedAt: t.sharePurchases.decidedAt,
        createdAt: t.sharePurchases.createdAt,
      })
      .from(t.sharePurchases)
      .where(eq(t.sharePurchases.userId, user.id))
      .orderBy(desc(t.sharePurchases.createdAt)),
    db.select({ shares: sql<number>`coalesce(sum(${t.shareholders.shares}), 0)::int` }).from(t.shareholders),
    summary(db),
    accountById(db, settings.accountId),
    remainingFor(db, settings, user.id),
  ]);

  // Profit is split equally per share, whatever each share cost.
  const profitPerShare = all.shares ? money.netProfit / all.shares : 0;
  const shares = holdings.reduce((s, h) => s + h.shares, 0);
  const invested = holdings.reduce((s, h) => s + h.shares * h.pricePerShare, 0);
  const estimatedProfit = Math.round(shares * profitPerShare);

  return {
    holdings: holdings.map((h) => ({
      id: h.id,
      shares: h.shares,
      pricePerShare: h.pricePerShare,
      boughtOn: h.boughtOn,
      fromRequest: !!h.purchaseId,
    })),
    totals: { shares, invested, estimatedProfit, payout: invested + estimatedProfit },
    totalShares: all.shares,
    profitPerShare: Math.round(profitPerShare),
    purchases,
    offer: {
      open: settings.open,
      pricePerShare: settings.pricePerShare,
      maxPerPerson: settings.maxPerPerson,
      remaining,
      account,
    },
  };
});
