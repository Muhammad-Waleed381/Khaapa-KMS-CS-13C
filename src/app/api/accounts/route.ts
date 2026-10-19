import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { accountFields, currentAccount, describe } from "./_accounts";

// Any active staff member can list accounts (the counter picks from them);
// only admins add or edit them. ?active=1 leaves out turned-off accounts.
export const GET = route(async (req) => {
  await requireUser();
  const db = await getDb();
  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  const accounts = await db
    .select()
    .from(t.paymentAccounts)
    .where(activeOnly ? eq(t.paymentAccounts.active, true) : undefined)
    .orderBy(asc(t.paymentAccounts.createdAt));
  const current = await currentAccount(db);
  return { accounts, currentId: current?.id ?? null };
});

const Body = z.object({ ...accountFields, active: accountFields.active.default(true) });

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const body = await parseBody(req, Body);
  const db = await getDb();
  const [account] = await db
    .insert(t.paymentAccounts)
    .values({ ...body, createdBy: user.id })
    .returning();
  await logActivity(db, user.id, "account", `Added payment account ${describe(account)}`, account.id);
  return { account };
});
