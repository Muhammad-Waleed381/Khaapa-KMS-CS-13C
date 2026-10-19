import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, requireUser, route } from "@/lib/server/api";

// The requester withdraws a request that hasn't been decided yet.
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Request not found");
  const db = await getDb();
  const [p] = await db
    .update(t.sharePurchases)
    .set({ status: "cancelled", decidedAt: new Date(), decidedBy: user.id })
    .where(and(eq(t.sharePurchases.id, id), eq(t.sharePurchases.userId, user.id), eq(t.sharePurchases.status, "pending")))
    .returning();
  if (!p) throw new HttpError(400, "Only your own pending requests can be cancelled");
  await logActivity(db, user.id, "shares", `${user.name} cancelled a request for ${p.shares} share${p.shares > 1 ? "s" : ""}`, p.id);
  return { ok: true };
});
