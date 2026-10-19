import { connection } from "next/server";
import { getDb } from "@/db";
import { route } from "@/lib/server/api";
import { currentAccount, toPublic } from "../../accounts/_accounts";
import { getShop, preorderDays, preorderWindow } from "../_shop";

// Shop details for the public pages, whether pre-orders are open, and the
// account online payments currently go to.
export const GET = route(async () => {
  await connection();
  const db = await getDb();
  const { today, tomorrow } = preorderWindow();
  const [shop, days, account] = await Promise.all([getShop(), preorderDays(db, today, tomorrow), currentAccount(db)]);
  return { shop, days, account: account ? toPublic(account) : null };
});
