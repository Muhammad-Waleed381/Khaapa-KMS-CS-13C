import { connection } from "next/server";
import { getDb } from "@/db";
import { route } from "@/lib/server/api";
import { getShop, preorderDays, preorderWindow } from "../_shop";

// Shop details for the public pages, plus whether pre-orders are open.
export const GET = route(async () => {
  await connection();
  const db = await getDb();
  const { today, tomorrow } = preorderWindow();
  const [shop, days] = await Promise.all([getShop(), preorderDays(db, today, tomorrow)]);
  return { shop, days };
});
