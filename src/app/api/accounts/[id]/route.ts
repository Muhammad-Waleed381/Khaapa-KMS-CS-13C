import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { accountFields, describe, getAccount } from "../_accounts";

// Accounts are never deleted (old payments point at them); turn one off instead.
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser({ admin: true });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Account not found");
  const body = await parseBody(req, z.object(accountFields).partial());
  const db = await getDb();
  const before = await getAccount(db, id);
  if (!before) throw new HttpError(404, "Account not found");
  const [account] = await db.update(t.paymentAccounts).set(body).where(eq(t.paymentAccounts.id, id)).returning();
  const what =
    body.active === false && before.active
      ? "Turned off"
      : body.active === true && !before.active
        ? "Turned on"
        : "Edited";
  await logActivity(db, user.id, "account", `${what} payment account ${describe(account)}`, id);
  return { account };
});
