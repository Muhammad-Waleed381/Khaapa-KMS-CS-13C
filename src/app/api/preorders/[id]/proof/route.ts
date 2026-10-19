import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, requireUser, route } from "@/lib/server/api";

// The customer's payment screenshot, for staff to check.
export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ proof: t.preorders.proof, paymentRef: t.preorders.paymentRef })
    .from(t.preorders)
    .where(eq(t.preorders.id, id));
  if (!row) throw new HttpError(404, "Order not found");
  return row;
});
