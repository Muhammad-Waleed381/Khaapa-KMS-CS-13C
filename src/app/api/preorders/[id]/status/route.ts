import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import type { PreorderStatus } from "@/db/schema";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { recordSale } from "@/lib/server/stock";

const Body = z.object({ status: z.enum(["paid", "ready", "collected", "cancelled"]) });

// Which statuses each move is allowed from.
const FROM: Record<z.infer<typeof Body>["status"], PreorderStatus[]> = {
  paid: ["awaiting_payment"],
  ready: ["paid"],
  collected: ["paid", "ready"],
  cancelled: ["awaiting_payment", "paid", "ready"],
};

const LABEL: Record<PreorderStatus, string> = {
  awaiting_payment: "awaiting payment",
  paid: "paid",
  ready: "ready",
  collected: "collected",
  cancelled: "cancelled",
};

const VERB = { paid: "verified payment for", ready: "marked ready", collected: "handed over", cancelled: "cancelled" };

// Staff move a pre-order along. Collecting it records the sale (paid online
// in advance), which is when stock leaves the shelf.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { status } = await parseBody(req, Body);
  const db = await getDb();

  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(t.preorders).where(eq(t.preorders.id, id)).for("update");
    if (!order) throw new HttpError(404, "Order not found");
    if (!FROM[status].includes(order.status))
      throw new HttpError(400, `This order is ${LABEL[order.status]}, so it can't be marked ${LABEL[status]}`);

    let saleId: string | null = order.saleId;
    if (status === "collected") {
      saleId = crypto.randomUUID();
      const [shift] = await tx
        .select({ id: t.shifts.id })
        .from(t.shifts)
        .where(and(eq(t.shifts.userId, user.id), isNull(t.shifts.endedAt)));
      await recordSale(tx, {
        id: saleId,
        userId: user.id,
        shiftId: shift?.id ?? null,
        method: "online",
        createdAt: new Date(),
        preorderId: order.id,
        lines: order.lines,
      });
    }
    await tx
      .update(t.preorders)
      .set({ status, saleId, updatedBy: user.id })
      .where(eq(t.preorders.id, id));
    await logActivity(tx, user.id, "preorder", `${user.name} ${VERB[status]} pre-order ${order.code}`, id);
    return { ok: true, status, saleId };
  });
});
