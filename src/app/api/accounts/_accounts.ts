import { eq } from "drizzle-orm";
import { z } from "zod";
import { t, type DB, type Tx } from "@/db";
import { HttpError } from "@/lib/server/api";

// Payment accounts that receive online money. Files starting with "_" are not routes.

export const PROVIDERS = ["NayaPay", "JazzCash", "Easypaisa", "Bank", "Other"] as const;

export const accountFields = {
  label: z.string().trim().min(1).max(60),
  provider: z.enum(PROVIDERS),
  accountTitle: z.string().trim().min(1).max(80),
  accountNumber: z.string().trim().min(3).max(40),
  active: z.boolean(),
};

export type Account = typeof t.paymentAccounts.$inferSelect;

/** What customers and cashiers see of an account. */
export type PublicAccount = Pick<Account, "id" | "label" | "provider" | "accountTitle" | "accountNumber">;

export const toPublic = (a: Account): PublicAccount => ({
  id: a.id,
  label: a.label,
  provider: a.provider,
  accountTitle: a.accountTitle,
  accountNumber: a.accountNumber,
});

/** "Shop main (NayaPay ••1234)" */
export const describe = (a: Pick<Account, "label" | "provider" | "accountNumber">) =>
  `${a.label} (${a.provider} ••${a.accountNumber.replace(/\s+/g, "").slice(-4)})`;

export async function getAccount(db: DB | Tx, id: string) {
  const [row] = await db.select().from(t.paymentAccounts).where(eq(t.paymentAccounts.id, id));
  return row ?? null;
}

// The current account lives in the settings table under this key. It's read
// and written through the caller's db/tx, never getSetting/setSetting: those
// use their own connection, which deadlocks inside a transaction on PGlite.
const KEY = "online_account";

/** The shop-wide account online payments currently go to, if it's still active. */
export async function currentAccount(db: DB | Tx): Promise<Account | null> {
  const [setting] = await db.select({ value: t.settings.value }).from(t.settings).where(eq(t.settings.key, KEY));
  const accountId = (setting?.value as { accountId?: string | null } | undefined)?.accountId;
  if (!accountId) return null;
  const row = await getAccount(db, accountId);
  return row?.active ? row : null;
}

export async function setCurrentAccount(db: DB | Tx, id: string) {
  const row = await getAccount(db, id);
  if (!row) throw new HttpError(404, "Account not found");
  if (!row.active) throw new HttpError(400, "That account is turned off");
  const value = { accountId: id };
  await db.insert(t.settings).values({ key: KEY, value }).onConflictDoUpdate({ target: t.settings.key, set: { value } });
  return row;
}
