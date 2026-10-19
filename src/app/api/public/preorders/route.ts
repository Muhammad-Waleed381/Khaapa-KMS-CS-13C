import { desc, inArray } from "drizzle-orm";
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
    })
    .from(t.preorders)
    .where(inArray(t.preorders.code, codes))
    .orderBy(desc(t.preorders.createdAt));
  return { orders: rows };
});
