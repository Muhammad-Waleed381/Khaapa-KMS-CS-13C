import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { readShareSettings, remainingFor } from "../shares/shared";

const STATUS = z.enum(["pending", "approved", "rejected", "cancelled"]);

// Own requests; admins pass ?all=1 (optionally &status=) for everyone's.
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams;
  const all = q.get("all") === "1";
  if (all && user.role !== "admin") throw new HttpError(403, "Admins only");
  const status = q.get("status") ? STATUS.parse(q.get("status")) : undefined;
  const db = await getDb();
  const purchases = await db
    .select({
      id: t.sharePurchases.id,
      userId: t.sharePurchases.userId,
      name: t.users.name,
      email: t.users.email,
      shares: t.sharePurchases.shares,
      pricePerShare: t.sharePurchases.pricePerShare,
      total: t.sharePurchases.total,
      paymentRef: t.sharePurchases.paymentRef,
      hasProof: sql<boolean>`${t.sharePurchases.proof} is not null`,
      status: t.sharePurchases.status,
      note: t.sharePurchases.note,
      accountId: t.sharePurchases.accountId,
      accountLabel: t.paymentAccounts.label,
      accountProvider: t.paymentAccounts.provider,
      decidedAt: t.sharePurchases.decidedAt,
      createdAt: t.sharePurchases.createdAt,
    })
    .from(t.sharePurchases)
    .innerJoin(t.users, eq(t.users.id, t.sharePurchases.userId))
    .leftJoin(t.paymentAccounts, eq(t.paymentAccounts.id, t.sharePurchases.accountId))
    .where(
      and(
        all ? undefined : eq(t.sharePurchases.userId, user.id),
        status ? eq(t.sharePurchases.status, status) : undefined,
      ),
    )
    // Pending first, then newest.
    .orderBy(sql`${t.sharePurchases.status} <> 'pending'`, desc(t.sharePurchases.createdAt));
  return { purchases };
});

// A payment screenshot is the proof; a transaction ID is no longer asked for
// (older clients may still send one).
const body = z.object({
  shares: z.number().int().min(1),
  paymentRef: z.string().trim().max(80).nullish(),
  proof: z
    .string({ error: "Attach a screenshot of your payment" })
    .max(420_000, "Screenshot is too large")
    .regex(/^data:image\/(jpeg|png|webp);base64,/, "Not an image"),
});

// Request shares. The price and account are copied from the settings now, so
// a later price change doesn't alter this request.
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await parseBody(req, body);
  const db = await getDb();
  const row = await db.transaction(async (tx) => {
    // One request at a time per shop, so two people can't overshoot the limits together.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('share_purchases'))`);
    const s = await readShareSettings(tx);
    if (!s.open) throw new HttpError(400, "Shares aren't on sale right now");
    if (!s.accountId) throw new HttpError(400, "No payment account is set for shares yet");
    const left = await remainingFor(tx, s, user.id);
    if (left <= 0) throw new HttpError(400, `You've reached the limit of ${s.maxPerPerson} shares`);
    if (b.shares > left) throw new HttpError(400, `You can request at most ${left} more share${left > 1 ? "s" : ""}`);
    const [r] = await tx
      .insert(t.sharePurchases)
      .values({
        userId: user.id,
        shares: b.shares,
        pricePerShare: s.pricePerShare,
        total: b.shares * s.pricePerShare,
        accountId: s.accountId,
        paymentRef: b.paymentRef || null,
        proof: b.proof,
      })
      .returning();
    await logActivity(
      tx,
      user.id,
      "shares",
      `${user.name} requested ${r.shares} share${r.shares > 1 ? "s" : ""} at ${rs(r.pricePerShare)} (${rs(r.total)})`,
      r.id,
    );
    return r;
  });
  const { proof: _proof, ...rest } = row;
  void _proof;
  return { purchase: rest };
});
