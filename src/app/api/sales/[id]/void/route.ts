import { z } from "zod";
import { getDb } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { voidSale } from "@/lib/server/stock";
import { rs } from "@/lib/money";

const Body = z.object({ reason: z.string().trim().min(2, "Give a reason").max(200) });

// Any active staff member can void; the activity log records who and why.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { reason } = await parseBody(req, Body);
  const db = await getDb();
  const sale = await db.transaction(async (tx) => {
    const s = await voidSale(tx, { saleId: id, userId: user.id, reason });
    await logActivity(tx, user.id, "sale.void", `Voided sale ${rs(s.total)} — ${reason}`, id);
    return s;
  });
  return { ok: true, id: sale.id };
});
