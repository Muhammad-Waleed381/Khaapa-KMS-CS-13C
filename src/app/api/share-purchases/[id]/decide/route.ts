import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { pkDate } from "@/lib/time";

const body = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).nullish(),
});

// Admin approves (payment checked) or rejects a request. Approving adds the
// shares to the shareholders list at the price locked into the request.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireUser({ admin: true });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Request not found");
  const b = await parseBody(req, body);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(t.sharePurchases).where(eq(t.sharePurchases.id, id)).for("update");
    if (!p) throw new HttpError(404, "Request not found");
    if (p.status !== "pending") throw new HttpError(400, `This request is already ${p.status}`);
    const [buyer] = await tx.select().from(t.users).where(eq(t.users.id, p.userId));
    const now = new Date();
    await tx
      .update(t.sharePurchases)
      .set({ status: b.status, note: b.note ?? null, decidedBy: admin.id, decidedAt: now })
      .where(eq(t.sharePurchases.id, id));
    let shareholderId: string | null = null;
    if (b.status === "approved") {
      const [h] = await tx
        .insert(t.shareholders)
        .values({
          userId: p.userId,
          purchaseId: p.id,
          name: buyer.name,
          contact: buyer.email,
          shares: p.shares,
          pricePerShare: p.pricePerShare,
          boughtOn: pkDate(now),
          note: p.paymentRef ? `Paid, ref ${p.paymentRef}` : null,
        })
        .returning({ id: t.shareholders.id });
      shareholderId = h.id;
    }
    const what = `${p.shares} share${p.shares > 1 ? "s" : ""} at ${rs(p.pricePerShare)} for ${buyer.name}`;
    await logActivity(
      tx,
      admin.id,
      "shares",
      b.status === "approved"
        ? `Approved ${what} (${rs(p.total)})`
        : `Rejected ${what}${b.note ? ` — ${b.note}` : ""}`,
      p.id,
    );
    return { ok: true, status: b.status, shareholderId };
  });
});
