import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, requireUser, route } from "@/lib/server/api";
import { pkDate } from "@/lib/time";

// Staff list of pre-orders for one pickup day: GET ?date=YYYY-MM-DD
// The proof screenshot is left out (fetch it from /api/preorders/[id]/proof).
export const GET = route(async (req) => {
  await requireUser();
  const date = new URL(req.url).searchParams.get("date") ?? pkDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Bad date");
  const db = await getDb();
  const orders = await db
    .select({
      id: t.preorders.id,
      code: t.preorders.code,
      customerName: t.preorders.customerName,
      phone: t.preorders.phone,
      note: t.preorders.note,
      pickupDate: t.preorders.pickupDate,
      lines: t.preorders.lines,
      total: t.preorders.total,
      status: t.preorders.status,
      paymentRef: t.preorders.paymentRef,
      hasProof: sql<boolean>`${isNotNull(t.preorders.proof)}`,
      saleId: t.preorders.saleId,
      createdAt: t.preorders.createdAt,
      // The account the customer was asked to pay into.
      account: sql<string | null>`case when ${t.paymentAccounts.id} is null then null else
        ${t.paymentAccounts.label} || ' (' || ${t.paymentAccounts.provider} || ' ••' || right(regexp_replace(${t.paymentAccounts.accountNumber}, '[[:space:]]', '', 'g'), 4) || ')' end`,
    })
    .from(t.preorders)
    .leftJoin(t.paymentAccounts, eq(t.paymentAccounts.id, t.preorders.accountId))
    .where(eq(t.preorders.pickupDate, date))
    .orderBy(asc(t.preorders.createdAt));
  return { orders };
});
