import { z } from "zod";
import { getDb } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { currentAccount, describe, setCurrentAccount } from "../_accounts";

// The account online payments go to right now. A cashier switches it once and
// every online sale after that is recorded against it.
export const GET = route(async () => {
  await requireUser();
  return { account: await currentAccount(await getDb()) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { accountId } = await parseBody(req, z.object({ accountId: z.uuid() }));
  const db = await getDb();
  const before = await currentAccount(db);
  const account = await setCurrentAccount(db, accountId);
  if (before?.id !== account.id) {
    await logActivity(db, user.id, "account", `${user.name} switched online payments to ${describe(account)}`, account.id);
  }
  return { account };
});
