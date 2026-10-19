import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, requireUser, route } from "@/lib/server/api";

// The payment screenshot, for the person who sent it and for admins.
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Request not found");
  const db = await getDb();
  const [p] = await db
    .select({ userId: t.sharePurchases.userId, proof: t.sharePurchases.proof, paymentRef: t.sharePurchases.paymentRef })
    .from(t.sharePurchases)
    .where(eq(t.sharePurchases.id, id));
  if (!p || (p.userId !== user.id && user.role !== "admin")) throw new HttpError(404, "Request not found");
  return { proof: p.proof, paymentRef: p.paymentRef };
});
