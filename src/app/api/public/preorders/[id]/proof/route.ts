import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, route } from "@/lib/server/api";

const MAX_PROOF_CHARS = 410_000; // ~300 KB of JPEG as base64

const Body = z.object({
  code: z.string().trim().toUpperCase(),
  paymentRef: z.string().trim().min(3).max(80),
  proof: z
    .string()
    .startsWith("data:image/")
    .max(MAX_PROOF_CHARS, "screenshot is too large")
    .optional(),
});

// The customer sends their NayaPay transaction reference (and optionally a
// screenshot) for the advance payment. Staff verify it on /orders.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const b = await parseBody(req, Body);
  const db = await getDb();
  const [order] = await db.select().from(t.preorders).where(eq(t.preorders.id, id));
  if (!order || order.code !== b.code) throw new HttpError(404, "Order not found");
  if (order.status !== "awaiting_payment") throw new HttpError(400, "This order's payment is already handled");
  await db
    .update(t.preorders)
    .set({ paymentRef: b.paymentRef, proof: b.proof ?? order.proof })
    .where(eq(t.preorders.id, id));
  await logActivity(db, null, "preorder", `Payment proof sent for pre-order ${order.code} (ref ${b.paymentRef})`, id);
  return { ok: true };
});
