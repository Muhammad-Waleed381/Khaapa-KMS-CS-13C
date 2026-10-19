import { desc, eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, t } from "@/db";
import { route } from "@/lib/server/api";

// Status lookup for the customer's own orders: GET ?codes=ABC123,XYZ789
export const GET = route(async (req) => {
  await connection();
  const codes = (new URL(req.url).searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{6}$/.test(c))
    .slice(0, 20);
  if (!codes.length) return { orders: [] };
  const db = await getDb();
  const rows = await db
    .select({
      id: t.preorders.id,
      code: t.preorders.code,
      customerName: t.preorders.customerName,
      pickupDate: t.preorders.pickupDate,
      lines: t.preorders.lines,
      total: t.preorders.total,
      status: t.preorders.status,
      paymentRef: t.preorders.paymentRef,
      createdAt: t.preorders.createdAt,
      accountId: t.paymentAccounts.id,
      accountLabel: t.paymentAccounts.label,
      provider: t.paymentAccounts.provider,
      accountTitle: t.paymentAccounts.accountTitle,
      accountNumber: t.paymentAccounts.accountNumber,
    })
    .from(t.preorders)
    .leftJoin(t.paymentAccounts, eq(t.paymentAccounts.id, t.preorders.accountId))
    .where(inArray(t.preorders.code, codes))
    .orderBy(desc(t.preorders.createdAt));
  // The account each order was asked to be paid into, as customers see it.
  return {
    orders: rows.map(({ accountId, accountLabel, provider, accountTitle, accountNumber, ...o }) => ({
      ...o,
      account: accountId
        ? { id: accountId, label: accountLabel!, provider: provider!, accountTitle: accountTitle!, accountNumber: accountNumber! }
        : null,
    })),
  };
});
