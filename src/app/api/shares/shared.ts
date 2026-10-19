import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { t, type DB, type Tx } from "@/db";

// Share sale settings, stored under the "shares" setting key. The price here
// is only the price for new requests: each request copies it, so changing it
// never touches shares already requested or bought.
export type ShareSettings = {
  pricePerShare: number;
  maxPerPerson: number;
  /** Shares on offer through requests, across everyone. null = no limit. */
  totalOnOffer: number | null;
  open: boolean;
  accountId: string | null;
};

export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  pricePerShare: 100_000,
  maxPerPerson: 3,
  totalOnOffer: null,
  open: false,
  accountId: null,
};

export const shareSettingsInput = z.object({
  pricePerShare: z.number().int().positive(),
  maxPerPerson: z.number().int().min(1).max(1000),
  totalOnOffer: z.number().int().min(0).nullable(),
  open: z.boolean(),
  accountId: z.uuid().nullable(),
});

export async function readShareSettings(db: DB | Tx): Promise<ShareSettings> {
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, "shares"));
  return { ...DEFAULT_SHARE_SETTINGS, ...((row?.value as Partial<ShareSettings>) ?? {}) };
}

export type PublicAccount = { id: string; label: string; provider: string; accountTitle: string; accountNumber: string };

export async function accountById(db: DB | Tx, id: string | null): Promise<PublicAccount | null> {
  if (!id) return null;
  const [a] = await db
    .select({
      id: t.paymentAccounts.id,
      label: t.paymentAccounts.label,
      provider: t.paymentAccounts.provider,
      accountTitle: t.paymentAccounts.accountTitle,
      accountNumber: t.paymentAccounts.accountNumber,
    })
    .from(t.paymentAccounts)
    .where(eq(t.paymentAccounts.id, id));
  return a ?? null;
}

const OPEN_STATUSES = ["pending", "approved"] as const;

/** Shares a person has requested or bought through requests (pending + approved). */
export async function sharesHeldOrPending(db: DB | Tx, userId?: string) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${t.sharePurchases.shares}), 0)::int` })
    .from(t.sharePurchases)
    .where(
      and(
        inArray(t.sharePurchases.status, [...OPEN_STATUSES]),
        userId ? eq(t.sharePurchases.userId, userId) : undefined,
      ),
    );
  return row.n;
}

/** How many more shares this person may request right now. */
export async function remainingFor(db: DB | Tx, s: ShareSettings, userId: string) {
  const mine = await sharesHeldOrPending(db, userId);
  let left = Math.max(0, s.maxPerPerson - mine);
  if (s.totalOnOffer !== null) left = Math.min(left, Math.max(0, s.totalOnOffer - (await sharesHeldOrPending(db))));
  return left;
}
