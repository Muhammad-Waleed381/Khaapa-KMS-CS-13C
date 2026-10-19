import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, route } from "@/lib/server/api";

const MAX_PROOF_CHARS = 410_000; // ~300 KB of JPEG as base64

const Body = z.object({
  code: z.string().trim().toUpperCase(),
  proof: z.string().startsWith("data:image/", "attach a screenshot of the payment").max(MAX_PROOF_CHARS, "screenshot is too large"),
  // Older clients still send a transaction reference; it's optional now.
  paymentRef: z.string().trim().max(80).optional(),
});

// The customer attaches a screenshot of their advance payment. Staff check it
// on /orders.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const b = await parseBody(req, Body);
  const db = await getDb();
  const [order] = await db.select().from(t.preorders).where(eq(t.preorders.id, id));
  if (!order || order.code !== b.code) throw new HttpError(404, "Order not found");
  if (order.status !== "awaiting_payment") throw new HttpError(400, "This order's payment is already handled");
  await db
    .update(t.preorders)
    .set({ proof: b.proof, paymentRef: b.paymentRef || order.paymentRef })
    .where(eq(t.preorders.id, id));
  await logActivity(db, null, "preorder", `Payment screenshot sent for pre-order ${order.code}`, id);
  return { ok: true };
});
